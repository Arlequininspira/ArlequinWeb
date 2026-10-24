import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, q } from './supabase';

/*
 * Single shared copy of the business data. Every screen reads from here and
 * every mutation calls reload(), so a charge registered in "Clientes" shows
 * up immediately in "Gastos" and "Resumen". Also refetches when the tab gets
 * focus, so the two admins see each other's changes.
 */
const StoreCtx = createContext(null);

const EMPTY = { clients: [], projects: [], transactions: [], recurring: [], domains: [] };

export function StoreProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [clients, projects, transactions, recurring, domains] = await Promise.all([
        q(supabase.from('clients').select('*').order('name')),
        q(supabase.from('projects').select('*').order('created_at')),
        q(supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })),
        q(supabase.from('recurring_expenses').select('*').order('next_due')),
        // Tolerate a database where migration 002 (domains) hasn't run yet.
        q(supabase.from('domains').select('*').order('expires_on')).catch(() => null),
      ]);
      setData({ clients, projects, transactions, recurring, domains: domains ?? [], domainsReady: domains !== null });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [reload]);

  return <StoreCtx.Provider value={{ ...data, loading, error, reload }}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
