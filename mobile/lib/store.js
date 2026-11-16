import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { get, getServerUrl, initApi, onApiError, setToken } from './api';

const Ctx = createContext(null);
const SESSIONS_KEY = 'gm_sessions';
const ACTIVE_KEY = 'gm_active';

// App state: every account signed in on this device (like Gmail's account switcher),
// the active one, server settings, unread counts, a snackbar and live mail events.
export function AppProvider({ children }) {
  const [booted, setBooted] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeEmail, setActiveEmail] = useState(null);
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState(null);
  const [tick, setTick] = useState(0);
  const [snack, setSnack] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const snackTimer = useRef(null);
  const socketRef = useRef(null);

  const active = sessions.find((s) => s.account.email === activeEmail) || null;
  const account = active ? active.account : null;

  const persist = async (list, email) => {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
    if (email) await AsyncStorage.setItem(ACTIVE_KEY, email); else await AsyncStorage.removeItem(ACTIVE_KEY);
  };

  const toast = useCallback((text, action) => {
    clearTimeout(snackTimer.current);
    setSnack({ text, action, key: Date.now() });
    snackTimer.current = setTimeout(() => setSnack(null), action ? 6000 : 3500);
  }, []);

  const refreshCounts = useCallback(async () => {
    try { const r = await get('/counts'); setCounts(r.counts); } catch {}
  }, []);

  // Boot: restore sessions and pick the active account.
  useEffect(() => {
    (async () => {
      await initApi();
      try { const c = await get('/config'); setSettings(c.settings); } catch {}
      let list = [];
      try { list = JSON.parse((await AsyncStorage.getItem(SESSIONS_KEY)) || '[]'); } catch {}
      const saved = await AsyncStorage.getItem(ACTIVE_KEY);
      const pick = list.find((s) => s.account.email === saved) || list[0];
      if (pick) {
        await setToken(pick.token);
        try {
          const me = await get('/me');
          pick.account = me.account;
          setSettings(me.settings);
          setCounts(me.counts);
        } catch (e) {
          if (e.status === 401 || e.status === 403) { list = list.filter((s) => s !== pick); await setToken(null); }
        }
      }
      setSessions(list);
      setActiveEmail(list.includes(pick) ? pick.account.email : list[0]?.account.email || null);
      if (list.length && !list.includes(pick)) await setToken(list[0].token);
      await persist(list, list.includes(pick) ? pick.account.email : list[0]?.account.email);
      setBooted(true);
    })();
  }, []);

  // Live updates for the active account.
  useEffect(() => {
    if (!booted) return undefined;
    const s = io(getServerUrl(), { auth: { token: active?.token }, transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('settings', (st) => setSettings(st));
    s.on('mail', (m) => {
      setTick((t) => t + 1);
      refreshCounts();
      if (m && m.from && !m.removed) toast(`New mail from ${m.from.name || m.from.email}`);
    });
    s.on('blocked', () => setBlocked(true));
    return () => s.disconnect();
  }, [booted, active?.token, refreshCounts, toast]);

  useEffect(() => onApiError((e) => {
    if (e.code === 'BLOCKED' || e.code === 'UNAUTHORIZED') setBlocked(true);
    if (e.code === 'MAINTENANCE') setSettings((s) => ({ ...(s || {}), maintenanceMode: true, maintenanceMessage: e.message }));
  }), []);

  const signIn = useCallback(async (token, acc, st) => {
    await setToken(token);
    const list = [...sessions.filter((s) => s.account.email !== acc.email), { token, account: acc }];
    setSessions(list);
    setActiveEmail(acc.email);
    if (st) setSettings(st);
    setBlocked(false);
    setCounts(null);
    await persist(list, acc.email);
    refreshCounts();
  }, [sessions, refreshCounts]);

  const switchTo = useCallback(async (email) => {
    const s = sessions.find((x) => x.account.email === email);
    if (!s) return;
    await setToken(s.token);
    setActiveEmail(email);
    setCounts(null);
    setBlocked(false);
    await persist(sessions, email);
    setTick((t) => t + 1);
    refreshCounts();
  }, [sessions, refreshCounts]);

  // Signs out one account (the active one by default); falls back to another signed-in account.
  const signOut = useCallback(async (email) => {
    const target = email || activeEmail;
    const s = sessions.find((x) => x.account.email === target);
    if (s) { try { await fetch(getServerUrl() + '/api/auth/logout', { method: 'POST', headers: { authorization: 'Bearer ' + s.token } }); } catch {} }
    const list = sessions.filter((x) => x.account.email !== target);
    setSessions(list);
    const next = target === activeEmail ? list[0] : sessions.find((x) => x.account.email === activeEmail);
    setActiveEmail(next ? next.account.email : null);
    await setToken(next ? next.token : null);
    setBlocked(false);
    setCounts(null);
    await persist(list, next ? next.account.email : null);
    if (next) refreshCounts();
    return next;
  }, [sessions, activeEmail, refreshCounts]);

  const updateAccount = useCallback(async (acc) => {
    const list = sessions.map((s) => (s.account.email === acc.email ? { ...s, account: acc } : s));
    setSessions(list);
    await persist(list, activeEmail);
  }, [sessions, activeEmail]);

  const value = {
    booted, sessions, account, activeToken: active?.token, settings, counts, setCounts, tick, bump: () => setTick((t) => t + 1),
    snack, toast, hideSnack: () => setSnack(null), blocked, setBlocked,
    signIn, switchTo, signOut, refreshCounts, updateAccount,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

// Re-runs a loader on mount, when deps change, and whenever new mail arrives.
export function useLive(fn, deps) {
  const { tick } = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fn(); }, [...deps, tick]);
}
