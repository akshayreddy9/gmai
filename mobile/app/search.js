import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../components/Text';
import { IconBtn, Sheet, MenuItem, Spinner, Sym } from '../components/ui';
import { ThreadRow } from '../components/mail';
import { VIEW_TITLES } from '../components/Drawer';
import { api, get } from '../lib/api';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

const LABEL_OPTIONS = ['all', 'inbox', 'sent', 'starred', 'important', 'drafts', 'spam', 'trash'];
const DATES = [['', 'Any time'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['365', 'Last year']];

function Chip({ label, on, onPress, caret = true }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: z(2), height: z(34), borderRadius: z(8), borderWidth: on ? 0 : 1, borderColor: '#747775', backgroundColor: on ? C.fab : 'transparent', paddingLeft: z(14), paddingRight: caret ? z(8) : z(14) }}>
      <Text style={{ fontSize: 14, color: on ? C.fabText : C.muted, fontWeight: '500' }}>{label}</Text>
      {caret && <Sym name="arrow_drop_down" size={22} color={on ? C.fabText : C.muted} />}
    </Pressable>
  );
}

// Search with Gmail-style filter chips: label, from, to, attachment, date.
export default function Search() {
  const { toast } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [label, setLabel] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [attachment, setAttachment] = useState(false);
  const [unread, setUnread] = useState(false);
  const [days, setDays] = useState('');
  const [sheet, setSheet] = useState(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const active = q.trim() || label !== 'all' || from || to || attachment || unread || days;

  useEffect(() => {
    if (!active) { setResults(null); return undefined; }
    const t = setTimeout(() => {
      const ps = new URLSearchParams({ view: label, q: q.trim(), from, to, attachment: attachment ? '1' : '', unread: unread ? '1' : '' });
      if (days) ps.set('after', String(Date.now() - Number(days) * 86400000));
      get(`/threads?${ps.toString()}`).then((r) => setResults(r.threads)).catch((e) => toast(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, label, from, to, attachment, unread, days, active, toast]);

  const star = (t) => { setResults((l) => l.map((x) => (x.tid === t.tid ? { ...x, starred: !t.starred } : x))); api('PATCH', `/threads/${t.tid}`, { starred: !t.starred }).catch(() => {}); };

  return (
    <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: z(64), paddingHorizontal: z(8), gap: z(4) }}>
        <IconBtn name="arrow_back" color={C.text} onPress={() => router.back()} />
        <View style={{ flex: 1, height: z(48), borderRadius: z(24), backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: z(16) }}>
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Search in mail" placeholderTextColor={C.muted} returnKeyType="search"
            style={{ flex: 1, fontSize: 17, color: C.text, outlineStyle: 'none' }} />
          {q ? <Pressable hitSlop={8} onPress={() => setQ('')}><Sym name="close" size={22} color={C.muted} /></Pressable> : <Sym name="auto_awesome" fill size={22} color={C.text} />}
        </View>
      </View>
      {showFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: z(14), gap: z(8), paddingBottom: z(10) }}>
          <Chip label={label === 'all' ? 'Label' : VIEW_TITLES[label]} on={label !== 'all'} onPress={() => setSheet('label')} />
          <Chip label={from ? `From: ${from}` : 'From'} on={!!from} onPress={() => { setText(from); setSheet('from'); }} />
          <Chip label={to ? `To: ${to}` : 'To'} on={!!to} onPress={() => { setText(to); setSheet('to'); }} />
          <Chip label="Attachment" on={attachment} caret={false} onPress={() => setAttachment(!attachment)} />
          <Chip label={days ? DATES.find((d) => d[0] === days)[1] : 'Date'} on={!!days} onPress={() => setSheet('date')} />
          <Chip label="Is unread" on={unread} caret={false} onPress={() => setUnread(!unread)} />
        </ScrollView>
      )}
      {!active ? (
        <View style={{ alignItems: 'center', marginTop: z(80), paddingHorizontal: z(32) }}>
          <Sym name="search" size={56} color="#C4C7C5" />
          <Text style={{ fontSize: 15, color: C.muted, marginTop: z(12), textAlign: 'center' }}>Search your mail by words, people or attachments. Use the chips to narrow it down.</Text>
        </View>
      ) : !results ? <Spinner /> : (
        <FlatList
          data={results}
          keyExtractor={(t) => t.tid}
          contentContainerStyle={{ paddingHorizontal: z(8), paddingBottom: insets.bottom + z(30) }}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: z(10), paddingBottom: z(10) }}>
              <Text style={{ flex: 1, fontSize: 14.5, color: C.muted }}>{label === 'all' ? 'All mail' : VIEW_TITLES[label]}{results.length ? ` · ${results.length}` : ''}</Text>
              <Pressable onPress={() => setShowFilters(!showFilters)} style={{ flexDirection: 'row', alignItems: 'center', gap: z(6) }}>
                <Sym name="filter_list" size={20} color={C.muted} />
                <Text style={{ fontSize: 14.5, color: C.text }}>{showFilters ? 'Hide filters' : 'Show filters'}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => <ThreadRow t={item} view={label} onPress={() => router.push({ pathname: '/thread/[tid]', params: { tid: item.tid } })} onStar={() => star(item)} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: C.muted, marginTop: z(50), fontSize: 15 }}>No results found</Text>}
        />
      )}

      <Sheet visible={sheet === 'label'} onClose={() => setSheet(null)} title="Label">
        {LABEL_OPTIONS.map((k) => <MenuItem key={k} icon={k === label ? 'radio_button_checked' : 'radio_button_unchecked'} label={VIEW_TITLES[k]} onPress={() => { setLabel(k); setSheet(null); }} />)}
      </Sheet>
      <Sheet visible={sheet === 'date'} onClose={() => setSheet(null)} title="Date">
        {DATES.map(([k, l]) => <MenuItem key={k} icon={k === days ? 'radio_button_checked' : 'radio_button_unchecked'} label={l} onPress={() => { setDays(k); setSheet(null); }} />)}
      </Sheet>
      <Sheet visible={sheet === 'from' || sheet === 'to'} onClose={() => setSheet(null)} title={sheet === 'from' ? 'From' : 'To'}>
        <View style={{ paddingHorizontal: z(24) }}>
          <TextInput value={text} onChangeText={setText} autoFocus autoCapitalize="none" placeholder="Name or email" placeholderTextColor={C.faint}
            style={{ borderBottomWidth: 2, borderColor: C.blue, fontSize: 16, color: C.text, paddingVertical: z(8), outlineStyle: 'none' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: z(8), marginTop: z(16) }}>
            <Pressable onPress={() => { (sheet === 'from' ? setFrom : setTo)(''); setSheet(null); }} style={{ paddingHorizontal: z(14), height: z(40), justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '600' }}>Clear</Text></Pressable>
            <Pressable onPress={() => { (sheet === 'from' ? setFrom : setTo)(text.trim()); setSheet(null); }} style={{ paddingHorizontal: z(14), height: z(40), justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '600' }}>Apply</Text></Pressable>
          </View>
        </View>
      </Sheet>
    </View>
  );
}
