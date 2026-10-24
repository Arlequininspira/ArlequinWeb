import { useEffect, useState } from 'react';
import { supabase, isConfigured } from './lib/supabase';
import { StoreProvider, useStore } from './lib/store';
import { domainsDueSoon } from './lib/domains';
import { pendingMaintenance } from './pages/Resumen';
import Login from './pages/Login';
import Resumen from './pages/Resumen';
import Gastos from './pages/Gastos';
import Cuentas, { lockVault } from './pages/Cuentas';
import Clientes from './pages/Clientes';
import './admin.css';

const TABS = [
  { id: 'resumen', label: 'Resumen', Page: Resumen },
  { id: 'gastos', label: 'Administración de gastos', Page: Gastos },
  { id: 'clientes', label: 'Clientes', Page: Clientes },
  { id: 'cuentas', label: 'Administración de cuentas', Page: Cuentas },
];

function useSession() {
  const [session, setSession] = useState(undefined); // undefined = checking
  const [isAdmin, setIsAdmin] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isConfigured) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) lockVault();
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setIsAdmin(false);
    supabase.rpc('is_admin').then(({ data }) => {
      if (data) setIsAdmin(true);
      else {
        setDenied(true);
        supabase.auth.signOut(); // authenticated but not in public.admins
      }
    });
  }, [session]);

  return { session, isAdmin, denied };
}

function Shell({ session }) {
  const [tab, setTab] = useState(() => {
    const h = location.hash.slice(1);
    return TABS.some((t) => t.id === h) ? h : 'resumen';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const { error, domains, projects, transactions } = useStore();
  const alerts = domainsDueSoon(domains).length + pendingMaintenance(projects, transactions).length;

  const go = (id) => {
    setTab(id);
    setMenuOpen(false);
    history.replaceState(null, '', `#${id}`);
  };

  const { Page } = TABS.find((t) => t.id === tab);

  return (
    <div className="adm-shell">
      <aside className={`adm-side${menuOpen ? ' open' : ''}`}>
        <div className="adm-brand">
          <img src="/Cartas/favicon.avif" alt="" />
          <span>Arlequín<small>Administración</small></span>
        </div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => go(t.id)}>
              {t.label}
              {t.id === 'resumen' && alerts > 0 && <span className="adm-nav-badge" title="Avisos pendientes">{alerts}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-user">
          <span title={session.user.email}>{session.user.email}</span>
          <button className="adm-btn ghost small" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </aside>
      {menuOpen && <div className="adm-side-backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="adm-main">
        <header className="adm-topbar">
          <button className="adm-icon-btn adm-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menú">☰</button>
          <h1>{TABS.find((t) => t.id === tab).label}</h1>
        </header>
        {error && <p className="adm-error">Error cargando datos: {error}</p>}
        <Page />
      </main>
    </div>
  );
}

export default function AdminApp() {
  const { session, isAdmin, denied } = useSession();

  useEffect(() => {
    document.title = 'Arlequín · Administración';
    document.documentElement.classList.add('adm-html');
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
  }, []);

  if (!isConfigured) {
    return (
      <div className="adm-root adm-center">
        <div className="adm-card">
          <h2>Falta configurar Supabase</h2>
          <p>Definí <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (ver <code>supabase/README.md</code>).</p>
        </div>
      </div>
    );
  }

  if (session === undefined || (session && !isAdmin)) {
    return <div className="adm-root adm-center"><div className="adm-spinner" /></div>;
  }

  return (
    <div className="adm-root">
      {session ? (
        <StoreProvider>
          <Shell session={session} />
        </StoreProvider>
      ) : (
        <Login denied={denied} />
      )}
    </div>
  );
}
