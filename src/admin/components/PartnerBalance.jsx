import { CURRENCIES, PARTNERS, money } from '../lib/format';
import { Empty } from './ui';

const UNASSIGNED = { id: '', label: 'Sin asignar' };
const sum = (txs) => txs.reduce((a, t) => a + Number(t.amount), 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Movimientos de un período en una moneda, separados por quién cobró / pagó.
function statement(txs) {
  const known = new Set(PARTNERS.map((p) => p.id));
  const owner = (t) => (known.has(t.paid_by) ? t.paid_by : '');
  const ins = txs.filter((t) => t.kind === 'ingreso');
  const outs = txs.filter((t) => t.kind === 'gasto');
  const account = (p) => {
    const i = ins.filter((t) => owner(t) === p.id);
    const o = outs.filter((t) => owner(t) === p.id);
    return { ...p, in: sum(i), out: sum(o), nIn: i.length, nOut: o.length };
  };
  return {
    ins, outs, owner, partners: PARTNERS.map(account), unassigned: account(UNASSIGNED),
  };
}

/*
 * Todo entra y sale de la misma cuenta: esto sólo muestra quién registró cada
 * cobro y cada pago del período (control), y abajo el detalle por categoría.
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
            accounts={currencies.map((c) => ({ cur: c, ...st[c].partners.find((x) => x.id === p.id) }))} />
        ))}
      </div>

      {unassignedCount > 0 && (
        <div className="adm-warn adm-ledger-warn">
          <span>
            <b>{plural(unassignedCount, 'movimiento sin asignar', 'movimientos sin asignar')}</b>
            {' '}({currencies.map((c) => `${money(st[c].unassigned.in, c)} cobrado, ${money(st[c].unassigned.out, c)} pagado`).join(' · ')}).
            {' '}Indicá quién cobró o pagó cada uno.
          </span>
          <button type="button" className="adm-btn small" onClick={() => onSelect(who === 'nadie' ? 'todos' : 'nadie')}>
            {who === 'nadie' ? 'Ver todos' : 'Ver y asignar'}
          </button>
        </div>
      )}

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
          <div><dt>Cobró <small>{plural(a.nIn, 'ingreso', 'ingresos')}</small></dt><dd className="pos">{money(a.in, a.cur)}</dd></div>
          <div><dt>Pagó <small>{plural(a.nOut, 'gasto', 'gastos')}</small></dt><dd className="neg">{money(a.out, a.cur)}</dd></div>
        </dl>
      ))}
    </article>
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
        <td key={i} className="r">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
