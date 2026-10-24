import { useState } from 'react';
import { supabase, q } from '../lib/supabase';
import { useStore } from '../lib/store';
import { CURRENCIES, money, dateAR, todayISO, monthISO } from '../lib/format';
import { Modal, Field, Form, Empty, ConfirmButton, num, str } from '../components/ui';
import { ChargeModal } from './Resumen';
import { DomainModal, RenewDomainModal } from '../components/DomainModals';
import { domainStatus, dueLabel } from '../lib/domains';

const STATUS_LABEL = { activo: 'Activo', pausado: 'Pausado', finalizado: 'Finalizado' };

export default function Clientes() {
  const { clients, projects, transactions, domains, domainsReady } = useStore();
  const [search, setSearch] = useState('');
  const [editClient, setEditClient] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const [charge, setCharge] = useState(null);
  const [history, setHistory] = useState(null);
  const [editDomain, setEditDomain] = useState(null);   // { domain, clientId }
  const [renew, setRenew] = useState(null);

  const list = clients.filter((c) => !search ||
    `${c.name} ${c.contact_name ?? ''} ${projects.filter((p) => p.client_id === c.id).map((p) => `${p.name} ${p.url ?? ''}`).join(' ')}`
      .toLowerCase().includes(search.toLowerCase()));

  const month = monthISO();
  const paidThisMonth = new Set(transactions.filter((t) => t.period === month).map((t) => t.project_id));

  return (
    <div className="adm-page">
      <div className="adm-filters">
        <input type="search" placeholder="Buscar cliente o web…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="adm-grow" />
        <button className="adm-btn primary" onClick={() => setEditClient({})}>+ Cliente</button>
      </div>

      {list.length === 0 && <Empty>{clients.length ? 'Sin resultados.' : 'Todavía no hay clientes. Cargá el primero.'}</Empty>}

      <div className="adm-client-grid">
        {list.map((c) => {
          const ps = projects.filter((p) => p.client_id === c.id);
          const income = transactions.filter((t) => t.client_id === c.id && t.kind === 'ingreso');
          const byCur = CURRENCIES.map((cur) => [cur, income.filter((t) => t.currency === cur).reduce((a, t) => a + Number(t.amount), 0)])
            .filter(([, v]) => v > 0);
          return (
            <article key={c.id} className="adm-panel adm-client">
              <header className="adm-panel-head">
                <div>
                  <h2 className="clickable" onClick={() => setEditClient(c)}>{c.name}</h2>
                  <small className="adm-muted">{[c.contact_name, c.email, c.phone].filter(Boolean).join(' · ')}</small>
                </div>
                <div className="adm-actions">
                  <button className="adm-btn small ghost" onClick={() => setHistory(c)}>Historial</button>
                  <button className="adm-icon-btn" onClick={() => setEditClient(c)} aria-label="Editar cliente" title="Editar cliente">✎</button>
                </div>
              </header>

              {ps.length === 0 ? <Empty>Sin trabajos.</Empty> : (
                <ul className="adm-list">
                  {ps.map((p) => (
                    <li key={p.id} className="adm-project-row">
                      <div>
                        <b className="clickable" onClick={() => setEditProject(p)}>{p.name}</b>
                        <small>
                          {p.url && <a href={p.url.startsWith('http') ? p.url : `https://${p.url}`} target="_blank" rel="noreferrer">{p.url.replace(/^https?:\/\//, '')}</a>}
                          {' '}<span className={`adm-tag ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                        </small>
                      </div>
                      <span>
                        {Number(p.amount) > 0 ? (
                          <>
                            {money(p.amount, p.currency)}
                            <small>{p.billing_type === 'mensual' ? '/mes' : 'único'}</small>
                          </>
                        ) : <small>Sin cargo</small>}
                      </span>
                      {Number(p.amount) === 0
                        ? <span className="adm-tag">Sin cobro</span>
                        : p.billing_type === 'mensual' && paidThisMonth.has(p.id)
                          ? <span className="adm-tag ingreso">Mes cobrado</span>
                          : <button className="adm-btn small primary" onClick={() => setCharge({ project: p, period: month })}>Cobrar</button>}
                      <button className="adm-icon-btn" onClick={() => setEditProject(p)} aria-label="Editar trabajo" title="Editar trabajo">✎</button>
                      {domains.some((d) => d.project_id === p.id) && (
                        <div className="adm-domain-chips">
                          {domains.filter((d) => d.project_id === p.id).map((d) => (
                            <span key={d.id} className={`adm-domain-chip ${domainStatus(d)}`}>
                              <button className="adm-chip-main" onClick={() => setEditDomain({ domain: d, clientId: c.id })} title="Editar dominio">
                                🌐 {d.name} <small>· {domainStatus(d) === 'ok' ? `vence ${dateAR(d.expires_on)}` : dueLabel(d)}</small>
                              </button>
                              {domainStatus(d) !== 'ok' && <button className="adm-chip-action" onClick={() => setRenew(d)}>Renovar</button>}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <footer className="adm-client-foot">
                <span className="adm-muted">Cobrado total: {byCur.length ? byCur.map(([cur, v]) => money(v, cur)).join(' + ') : '—'}</span>
                <span className="adm-actions">
                  {domainsReady && ps.length > 0 && (
                    <button className="adm-btn small ghost" onClick={() => setEditDomain({ domain: {}, clientId: c.id })}>+ Dominio</button>
                  )}
                  <button className="adm-btn small" onClick={() => setEditProject({ client_id: c.id })}>+ Trabajo</button>
                </span>
              </footer>
            </article>
          );
        })}
      </div>

      {editClient && <ClientModal client={editClient} onClose={() => setEditClient(null)} />}
      {editProject && <ProjectModal project={editProject} onClose={() => setEditProject(null)} />}
      {charge && <ChargeModal {...charge} onClose={() => setCharge(null)} />}
      {history && <HistoryModal client={history} onClose={() => setHistory(null)} />}
      {editDomain && <DomainModal {...editDomain} onClose={() => setEditDomain(null)} />}
      {renew && <RenewDomainModal domain={renew} onClose={() => setRenew(null)} />}
    </div>
  );
}

function ClientModal({ client, onClose }) {
  const { reload } = useStore();
  const isNew = !client.id;

  const save = async (fd) => {
    const row = { name: str(fd, 'name'), contact_name: str(fd, 'contact_name'), email: str(fd, 'email'), phone: str(fd, 'phone'), notes: str(fd, 'notes') };
    await q(isNew ? supabase.from('clients').insert(row) : supabase.from('clients').update(row).eq('id', client.id));
    await reload();
    onClose();
  };

  const remove = async () => {
    await q(supabase.from('clients').delete().eq('id', client.id));
    await reload();
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nuevo cliente' : 'Editar cliente'} onClose={onClose}>
      <Form onSubmit={save} onCancel={onClose}
        danger={!isNew && <ConfirmButton onConfirm={remove}>Eliminar cliente y sus trabajos</ConfirmButton>}>
        <Field label="Nombre / empresa" wide><input name="name" defaultValue={client.name ?? ''} required autoFocus /></Field>
        <Field label="Contacto"><input name="contact_name" defaultValue={client.contact_name ?? ''} /></Field>
        <Field label="Teléfono"><input name="phone" type="tel" defaultValue={client.phone ?? ''} /></Field>
        <Field label="Email" wide><input name="email" type="email" defaultValue={client.email ?? ''} /></Field>
        <Field label="Notas" wide><textarea name="notes" rows={3} defaultValue={client.notes ?? ''} /></Field>
      </Form>
      {!isNew && <p className="adm-muted adm-note">Al eliminar un cliente, sus cobros quedan en Gastos sin cliente asignado.</p>}
    </Modal>
  );
}

function ProjectModal({ project, onClose }) {
  const { reload } = useStore();
  const isNew = !project.id;
  const [billing, setBilling] = useState(project.billing_type ?? 'mensual');

  const save = async (fd) => {
    const row = {
      client_id: project.client_id,
      name: str(fd, 'name'),
      url: str(fd, 'url'),
      status: fd.get('status'),
      billing_type: billing,
      amount: num(fd, 'amount'),
      currency: fd.get('currency'),
      start_date: fd.get('start_date'),
      notes: str(fd, 'notes'),
    };
    await q(isNew ? supabase.from('projects').insert(row) : supabase.from('projects').update(row).eq('id', project.id));
    await reload();
    onClose();
  };

  const remove = async () => {
    await q(supabase.from('projects').delete().eq('id', project.id));
    await reload();
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nuevo trabajo' : 'Editar trabajo'} onClose={onClose}>
      <div className="adm-segmented">
        <button type="button" className={billing === 'mensual' ? 'on' : ''} onClick={() => setBilling('mensual')}>Mantenimiento mensual</button>
        <button type="button" className={billing === 'unico' ? 'on' : ''} onClick={() => setBilling('unico')}>Pago único</button>
      </div>
      <Form onSubmit={save} onCancel={onClose} danger={!isNew && <ConfirmButton onConfirm={remove} />}>
        <Field label="Nombre" wide><input name="name" defaultValue={project.name ?? ''} placeholder="Web institucional, tienda…" required autoFocus /></Field>
        <Field label="URL" wide><input name="url" defaultValue={project.url ?? ''} placeholder="www.cliente.com" /></Field>
        <Field label={billing === 'mensual' ? 'Monto por mes' : 'Monto cobrado'} hint="0 = sin cobro (sitio propio, canje…): no aparece en “Por cobrar”.">
          <div className="adm-input-group">
            <input name="amount" inputMode="decimal" defaultValue={project.amount ?? ''} required />
            <select name="currency" defaultValue={project.currency ?? 'ARS'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={project.status ?? 'activo'}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label={billing === 'mensual' ? 'Cobra desde' : 'Fecha'}><input type="date" name="start_date" defaultValue={project.start_date ?? todayISO()} required /></Field>
        <Field label="Notas" wide><textarea name="notes" rows={2} defaultValue={project.notes ?? ''} /></Field>
      </Form>
    </Modal>
  );
}

function HistoryModal({ client, onClose }) {
  const { transactions, projects } = useStore();
  const rows = transactions.filter((t) => t.client_id === client.id);
  const pname = (id) => projects.find((p) => p.id === id)?.name ?? '';
  return (
    <Modal title={`Historial · ${client.name}`} onClose={onClose} width={640}>
      {rows.length === 0 ? <Empty>Sin movimientos.</Empty> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Trabajo</th><th>Detalle</th><th className="r">Monto</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{dateAR(t.date)}</td><td>{pname(t.project_id)}</td><td>{t.description}</td>
                  <td className={`r ${t.kind === 'ingreso' ? 'pos' : 'neg'}`}>{money(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {client.notes && <p className="adm-muted adm-note">{client.notes}</p>}
    </Modal>
  );
}
