import { CURRENCIES, PARTNERS, money } from '../lib/format';
import { Empty } from './ui';

const UNASSIGNED = { id: '', label: 'Sin asignar' };
const sum = (txs) => txs.reduce((a, t) => a + Number(t.amount), 0);

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
      out.push({ from: o.label, to: u.label, amount });
      o.d -= amount;
      u.d -= amount;
    }
  }
  return { avg, transfers: out };
}

/*
 * Ingresos cobrados y gastos pagados por cada socio, abiertos por categoría,
 * y cuánto se tienen que pasar para quedar 50/50. Una tabla por moneda.
 */
export default function PartnerBalance({ txs }) {
  const currencies = CURRENCIES.filter((c) => c === 'ARS' || txs.some((t) => t.currency === c));
  if (!txs.length) return <Empty>No hay movimientos en este período.</Empty>;
  return currencies.map((cur) => <CurrencyBalance key={cur} cur={cur} txs={txs.filter((t) => t.currency === cur)} />);
}

function CurrencyBalance({ cur, txs }) {
  const known = new Set(PARTNERS.map((p) => p.id));
  const owner = (t) => (known.has(t.paid_by) ? t.paid_by : '');
  const unassigned = txs.filter((t) => !owner(t));
  const cols = unassigned.length ? [...PARTNERS, UNASSIGNED] : PARTNERS;
  const of = (txs, col) => sum(txs.filter((t) => owner(t) === col.id));

  const section = (kind) => {
    const list = txs.filter((t) => t.kind === kind);
    const cats = [...new Set(list.map((t) => t.category))].sort();
    return { list, cats: cats.map((c) => ({ name: c, txs: list.filter((t) => t.category === c) })) };
  };
  const ins = section('ingreso');
  const outs = section('gasto');

  const nets = PARTNERS.map((p) => ({ ...p, net: of(ins.list, p) - of(outs.list, p) }));
  const total = sum(ins.list) - sum(outs.list);
  const { avg, transfers } = settle(nets);
  const assigned = txs.length > unassigned.length;

  const row = (label, values, className = '', key = label, sign = '') => (
    <tr key={key} className={className}>
      <td>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`r${className.includes('net') ? (v >= 0 ? ' pos' : ' neg') : ''}`}>
          {v ? `${sign}${money(v, cur)}` : '—'}
        </td>
      ))}
    </tr>
  );
  const values = (txs) => [...cols.map((c) => of(txs, c)), sum(txs)];

  return (
    <div className="adm-balance">
      {CURRENCIES.length > 1 && <h3 className="adm-balance-cur">{cur}</h3>}
      <div className="adm-table-wrap">
        <table className="adm-table adm-balance-table">
          <thead>
            <tr><th />{cols.map((c) => <th key={c.id || 'none'} className="r">{c.label}</th>)}<th className="r">Total</th></tr>
          </thead>
          <tbody>
            <tr className="group"><td colSpan={cols.length + 2}>Cobró</td></tr>
            {ins.cats.map((c) => row(c.name, values(c.txs), 'cat', `i-${c.name}`))}
            {row('Total cobrado', values(ins.list), 'sub in', 'ti', '+')}
            <tr className="group"><td colSpan={cols.length + 2}>Pagó</td></tr>
            {outs.cats.map((c) => row(c.name, values(c.txs), 'cat', `o-${c.name}`))}
            {row('Total pagado', values(outs.list), 'sub out', 'to', '−')}
            {row('Neto en mano', [...cols.map((c) => of(ins.list, c) - of(outs.list, c)), total], 'net')}
          </tbody>
        </table>
      </div>

      <div className="adm-settle">
        <p>
          Ganancia del período: <b className={total >= 0 ? 'pos' : 'neg'}>{money(total, cur)}</b>
          {assigned && <>{' · '}repartiendo 50/50{unassigned.length ? ' lo asignado' : ''}, a cada uno le corresponde <b>{money(avg, cur)}</b></>}
        </p>
        {!assigned ? null : transfers.length === 0
          ? <p className="adm-settle-ok">✓ Están a mano, nadie le debe nada a nadie.</p>
          : transfers.map((t, i) => (
            <p key={i} className="adm-settle-move"><b>{t.from}</b> le pasa <b>{money(t.amount, cur)}</b> a <b>{t.to}</b></p>
          ))}
        {unassigned.length > 0 && (
          <p className="adm-warn">
            Hay {unassigned.length} movimiento{unassigned.length > 1 ? 's' : ''} sin asignar ({money(sum(unassigned.filter((t) => t.kind === 'ingreso')), cur)} cobrado,
            {' '}{money(sum(unassigned.filter((t) => t.kind === 'gasto')), cur)} pagado): no entran en el reparto. Asignalos para que el balance sea exacto.
          </p>
        )}
      </div>
    </div>
  );
}
