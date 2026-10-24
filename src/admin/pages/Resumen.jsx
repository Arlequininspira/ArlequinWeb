import { useState } from 'react';
import { supabase, q } from '../lib/supabase';
import { useStore } from '../lib/store';
import { money, dateAR, todayISO, monthISO, monthLabel, lastMonths, totals } from '../lib/format';
import { Modal, Field, Form, Empty, num, str } from '../components/ui';
import { RenewDomainModal } from '../components/DomainModals';
import { DOMAIN_ALERT_DAYS, domainsDueSoon, domainStatus, dueLabel } from '../lib/domains';

// Monthly projects still not charged for `period` (YYYY-MM). Projects with
// amount 0 (own sites, favors) never need charging.
export function pendingMaintenance(projects, transactions, period = monthISO()) {
  const paid = new Set(transactions.filter((t) => t.period === period && t.project_id).map((t) => t.project_id));
  return projects.filter((p) =>
    p.billing_type === 'mensual' && p.status === 'activo' && Number(p.amount) > 0 &&
    p.start_date.slice(0, 7) <= period && !paid.has(p.id));
}

export default function Resumen() {
  const { projects, transactions, recurring, clients, domains, domainsReady } = useStore();
  const [charge, setCharge] = useState(null);
  const [pay, setPay] = useState(null);
  const [cur, setCur] = useState('ARS');
  const [renew, setRenew] = useState(null);

  const month = monthISO();
  const tot = totals(transactions.filter((t) => t.date.startsWith(month)));
  const pending = pendingMaintenance(projects, transactions, month);
  const in30 = new Date(Date.now() + 30 * 864e5).toLocaleDateString('sv-SE');
  const dueSoon = recurring.filter((r) => r.active && r.next_due <= in30);
  const clientName = (id) => clients.find((c) => c.id === id)?.name ?? '—';
  const domainsDue = domainsDueSoon(domains);
  const domainClient = (d) => clientName(projects.find((p) => p.id === d.project_id)?.client_id);

  const months = lastMonths(6);
  const series = months.map((m) => totals(transactions.filter((t) => t.date.startsWith(m)))[cur]);
  const max = Math.max(1, ...series.flatMap((s) => [s.in, s.out]));

  const monthlyRecurringIncome = projects
    .filter((p) => p.billing_type === 'mensual' && p.status === 'activo' && p.currency === cur)
    .reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="adm-page">
      <section className="adm-stats">
        <div className="adm-stat-group">
          <div className="adm-stat in"><span>Ingresos {monthLabel(month)}</span><b>{money(tot.ARS.in)}</b>
            {tot.USD.in > 0 && <em>+ {money(tot.USD.in, 'USD')}</em>}</div>
          <div className="adm-stat out"><span>Gastos {monthLabel(month)}</span><b>{money(tot.ARS.out)}</b>
            {tot.USD.out > 0 && <em>+ {money(tot.USD.out, 'USD')}</em>}</div>
          <div className={`adm-stat ${tot.ARS.in - tot.ARS.out >= 0 ? 'in' : 'out'}`}>
            <span>Balance del mes</span><b>{money(tot.ARS.in - tot.ARS.out)}</b></div>
          <div className="adm-stat"><span>Mantenimiento mensual ({cur})</span><b>{money(monthlyRecurringIncome, cur)}</b></div>
        </div>
      </section>

      <div className="adm-two-col">
        <section className="adm-panel">
          <header className="adm-panel-head"><h2>Por cobrar este mes</h2><span className="adm-badge">{pending.length}</span></header>
          {pending.length === 0 ? <Empty>Todos los mantenimientos de {monthLabel(month)} están cobrados ✓</Empty> : (
            <ul className="adm-list">
              {pending.map((p) => (
                <li key={p.id}>
                  <div><b>{p.name}</b><small>{clientName(p.client_id)}</small></div>
                  <span>{money(p.amount, p.currency)}</span>
                  <button className="adm-btn small primary" onClick={() => setCharge({ project: p, period: month })}>Cobrar</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-panel">
          <header className="adm-panel-head"><h2>Vencimientos próximos</h2><span className="adm-badge">{dueSoon.length}</span></header>
          {dueSoon.length === 0 ? <Empty>Nada vence en los próximos 30 días.</Empty> : (
            <ul className="adm-list">
              {dueSoon.map((r) => (
                <li key={r.id}>
                  <div><b>{r.name}</b><small className={r.next_due < todayISO() ? 'neg' : ''}>
                    {r.next_due < todayISO() ? 'Vencido ' : 'Vence '}{dateAR(r.next_due)}</small></div>
                  <span>{money(r.amount, r.currency)}</span>
                  <button className="adm-btn small" onClick={() => setPay(r)}>Pagar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="adm-panel">
        <header className="adm-panel-head"><h2>Dominios por vencer</h2><span className="adm-badge">{domainsDue.length}</span></header>
        {!domainsReady ? (
          <p className="adm-warn">Falta correr <code>supabase/migrations/002_domains.sql</code> en Supabase para usar dominios.</p>
        ) : domainsDue.length === 0 ? (
          <Empty>{domains.length ? `Ningún dominio vence en los próximos ${DOMAIN_ALERT_DAYS} días.` : 'Cargá los dominios desde Clientes → + Dominio.'}</Empty>
        ) : (
          <ul className="adm-list">
            {domainsDue.map((d) => (
              <li key={d.id}>
                <div>
                  <b>🌐 {d.name}</b>
                  <small>{domainClient(d)}{d.provider ? ` · ${d.provider}` : ''} · {d.paid_by === 'agencia' ? 'lo pagamos nosotros' : 'lo paga el cliente'}</small>
                </div>
                <span className={`adm-due ${domainStatus(d)}`}>{dueLabel(d)}<small>{dateAR(d.expires_on)}</small></span>
                <button className="adm-btn small primary" onClick={() => setRenew(d)}>Renovar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="adm-panel">
        <header className="adm-panel-head">
          <h2>Últimos 6 meses</h2>
          <div className="adm-segmented small">
            {['ARS', 'USD'].map((c) => <button key={c} className={cur === c ? 'on' : ''} onClick={() => setCur(c)}>{c}</button>)}
          </div>
        </header>
        <div className="adm-chart">
          {months.map((m, i) => (
            <div key={m} className="adm-chart-col" title={`Ingresos ${money(series[i].in, cur)} · Gastos ${money(series[i].out, cur)}`}>
              <div className="adm-chart-bars">
                <i className="in" style={{ height: `${(series[i].in / max) * 100}%` }} />
                <i className="out" style={{ height: `${(series[i].out / max) * 100}%` }} />
              </div>
              <span>{monthLabel(m)}</span>
              <small className={series[i].in - series[i].out >= 0 ? 'pos' : 'neg'}>{money(series[i].in - series[i].out, cur)}</small>
            </div>
          ))}
        </div>
        <p className="adm-legend"><i className="in" /> Ingresos <i className="out" /> Gastos</p>
      </section>

      {charge && <ChargeModal {...charge} onClose={() => setCharge(null)} />}
      {pay && <PayRecurringModal rec={pay} onClose={() => setPay(null)} />}
      {renew && <RenewDomainModal domain={renew} onClose={() => setRenew(null)} />}
    </div>
  );
}

// Registers a client payment → becomes an "ingreso" in Gastos automatically.
export function ChargeModal({ project, period, onClose }) {
  const { reload } = useStore();
  const monthly = project.billing_type === 'mensual';

  const save = async (fd) => {
    await q(supabase.rpc('charge_project', {
      p_project_id: project.id,
      p_amount: num(fd, 'amount'),
      p_date: fd.get('date'),
      p_period: monthly ? fd.get('period') : null,
      p_description: str(fd, 'description'),
    }));
    await reload();
    onClose();
  };

  return (
    <Modal title={`Cobrar · ${project.name}`} onClose={onClose}>
      <Form onSubmit={save} onCancel={onClose} submitLabel="Registrar cobro">
        {monthly && <Field label="Mes que se cobra"><input type="month" name="period" defaultValue={period ?? monthISO()} required /></Field>}
        <Field label="Fecha de cobro"><input type="date" name="date" defaultValue={todayISO()} required /></Field>
        <Field label={`Monto (${project.currency})`}><input name="amount" inputMode="decimal" defaultValue={project.amount} required autoFocus /></Field>
        <Field label="Detalle (opcional)" wide><input name="description" placeholder={project.name} /></Field>
      </Form>
      <p className="adm-muted adm-note">Se registra como ingreso en Administración de gastos.</p>
    </Modal>
  );
}

export function PayRecurringModal({ rec, onClose }) {
  const { reload } = useStore();

  const save = async (fd) => {
    await q(supabase.rpc('pay_recurring', { p_id: rec.id, p_amount: num(fd, 'amount'), p_date: fd.get('date') }));
    await reload();
    onClose();
  };

  return (
    <Modal title={`Pagar · ${rec.name}`} onClose={onClose}>
      <Form onSubmit={save} onCancel={onClose} submitLabel="Registrar pago">
        <Field label="Fecha de pago"><input type="date" name="date" defaultValue={todayISO()} required /></Field>
        <Field label={`Monto (${rec.currency})`}><input name="amount" inputMode="decimal" defaultValue={rec.amount} required autoFocus /></Field>
      </Form>
      <p className="adm-muted adm-note">Se registra como gasto y el vencimiento pasa al {rec.frequency === 'anual' ? 'año' : 'mes'} siguiente.</p>
    </Modal>
  );
}
