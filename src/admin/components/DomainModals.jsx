import { useState } from 'react';
import { supabase, q } from '../lib/supabase';
import { useStore } from '../lib/store';
import { CURRENCIES, money, dateAR, todayISO } from '../lib/format';
import { DOMAIN_PROVIDERS, addYears, nextAnniversary, hostFromUrl, dueLabel } from '../lib/domains';
import { Modal, Field, Form, ConfirmButton, num, str } from './ui';

export function DomainModal({ domain, clientId, onClose }) {
  const { projects, reload } = useStore();
  const isNew = !domain.id;
  const clientProjects = projects.filter((p) => p.client_id === (clientId ?? projects.find((x) => x.id === domain.project_id)?.client_id));
  const [projectId, setProjectId] = useState(domain.project_id ?? clientProjects[0]?.id ?? '');
  const project = projects.find((p) => p.id === projectId);
  const [registered, setRegistered] = useState(domain.registered_on ?? todayISO());
  const [expires, setExpires] = useState(domain.expires_on ?? addYears(todayISO()));
  const [expiresTouched, setExpiresTouched] = useState(!isNew);
  const [paidBy, setPaidBy] = useState(domain.paid_by ?? 'agencia');

  const onRegistered = (v) => {
    setRegistered(v);
    // Renews on the next anniversary of the registration unless edited by hand.
    if (!expiresTouched && v) setExpires(nextAnniversary(v));
  };

  const save = async (fd) => {
    if (!projectId) throw new Error('Elegí el trabajo al que pertenece.');
    const row = {
      project_id: projectId,
      name: str(fd, 'name')?.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''),
      provider: str(fd, 'provider'),
      registered_on: registered,
      expires_on: expires,
      cost: num(fd, 'cost'),
      currency: fd.get('currency'),
      paid_by: paidBy,
      notes: str(fd, 'notes'),
    };
    if (!row.name) throw new Error('Falta el dominio.');
    if (row.expires_on < row.registered_on) throw new Error('El vencimiento no puede ser anterior al registro.');
    await q(isNew ? supabase.from('domains').insert(row) : supabase.from('domains').update(row).eq('id', domain.id));
    await reload();
    onClose();
  };

  const remove = async () => {
    await q(supabase.from('domains').delete().eq('id', domain.id));
    await reload();
    onClose();
  };

  return (
    <Modal title={isNew ? 'Nuevo dominio' : `Editar · ${domain.name}`} onClose={onClose}>
      <div className="adm-segmented">
        <button type="button" className={paidBy === 'agencia' ? 'on' : ''} onClick={() => setPaidBy('agencia')}>Lo pagamos nosotros</button>
        <button type="button" className={paidBy === 'cliente' ? 'on' : ''} onClick={() => setPaidBy('cliente')}>Lo paga el cliente</button>
      </div>
      <Form onSubmit={save} onCancel={onClose} danger={!isNew && <ConfirmButton onConfirm={remove} />}>
        <Field label="Dominio" wide>
          <input name="name" key={projectId} defaultValue={domain.name ?? hostFromUrl(project?.url)} placeholder="cliente.com.ar" required autoFocus />
        </Field>
        <Field label="Trabajo">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            {clientProjects.length === 0 && <option value="">Primero cargá un trabajo</option>}
            {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Proveedor">
          <input name="provider" list="adm-dom-providers" defaultValue={domain.provider ?? ''} placeholder="NIC Argentina…" />
          <datalist id="adm-dom-providers">{DOMAIN_PROVIDERS.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Fecha de registro">
          <input type="date" value={registered} onChange={(e) => onRegistered(e.target.value)} required />
        </Field>
        <Field label="Vence" hint={isNew && !expiresTouched ? 'Automático: próximo aniversario del registro' : undefined}>
          <input type="date" value={expires} onChange={(e) => { setExpires(e.target.value); setExpiresTouched(true); }} required />
        </Field>
        <Field label="Costo anual">
          <div className="adm-input-group">
            <input name="cost" inputMode="decimal" defaultValue={domain.cost ?? '0'} />
            <select name="currency" defaultValue={domain.currency ?? 'ARS'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </Field>
        <Field label="Notas" wide><input name="notes" defaultValue={domain.notes ?? ''} placeholder="Titular, DNS, cuenta donde está…" /></Field>
      </Form>
    </Modal>
  );
}

export function RenewDomainModal({ domain, onClose }) {
  const { reload } = useStore();
  const [years, setYears] = useState(1);
  const agency = domain.paid_by === 'agencia';

  const save = async (fd) => {
    await q(supabase.rpc('renew_domain', {
      p_id: domain.id,
      p_amount: agency ? num(fd, 'amount') : 0,
      p_date: fd.get('date'),
      p_years: years,
    }));
    await reload();
    onClose();
  };

  return (
    <Modal title={`Renovar · ${domain.name}`} onClose={onClose}>
      <p className="adm-muted adm-renew-line">
        {dueLabel(domain)} ({dateAR(domain.expires_on)}) → nuevo vencimiento <b>{dateAR(addYears(domain.expires_on, years))}</b>
      </p>
      <Form onSubmit={save} onCancel={onClose} submitLabel="Marcar renovado">
        <Field label="Años">
          <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
            {[1, 2, 3, 5].map((y) => <option key={y} value={y}>{y} año{y > 1 ? 's' : ''}</option>)}
          </select>
        </Field>
        <Field label="Fecha de pago"><input type="date" name="date" defaultValue={todayISO()} required /></Field>
        {agency && (
          <Field label={`Monto pagado (${domain.currency})`} wide>
            <input name="amount" inputMode="decimal" defaultValue={Number(domain.cost) * years || ''} required />
          </Field>
        )}
      </Form>
      <p className="adm-muted adm-note">
        {agency
          ? 'Se registra como gasto "Dominios" vinculado a este cliente.'
          : `Lo paga el cliente: sólo se actualiza el vencimiento. Costo de referencia ${money(domain.cost, domain.currency)}.`}
      </p>
    </Modal>
  );
}
