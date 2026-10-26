import { CURRENCIES, PARTNERS, money } from '../lib/format';
import { Empty } from './ui';

const UNASSIGNED = { id: '', label: 'Sin asignar' };
const sum = (txs) => txs.reduce((a, t) => a + Number(t.amount), 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Who has to pass how much to whom so every partner ends with the same net.
// Greedy match of the ones above the average against the ones below.
function settle(nets) {
  const avg = nets.reduce((a, n) => a + n.net, 0) / nets.length;
  const over = nets.map((n) => ({ ...n, d: n.net - avg })).filter((n) => n.d > 0.005).sort((a, b) => b.d - a.d);
  const under = nets.map((n) => ({ ...n, d: avg - n.net })).filter((n) => n.d > 0.005).sort((a, b) => b.d - a.d);
  const out = [];
  for (const o of over) {
    for (const u of under) {
      const amount = Math.min(o.d, u.d);
      if (amount <= 0.005) continue;
      out.push({ from: o, to: u, amount });
      o.d -= amount;
      u.d -= amount;
    }
  }
  return { avg, transfers: out };
}

// Estado de cuenta de un período en una moneda: lo de cada socio, lo sin
// asignar y el reparto 50/50 de lo asignado.
function statement(txs) {
  const known = new Set(PARTNERS.map((p) => p.id));
  const owner = (t) => (known.has(t.paid_by) ? t.paid_by : '');
  const ins = txs.filter((t) => t.kind === 'ingreso');
  const outs = txs.filter((t) => t.kind === 'gasto');
  const account = (p) => {
    const i = ins.filter((t) => owner(t) === p.id);
    const o = outs.filter((t) => owner(t) === p.id);
    return { ...p, in: sum(i), out: sum(o), nIn: i.length, nOut: o.length, net: sum(i) - sum(o) };
  };
  const partners = PARTNERS.map(account);
  const unassigned = account(UNASSIGNED);
  const { avg, transfers } = settle(partners);
  for (const p of partners) {
    p.share = avg;
    p.owesTo = transfers.filter((t) => t.from.id === p.id);
    p.getsFrom = transfers.filter((t) => t.to.id === p.id);
  }
  return {
    ins, outs, owner, partners, unassigned, transfers,
    income: sum(ins), expense: sum(outs), profit: sum(ins) - sum(outs),
    assigned: txs.length > unassigned.nIn + unassigned.nOut,
  };
}

/*
 * Cuenta corriente de cada socio para el período: qué cobró, qué pagó, cuánto
 * tiene en mano, cuánto le corresponde (50%) y el saldo a transferir. Abajo,
 * el detalle por categoría.
 */
export default function PartnerBalance({ txs, who, onSelect }) {
  if (!txs.length) return <Empty>No hay movimientos en este período.</Empty>;
  const currencies = CURRENCIES.filter((c) => txs.some((t) => t.currency === c));
  const st = Object.fromEntries(currencies.map((c) => [c, statement(txs.filter((t) => t.currency === c))]));
  const unassignedCount = currencies.reduce((a, c) => a + st[c].unassigned.nIn + st[c].unassigned.nOut, 0);

  return (
    <>
      <div className="adm-ledger-grid">
        {PARTNERS.map((p) => (
          <PartnerCard key={p.id} partner={p} active={who === p.id} onSelect={onSelect}
            accounts={currencies.map((c) => ({ cur: c, assigned: st[c].assigned, ...st[c].partners.find((x) => x.id === p.id) }))} />
        ))}
      </div>

      {unassignedCount > 0 && (
        <div className="adm-warn adm-ledger-warn">
          <span>
            <b>{plural(unassignedCount, 'movimiento sin asignar', 'movimientos sin asignar')}</b>
            {' '}({currencies.map((c) => `${money(st[c].unassigned.in, c)} cobrado, ${money(st[c].unassigned.out, c)} pagado`).join(' · ')}).
            {' '}No entran en el reparto hasta que indiques quién cobró o pagó.
          </span>
          <button type="button" className="adm-btn small" onClick={() => onSelect(who === 'nadie' ? 'todos' : 'nadie')}>
            {who === 'nadie' ? 'Ver todos' : 'Ver y asignar'}
          </button>
        </div>
      )}

      {currencies.map((c) => <Result key={c} cur={c} st={st[c]} showCur={currencies.length > 1} />)}

      <details className="adm-ledger-detail">
        <summary>Detalle por categoría</summary>
        {currencies.map((c) => <CategoryTable key={c} cur={c} st={st[c]} showCur={currencies.length > 1} />)}
      </details>
    </>
  );
}

function PartnerCard({ partner, accounts, active, onSelect }) {
  const count = accounts.reduce((a, x) => a + x.nIn + x.nOut, 0);
  return (
    <article className={`adm-ledger${active ? ' on' : ''}`}>
      <header>
        <span className="adm-ledger-avatar">{partner.label[0]}</span>
        <h3>{partner.label}</h3>
        <button type="button" className={`adm-btn small ${active ? 'primary' : 'ghost'}`}
          onClick={() => onSelect(active ? 'todos' : partner.id)}>
          {active ? 'Quitar filtro ✕' : `Ver sus ${plural(count, 'movimiento', 'movimientos')} →`}
        </button>
      </header>

      {accounts.map((a) => (
        <dl key={a.cur} className="adm-ledger-lines">
          {accounts.length > 1 && <div className="adm-ledger-cur">{a.cur}</div>}
          <div><dt>Cobró <small>{plural(a.nIn, 'ingreso', 'ingresos')} que entraron a {partner.label}</small></dt><dd className="pos">+ {money(a.in, a.cur)}</dd></div>
          <div><dt>Pagó <small>{plural(a.nOut, 'gasto', 'gastos')} que puso {partner.label}</small></dt><dd className="neg">− {money(a.out, a.cur)}</dd></div>
          <div className="total"><dt>Neto en mano <small>cobró − pagó</small></dt><dd>{money(a.net, a.cur)}</dd></div>
          {a.assigned && (
            <>
              <div><dt>Le corresponde <small>50% de la ganancia asignada</small></dt><dd>{money(a.share, a.cur)}</dd></div>
              <div className={`saldo ${a.owesTo.length ? 'owes' : a.getsFrom.length ? 'gets' : 'even'}`}>
                <dt>Saldo</dt>
                <dd>
                  {a.owesTo.length
                    ? a.owesTo.map((t) => <span key={t.to.id}>Debe pasarle <b>{money(t.amount, a.cur)}</b> a {t.to.label}</span>)
                    : a.getsFrom.length
                      ? a.getsFrom.map((t) => <span key={t.from.id}>Tiene que recibir <b>{money(t.amount, a.cur)}</b> de {t.from.label}</span>)
                      : <span>✓ Al día</span>}
                </dd>
              </div>
            </>
          )}
        </dl>
      ))}
    </article>
  );
}

function Result({ cur, st, showCur }) {
  return (
    <div className="adm-ledger-result">
      <span className="lbl">Resultado del período{showCur ? ` (${cur})` : ''}</span>
      <span className="pos">Ingresos {money(st.income, cur)}</span>
      <span>−</span>
      <span className="neg">Gastos {money(st.expense, cur)}</span>
      <span>=</span>
      <b className={st.profit >= 0 ? 'pos' : 'neg'}>Ganancia {money(st.profit, cur)}</b>
    </div>
  );
}

function CategoryTable({ cur, st, showCur }) {
  const cols = st.unassigned.nIn + st.unassigned.nOut ? [...PARTNERS, UNASSIGNED] : PARTNERS;
  const of = (txs, col) => sum(txs.filter((t) => st.owner(t) === col.id));
  const values = (txs) => [...cols.map((c) => of(txs, c)), sum(txs)];
  const byCat = (list) => [...new Set(list.map((t) => t.category))].sort()
    .map((c) => ({ name: c, txs: list.filter((t) => t.category === c) }));

  const row = (label, vals, className = '', key = label, sign = '') => (
    <tr key={key} className={className}>
      <td>{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={`r${className.includes('net') ? (v >= 0 ? ' pos' : ' neg') : ''}`}>
          {v ? `${sign}${money(v, cur)}` : '—'}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="adm-balance">
      {showCur && <h3 className="adm-balance-cur">{cur}</h3>}
      <div className="adm-table-wrap">
        <table className="adm-table adm-balance-table">
          <thead>
            <tr><th />{cols.map((c) => <th key={c.id || 'none'} className="r">{c.label}</th>)}<th className="r">Total</th></tr>
          </thead>
          <tbody>
            <tr className="group"><td colSpan={cols.length + 2}>Cobró</td></tr>
            {byCat(st.ins).map((c) => row(c.name, values(c.txs), 'cat', `i-${c.name}`))}
            {row('Total cobrado', values(st.ins), 'sub in', 'ti', '+')}
            <tr className="group"><td colSpan={cols.length + 2}>Pagó</td></tr>
            {byCat(st.outs).map((c) => row(c.name, values(c.txs), 'cat', `o-${c.name}`))}
            {row('Total pagado', values(st.outs), 'sub out', 'to', '−')}
            {row('Neto en mano', [...cols.map((c) => of(st.ins, c) - of(st.outs, c)), st.profit], 'net')}
          </tbody>
        </table>
      </div>
    </div>
  );
}
