import { useMemo, useState } from 'react';
import { supabase, q } from '../lib/supabase';
import { useStore } from '../lib/store';
import {
  CURRENCIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PARTNERS, partnerLabel, money, dateAR, todayISO, monthISO,
  monthLabel, totals, downloadCSV,
} from '../lib/format';
import { Modal, Field, Form, Empty, ConfirmButton, PaidByField, num, str } from '../components/ui';
import { PayRecurringModal } from './Resumen';

export default function Gastos() {
  const { transactions, recurring, clients, projects, reload } = useStore();
  const [month, setMonth] = useState(monthISO());
  const [kind, setKind] = useState('todos');
  const [cat, setCat] = useState('todas');
  const [who, setWho] = useState('todos');          // partner id, 'nadie' = sin asignar
  const [search, setSearch] = useState('');
  const [editTx, setEditTx] = useState(null);       // {} = new
  const [editRec, setEditRec] = useState(null);
  const [payRec, setPayRec] = useState(null);

  const clientName = (id) => clients.find((c) => c.id === id)?.name;
  const projectName = (id) => projects.find((p) => p.id === id)?.name;

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    set.add(monthISO());
    return [...set].sort().reverse();
  }, [transactions]);

  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions]);

  const filtered = transactions.filter((t) =>
    (month === 'todos' || t.date.startsWith(month)) &&
    (kind === 'todos' || t.kind === kind) &&
    (cat === 'todas' || t.category === cat) &&
    (!search || `${t.description ?? ''} ${t.category} ${clientName(t.client_id) ?? ''} ${partnerLabel(t.paid_by)}`.toLowerCase().includes(search.toLowerCase())));
  const rows = filtered.filter((t) =>
    who === 'todos' || (who === 'nadie' ? t.kind === 'gasto' && !t.paid_by : t.paid_by === who));

  const tot = totals(rows);
  // Gastos imputados a cada socio (+ los sin asignar); ignoran el filtro de
  // socio para poder compararlos lado a lado.
  const expenses = filtered.filter((t) => t.kind === 'gasto');
  const byPartner = [...PARTNERS, { id: '', label: 'Sin asignar' }]
    .map((p) => ({ ...p, tot: totals(expenses.filter((t) => (t.paid_by ?? '') === p.id)) }))
    .filter((p) => p.id || p.tot.ARS.out || p.tot.USD.out);

  const exportCSV = () => downloadCSV(`movimientos-${month}.csv`, [
    ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Cliente', 'Trabajo', 'Pagó', 'Moneda', 'Monto'],
    ...rows.map((t) => [dateAR(t.date), t.kind, t.category, t.description, clientName(t.client_id),
      projectName(t.project_id), partnerLabel(t.paid_by), t.currency, String(t.amount).replace('.', ',')]),
  ]);

  return (
    <div className="adm-page">
      <section className="adm-stats">
        {CURRENCIES.map((c) => (tot[c].in || tot[c].out || c === 'ARS') && (
          <div key={c} className="adm-stat-group">
            <div className="adm-stat in"><span>Ingresos {c}</span><b>{money(tot[c].in, c)}</b></div>
            <div className="adm-stat out"><span>Gastos {c}</span><b>{money(tot[c].out, c)}</b></div>
            <div className={`adm-stat ${tot[c].in - tot[c].out >= 0 ? 'in' : 'out'}`}>
              <span>Balance {c}</span><b>{money(tot[c].in - tot[c].out, c)}</b></div>
          </div>
        ))}
        <div className="adm-stat-group">
          {byPartner.map((p) => (
            <div key={p.id || 'none'} className={`adm-stat out clickable${who === (p.id || 'nadie') ? ' on' : ''}`}
              onClick={() => setWho(who === (p.id || 'nadie') ? 'todos' : (p.id || 'nadie'))}
              title="Filtrar por quién pagó">
              <span>{p.id ? `Pagó ${p.label}` : 'Gastos sin asignar'}</span><b>{money(p.tot.ARS.out)}</b>
              {p.tot.USD.out > 0 && <em>+ {money(p.tot.USD.out, 'USD')}</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="adm-panel">
        <header className="adm-panel-head">
          <h2>Movimientos</h2>
          <div className="adm-actions">
            <button className="adm-btn ghost" onClick={exportCSV} disabled={!rows.length}>Exportar CSV</button>
            <button className="adm-btn primary" onClick={() => setEditTx({ kind: 'gasto' })}>+ Movimiento</button>
          </div>
        </header>
        <div className="adm-filters">
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="todos">Todos los meses</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="todos">Ingresos y gastos</option>
            <option value="ingreso">Sólo ingresos</option>
            <option value="gasto">Sólo gastos</option>
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="todas">Todas las categorías</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="todos">Todos los socios</option>
            {PARTNERS.map((p) => <option key={p.id} value={p.id}>Pagó {p.label}</option>)}
            <option value="nadie">Gastos sin asignar</option>
          </select>
          <input type="search" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {rows.length === 0 ? <Empty>No hay movimientos para este filtro.</Empty> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Fecha</th><th>Categoría</th><th>Detalle</th><th>Cliente</th><th>Pagó</th><th className="r">Monto</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} onClick={() => setEditTx(t)} className="clickable">
                    <td>{dateAR(t.date)}</td>
                    <td><span className={`adm-tag ${t.kind}`}>{t.category}</span></td>
                    <td>{t.description}</td>
                    <td>{clientName(t.client_id)}</td>
                    <td>{t.paid_by && <span className="adm-tag">{partnerLabel(t.paid_by)}</span>}</td>
                    <td className={`r ${t.kind === 'ingreso' ? 'pos' : 'neg'}`}>
                      {t.kind === 'ingreso' ? '+' : '−'}{money(t.amount, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="adm-panel">
        <header className="adm-panel-head">
          <h2>Gastos fijos</h2>
          <button className="adm-btn primary" onClick={() => setEditRec({})}>+ Gasto fijo</button>
        </header>
        {recurring.length === 0 ? <Empty>Cargá acá ARCA, dominios, hosting… y pagalos con un click.</Empty> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Nombre</th><th>Categoría</th><th>Frecuencia</th><th>Próximo venc.</th><th className="r">Monto</th><th /></tr></thead>
              <tbody>
                {recurring.map((r) => (
                  <tr key={r.id} className={r.active ? '' : 'muted'}>
                    <td className="clickable" onClick={() => setEditRec(r)}>{r.name}</td>
                    <td>{r.category}</td>
                    <td>{r.frequency}</td>
                    <td className={r.active && r.next_due <= todayISO() ? 'neg' : ''}>{dateAR(r.next_due)}</td>
                    <td className="r">{money(r.amount, r.currency)}</td>
                    <td className="r">{r.active && <button className="adm-btn small" onClick={() => setPayRec(r)}>Pagar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editTx && <TxModal tx={editTx} onClose={() => setEditTx(null)} onSaved={reload} />}
      {editRec && <RecurringModal rec={editRec} onClose={() => setEditRec(null)} onSaved={reload} />}
      {payRec && <PayRecurringModal rec={payRec} onClose={() => setPayRec(null)} />}
    </div>
  );
}

function TxModal({ tx, onClose, onSaved }) {
  const { clients, projects, me } = useStore();
  const isNew = !tx.id;
  const [kind, setKind] = useState(tx.kind ?? 'gasto');
  const [clientId, setClientId] = useState(tx.client_id ?? '');
  const cats = kind === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const save = async (fd) => {
    const row = {
      kind,
      date: fd.get('date'),
      amount: num(fd, 'amount'),
      currency: fd.get('currency'),
      category: str(fd, 'category') ?? 'Otros',
      description: str(fd, 'description'),
      client_id: clientId || null,
      project_id: str(fd, 'project_id'),
    };
    // Only send paid_by when it matters, so incomes keep saving on a database
    // where migration 004 hasn't run yet.
    if (kind === 'gasto' || tx.paid_by) row.paid_by = kind === 'gasto' ? str(fd, 'paid_by') : null;
    if (row.amount <= 0) throw new Error('El monto debe ser mayor a 0');
    await q(isNew ? supabase.from('transactions').insert(row) : supabase.from('transactions').update(row).eq('id', tx.id));
    await onSaved();
    onClose();
  };

  const remove = async () => {
    await q(supabase.from('transactions').delete().eq('id', tx.id));
    await onSaved();
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nuevo movimiento' : 'Editar movimiento'} onClose={onClose}>
      <div className="adm-segmented">
        <button type="button" className={kind === 'gasto' ? 'on out' : ''} onClick={() => setKind('gasto')}>Gasto</button>
        <button type="button" className={kind === 'ingreso' ? 'on in' : ''} onClick={() => setKind('ingreso')}>Ingreso</button>
      </div>
      <Form onSubmit={save} onCancel={onClose} danger={!isNew && <ConfirmButton onConfirm={remove} />}>
        <Field label="Fecha"><input type="date" name="date" defaultValue={tx.date ?? todayISO()} required /></Field>
        <Field label="Monto">
          <div className="adm-input-group">
            <input name="amount" inputMode="decimal" defaultValue={tx.amount ?? ''} required autoFocus />
            <select name="currency" defaultValue={tx.currency ?? 'ARS'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </Field>
        <Field label="Categoría">
          <input name="category" list="adm-cats" defaultValue={tx.category ?? cats[0]} required />
          <datalist id="adm-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Cliente (opcional)">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {clientId && (
          <Field label="Trabajo (opcional)">
            <select name="project_id" defaultValue={tx.project_id ?? ''}>
              <option value="">—</option>
              {projects.filter((p) => p.client_id === clientId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        {kind === 'gasto' && <PaidByField defaultValue={isNew ? me : tx.paid_by} />}
        <Field label="Detalle" wide><input name="description" defaultValue={tx.description ?? ''} /></Field>
      </Form>
    </Modal>
  );
}

function RecurringModal({ rec, onClose, onSaved }) {
  const isNew = !rec.id;

  const save = async (fd) => {
    const row = {
      name: str(fd, 'name'),
      category: str(fd, 'category') ?? 'Otros',
      amount: num(fd, 'amount'),
      currency: fd.get('currency'),
      frequency: fd.get('frequency'),
      next_due: fd.get('next_due'),
      active: fd.get('active') === 'on',
      notes: str(fd, 'notes'),
    };
    await q(isNew ? supabase.from('recurring_expenses').insert(row) : supabase.from('recurring_expenses').update(row).eq('id', rec.id));
    await onSaved();
    onClose();
  };

  const remove = async () => {
    await q(supabase.from('recurring_expenses').delete().eq('id', rec.id));
    await onSaved();
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nuevo gasto fijo' : 'Editar gasto fijo'} onClose={onClose}>
      <Form onSubmit={save} onCancel={onClose} danger={!isNew && <ConfirmButton onConfirm={remove} />}>
        <Field label="Nombre" wide><input name="name" defaultValue={rec.name ?? ''} placeholder="Monotributo ARCA, dominio .com.ar…" required autoFocus /></Field>
        <Field label="Categoría">
          <input name="category" list="adm-exp-cats" defaultValue={rec.category ?? 'ARCA'} required />
          <datalist id="adm-exp-cats">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Monto">
          <div className="adm-input-group">
            <input name="amount" inputMode="decimal" defaultValue={rec.amount ?? ''} required />
            <select name="currency" defaultValue={rec.currency ?? 'ARS'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </Field>
        <Field label="Frecuencia">
          <select name="frequency" defaultValue={rec.frequency ?? 'mensual'}>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
        </Field>
        <Field label="Próximo vencimiento"><input type="date" name="next_due" defaultValue={rec.next_due ?? todayISO()} required /></Field>
        <Field label="Notas" wide><input name="notes" defaultValue={rec.notes ?? ''} /></Field>
        <label className="adm-check wide"><input type="checkbox" name="active" defaultChecked={rec.active ?? true} /> Activo</label>
      </Form>
    </Modal>
  );
}
