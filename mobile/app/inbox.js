import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Avatar, IconBtn, Spinner, Sym } from '../components/ui';
import { CategoryRow, ThreadRow } from '../components/mail';
import { BottomBar, Drawer, VIEW_TITLES } from '../components/Drawer';
import { api, del, get, post } from '../lib/api';
import { useApp, useLive } from '../lib/store';
import { C, shadow, z } from '../lib/theme';

// Main screen: the list for the current folder, with side menu, search bar, Compose and Meet tab.
export default function Inbox() {
  const params = useLocalSearchParams();
  const { booted, account, counts, setCounts, settings, toast, bump, activeToken } = useApp();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState(params.view || 'primary');
  const [threads, setThreads] = useState(null);
  const [labels, setLabels] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState([]);
  const [fabWide, setFabWide] = useState(true);
  const lastY = useRef(0);
  const fab = useRef(new Animated.Value(1)).current;
  const reqId = useRef(0);

  useEffect(() => { if (booted && !account) router.replace('/welcome'); }, [booted, account]);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    try {
      const r = await get(`/threads?view=${encodeURIComponent(view)}`);
      if (my !== reqId.current) return;
      setThreads(r.threads);
      setCounts(r.counts);
    } catch (e) { if (my === reqId.current) { setThreads((t) => t || []); toast(e.message); } }
  }, [view, setCounts, toast]);

  useLive(() => { if (account) load(); }, [view, activeToken]);
  useLive(() => { if (account) get('/labels').then((r) => setLabels(r.labels)).catch(() => {}); }, [activeToken]);
  useEffect(() => { setThreads(null); setSelected([]); }, [view, activeToken]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawer) { setDrawer(false); return true; }
      if (selected.length) { setSelected([]); return true; }
      if (view !== 'primary') { setView('primary'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [drawer, selected, view]);

  useEffect(() => { Animated.timing(fab, { toValue: fabWide ? 1 : 0, duration: 160, useNativeDriver: false }).start(); }, [fabWide, fab]);

  // Primary shows the Promotions / Social / Updates rows mixed in by date.
  const rows = useMemo(() => {
    if (!threads) return [];
    const list = threads.map((t) => ({ key: t.tid, t }));
    if (view === 'primary' && counts) {
      ['promotions', 'updates', 'social'].forEach((cat) => {
        const info = counts[cat];
        if (!info || !info.date) return;
        const at = list.findIndex((r) => r.t && r.t.date < info.date);
        list.splice(at < 0 ? list.length : at, 0, { key: cat, cat, info });
      });
    }
    return list;
  }, [threads, view, counts]);

  const patch = async (tids, body, undo) => {
    try {
      await Promise.all(tids.map((tid) => api('PATCH', `/threads/${tid}`, body)));
      load();
      if (undo) toast(undo.text, { label: 'Undo', fn: async () => { await Promise.all(tids.map((tid) => api('PATCH', `/threads/${tid}`, undo.body))); load(); } });
    } catch (e) { toast(e.message); }
  };
  const star = (t) => {
    setThreads((list) => list.map((x) => (x.tid === t.tid ? { ...x, starred: !t.starred } : x)));
    api('PATCH', `/threads/${t.tid}`, { starred: !t.starred }).then(() => bump()).catch((e) => toast(e.message));
  };
  const toggle = (t) => setSelected((s) => (s.includes(t.tid) ? s.filter((x) => x !== t.tid) : [...s, t.tid]));
  const open = (t) => {
    if (selected.length) { toggle(t); return; }
    if (view === 'drafts') { router.push({ pathname: '/compose', params: { draftId: t.draftId } }); return; }
    setThreads((list) => list.map((x) => (x.tid === t.tid ? { ...x, unread: false } : x)));
    router.push({ pathname: '/thread/[tid]', params: { tid: t.tid, view } });
  };

  const bulk = (what) => {
    const tids = [...selected];
    setSelected([]);
    if (what === 'archive') patch(tids, { move: 'archive' }, { text: `${tids.length} archived`, body: { move: 'inbox' } });
    if (what === 'trash') {
      if (view === 'trash') Promise.all(tids.map((tid) => del(`/threads/${tid}`))).then(load);
      else patch(tids, { move: 'trash' }, { text: `${tids.length} moved to Trash`, body: { move: 'inbox' } });
    }
    if (what === 'read') patch(tids, { read: threads.filter((t) => tids.includes(t.tid)).some((t) => t.unread) });
    if (what === 'spam') patch(tids, { move: view === 'spam' ? 'inbox' : 'spam' }, { text: view === 'spam' ? 'Moved to Inbox' : 'Reported as spam', body: { move: view === 'spam' ? 'spam' : 'inbox' } });
  };

  const createLabel = async (name) => {
    try { const r = await post('/labels', { name }); setLabels((l) => [...l, r.label]); toast(`Label "${r.label.name}" created`); return true; } catch (e) { toast(e.message); return false; }
  };

  if (!account) return <View style={{ flex: 1, backgroundColor: C.page }} />;
  const title = view.startsWith('label:') ? (labels.find((l) => `label:${l.id}` === view)?.name || 'Label') : VIEW_TITLES[view];
  const unreadBadge = counts ? counts.inbox : 0;
  const allRead = selected.length && threads && threads.filter((t) => selected.includes(t.tid)).every((t) => !t.unread);

  return (
    <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}>
      {selected.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', height: z(64), paddingHorizontal: z(4) }}>
          <IconBtn name="arrow_back" color={C.text} onPress={() => setSelected([])} />
          <Text style={{ flex: 1, fontSize: 20, color: C.text, marginLeft: z(8) }}>{selected.length}</Text>
          {view !== 'trash' && view !== 'spam' && <IconBtn name="archive" color={C.muted} onPress={() => bulk('archive')} />}
          <IconBtn name="delete" color={C.muted} onPress={() => bulk('trash')} />
          <IconBtn name={allRead ? 'mark_email_unread' : 'drafts'} color={C.muted} onPress={() => bulk('read')} />
          <IconBtn name={view === 'spam' ? 'report_off' : 'report'} color={C.muted} onPress={() => bulk('spam')} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', height: z(64), paddingHorizontal: z(8), gap: z(4) }}>
          <IconBtn name="menu" color={C.text} onPress={() => setDrawer(true)} />
          <Pressable onPress={() => router.push('/search')} style={{ flex: 1, height: z(48), borderRadius: z(24), backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: z(18) }}>
            <Text style={{ flex: 1, fontSize: 17, color: C.muted, textAlign: 'center', marginLeft: z(20) }}>{settings?.searchHint || 'Ask Gmai'}</Text>
            <Sym name="auto_awesome" fill size={22} color={C.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/accounts')} style={{ marginLeft: z(6), marginRight: z(4) }}>
            <Avatar name={account.name} color={account.color} photo={account.photo} size={34} ring />
          </Pressable>
        </View>
      )}

      {!!settings?.announcement && (
        <View style={{ marginHorizontal: z(12), marginBottom: z(6), backgroundColor: '#FEF7E0', borderRadius: z(10), padding: z(10), flexDirection: 'row', gap: z(8) }}>
          <Sym name="campaign" size={20} color="#B06000" />
          <Text style={{ flex: 1, fontSize: 13.5, color: '#5F3B00' }}>{settings.announcement}</Text>
        </View>
      )}

      {!threads ? <Spinner style={{ flex: 1 }} /> : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: z(8), paddingBottom: z(96) }}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: z(10), paddingTop: z(4), paddingBottom: z(10) }}>
              <Text style={{ flex: 1, fontSize: 14.5, color: C.muted }}>{title}</Text>
              {(view === 'trash' || view === 'spam') && threads.length > 0 && (
                <Pressable onPress={async () => { await post('/trash/empty', { folder: view }); load(); toast(`${title} emptied`); }}>
                  <Text style={{ color: C.blue, fontSize: 14, fontWeight: '600' }}>Empty {title.toLowerCase()} now</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (item.cat
            ? <CategoryRow cat={item.cat} info={item.info} onPress={() => setView(item.cat)} />
            : <ThreadRow t={item.t} view={view} selected={selected.includes(item.t.tid)} selecting={selected.length > 0}
                onPress={() => open(item.t)} onLongPress={() => toggle(item.t)} onStar={() => star(item.t)} />)}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: z(90), paddingHorizontal: z(30) }}>
              <Sym name={view === 'trash' ? 'delete' : view === 'spam' ? 'report' : 'inbox'} size={64} color="#C4C7C5" />
              <Text style={{ fontSize: 16, color: C.muted, marginTop: z(14), textAlign: 'center' }}>{view === 'primary' || view === 'inbox' ? "You're all done! Nothing in Inbox" : `Nothing in ${title}`}</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[C.blue]} />}
          onScroll={(e) => { const y = e.nativeEvent.contentOffset.y; if (Math.abs(y - lastY.current) > 8) { setFabWide(y < lastY.current || y < 40); lastY.current = y; } }}
          scrollEventThrottle={32}
        />
      )}

      {!selected.length && (
        <Animated.View style={{ position: 'absolute', right: z(16), bottom: insets.bottom + z(64) + z(16), ...shadow, borderRadius: z(16) }}>
          <Pressable onPress={() => router.push('/compose')} style={({ pressed }) => [{ height: z(56), borderRadius: z(16), backgroundColor: C.fab, flexDirection: 'row', alignItems: 'center', paddingHorizontal: z(16), gap: z(12) }, pressed && { opacity: 0.85 }]}>
            <Sym name="edit" size={24} color={C.fabText} />
            <Animated.View style={{ maxWidth: fab.interpolate({ inputRange: [0, 1], outputRange: [0, z(110)] }), overflow: 'hidden', opacity: fab }}>
              <Text style={{ fontSize: 16, color: C.fabText, fontWeight: '600' }} numberOfLines={1}>Compose</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}

      <BottomBar tab="mail" unread={unreadBadge} showMeet={settings?.features?.meet !== false}
        onMail={() => { if (view !== 'primary') setView('primary'); else load(); }} onMeet={() => router.push('/meet')} />

      <Drawer open={drawer} onClose={() => setDrawer(false)} view={view} counts={counts} labels={labels} onPick={setView}
        onCreateLabel={createLabel} onSettings={() => router.push('/settings')} onHelp={() => router.push('/help')}
        onApp={(n) => toast(`${n} is not part of this demo`)} />
    </View>
  );
}
