import { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../components/Text';
import { Avatar, FileIcon, IconBtn, MenuItem, Sheet, Spinner, Sym } from '../components/ui';
import { api, get } from '../lib/api';
import { useApp } from '../lib/store';
import { fileSize, fullDate, quoteDate } from '../lib/format';
import { C, z } from '../lib/theme';

const parse = (s) => String(s || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const fmt = (a) => (a.name && a.name !== a.email ? `${a.name} <${a.email}>` : a.email);
const strip = (subj, p) => (new RegExp(`^${p}:`, 'i').test(subj) ? subj : `${p}: ${subj}`);

// Recipient field with chips and suggestions.
function Recipients({ label, list, setList, token, right, autoFocus }) {
  const [text, setText] = useState('');
  const [sugg, setSugg] = useState([]);
  useEffect(() => {
    const q = text.trim();
    if (!q) { setSugg([]); return undefined; }
    const t = setTimeout(() => api('GET', `/contacts?q=${encodeURIComponent(q)}`, null, token).then((r) => setSugg(r.contacts.filter((c) => !list.includes(c.email)))).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [text, token, list]);
  const add = (v) => { const items = parse(v); if (items.length) setList([...list, ...items.filter((x) => !list.includes(x))]); setText(''); setSugg([]); };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: z(54), paddingHorizontal: z(16), borderBottomWidth: 1, borderColor: C.line, flexWrap: 'wrap', paddingVertical: z(6) }}>
        <Text style={{ fontSize: 16, color: C.muted, width: z(52) }}>{label}</Text>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: z(6) }}>
          {list.map((e) => (
            <Pressable key={e} onPress={() => setList(list.filter((x) => x !== e))} style={{ flexDirection: 'row', alignItems: 'center', gap: z(6), borderWidth: 1, borderColor: '#C4C7C5', borderRadius: z(16), paddingLeft: z(4), paddingRight: z(10), height: z(30) }}>
              <Avatar name={e.replace(/^.*</, '')} color="#5C6BC0" size={22} />
              <Text style={{ fontSize: 14, color: C.text, maxWidth: z(200) }} numberOfLines={1}>{e.replace(/\s*<.*>$/, '') || e}</Text>
            </Pressable>
          ))}
          <TextInput value={text} onChangeText={(v) => (/[,;\s]$/.test(v) && v.trim() ? add(v) : setText(v))} onSubmitEditing={() => add(text)} onBlur={() => text.trim() && add(text)}
            autoFocus={autoFocus} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
            style={{ flex: 1, minWidth: z(120), fontSize: 16, color: C.text, paddingVertical: z(6), outlineStyle: 'none' }} />
        </View>
        {right}
      </View>
      {sugg.length > 0 && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line }}>
          {sugg.slice(0, 5).map((c) => (
            <Pressable key={c.email} onPress={() => add(c.email)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: z(14), paddingHorizontal: z(16), height: z(56) }, pressed && { backgroundColor: '#F1F3F4' }]}>
              <Avatar name={c.name} color={c.color} photo={c.photo} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: C.text }} numberOfLines={1}>{c.name}</Text>
                <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{c.email}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// New mail, reply, reply all, forward and drafts.
export default function Compose() {
  const p = useLocalSearchParams();
  const { account, sessions, settings, toast, refreshCounts, bump } = useApp();
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState(account?.email);
  const [to, setTo] = useState(parse(p.to));
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [ctx, setCtx] = useState({ threadId: null, inReplyTo: null });
  const draftId = p.draftId || null;
  const [ready, setReady] = useState(!(p.mode || p.draftId));
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const done = useRef(false);
  useEffect(() => { if (!from && account) setFrom(account.email); }, [from, account]);
  const session = sessions.find((s) => s.account.email === from) || sessions[0];
  const token = session?.token;
  const sig = session?.account.signature ? `\n\n--\n${session.account.signature}` : '';

  // Prefill for reply / forward / draft.
  useEffect(() => {
    (async () => {
      try {
        if (p.draftId) {
          const { draft } = await get(`/drafts/${p.draftId}`);
          setTo(draft.to.map(fmt)); setCc(draft.cc.map(fmt)); setBcc(draft.bcc.map(fmt)); setShowCc(!!(draft.cc.length || draft.bcc.length));
          setSubject(draft.subject); setBody(draft.body); setFiles(draft.attachments || []); setCtx({ threadId: draft.threadId, inReplyTo: draft.inReplyTo });
        } else if (p.mode && p.tid) {
          const { thread } = await get(`/threads/${p.tid}`);
          const m = thread.messages.find((x) => x.id === p.mid) || thread.messages[thread.messages.length - 1];
          const quote = `\n\n${quoteDate(m.date)} ${m.from.name || ''} <${m.from.email}> wrote:\n${String(m.body).split('\n').map((l) => `> ${l}`).join('\n')}`;
          if (p.mode === 'forward') {
            setSubject(strip(m.subject, 'Fwd'));
            setBody(`${p.body || ''}${sig}\n\n---------- Forwarded message ---------\nFrom: ${m.from.name} <${m.from.email}>\nDate: ${fullDate(m.date)}\nSubject: ${m.subject}\nTo: ${m.to.map(fmt).join(', ')}\n\n${m.body}`);
            setFiles(m.attachments || []);
          } else {
            const mine = m.from.email === account.email;
            const primaryTo = mine ? m.to.map(fmt) : [fmt(m.from)];
            setTo(primaryTo);
            if (p.mode === 'replyAll') {
              const others = [...m.to, ...m.cc].filter((a) => a.email !== account.email && a.email !== m.from.email).map(fmt);
              if (others.length) { setCc(others); setShowCc(true); }
            }
            setSubject(strip(m.subject, 'Re'));
            setBody(`${p.body || ''}${sig}${quote}`);
            setCtx({ threadId: thread.tid, inReplyTo: m.id });
          }
        } else if (sig) setBody(sig);
      } catch (e) { toast(e.message); }
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasContent = () => to.length || cc.length || subject.trim() || body.replace(sig, '').trim() || files.length;
  const payload = () => ({ to, cc, bcc, subject, body, attachments: files.map((f) => f.id), threadId: ctx.threadId, inReplyTo: ctx.inReplyTo });

  const saveDraft = async () => {
    if (done.current || !hasContent()) return;
    done.current = true;
    try { await api('POST', '/drafts', { id: draftId, ...payload() }, token); toast('Draft saved'); refreshCounts(); bump(); } catch (e) { toast(e.message); }
  };
  const close = async () => { await saveDraft(); router.back(); };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  });

  const send = async (scheduledAt) => {
    if (!to.length && !cc.length && !bcc.length) { toast('Add at least one recipient'); return; }
    setBusy(true);
    try {
      const r = await api('POST', '/send', { ...payload(), draftId, scheduledAt }, token);
      done.current = true;
      router.back();
      if (r.scheduled) toast('Send scheduled');
      else toast(r.bounced.length ? `Sent. ${r.bounced.length} address${r.bounced.length > 1 ? 'es' : ''} not found` : 'Sent', { label: 'View message', fn: () => router.push({ pathname: '/thread/[tid]', params: { tid: r.threadId } }) });
      refreshCounts(); bump();
    } catch (e) { toast(e.message); setBusy(false); }
  };

  const attach = async () => {
    if (settings?.features?.attachments === false) { toast('Attachments are turned off by the admin'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const name = a.fileName || `IMG_${Date.now()}.jpg`;
    try {
      toast('Uploading…');
      const r = await api('POST', '/files', { name, type: a.mimeType || 'image/jpeg', data: a.base64 }, token);
      setFiles((f) => [...f, r.file]);
      toast('Attached');
    } catch (e) { toast(e.message); }
  };

  const schedule = (days, hour) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); setSheet(null); send(d.getTime()); };
  const nextMonday = () => { const d = new Date(); return ((8 - d.getDay()) % 7) || 7; };

  if (!account) return null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: z(60), paddingHorizontal: z(4) }}>
        <IconBtn name="arrow_back" color={C.text} onPress={close} />
        <Text style={{ flex: 1, fontSize: 20, color: C.text, marginLeft: z(8) }}>{p.mode === 'forward' ? 'Forward' : p.mode ? 'Reply' : 'Compose'}</Text>
        <IconBtn name="attach_file" color={C.muted} onPress={attach} />
        <IconBtn name="send" color={busy ? C.faint : C.muted} onPress={() => !busy && send()} />
        <IconBtn name="more_vert" color={C.muted} onPress={() => setSheet('more')} />
      </View>
      {!ready ? <Spinner /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + z(30) }}>
          <Pressable onPress={() => sessions.length > 1 && setSheet('from')} style={{ flexDirection: 'row', alignItems: 'center', height: z(54), paddingHorizontal: z(16), borderBottomWidth: 1, borderColor: C.line }}>
            <Text style={{ fontSize: 16, color: C.muted, width: z(52) }}>From</Text>
            <Text style={{ flex: 1, fontSize: 16, color: C.text }} numberOfLines={1}>{from}</Text>
            {sessions.length > 1 && <Sym name="arrow_drop_down" size={26} color={C.muted} />}
          </Pressable>
          <Recipients label="To" list={to} setList={setTo} token={token} autoFocus={!p.mode && !p.draftId && !to.length}
            right={<Pressable hitSlop={8} onPress={() => setShowCc(!showCc)}><Sym name={showCc ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={24} color={C.muted} /></Pressable>} />
          {showCc && <Recipients label="Cc" list={cc} setList={setCc} token={token} />}
          {showCc && <Recipients label="Bcc" list={bcc} setList={setBcc} token={token} />}
          <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={C.muted}
            style={{ fontSize: 16, color: C.text, height: z(54), paddingHorizontal: z(16), borderBottomWidth: 1, borderColor: C.line, outlineStyle: 'none' }} />
          {files.length > 0 && (
            <View style={{ paddingHorizontal: z(16), paddingTop: z(12), gap: z(8) }}>
              {files.map((f) => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: z(10), borderWidth: 1, borderColor: C.line, borderRadius: z(10), paddingHorizontal: z(12), height: z(48) }}>
                  <FileIcon type={f.type} name={f.name} size={20} />
                  <Text style={{ flex: 1, fontSize: 14, color: C.text }} numberOfLines={1}>{f.name}</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>{fileSize(f.size)}</Text>
                  <Pressable hitSlop={8} onPress={() => setFiles(files.filter((x) => x.id !== f.id))}><Sym name="close" size={20} color={C.muted} /></Pressable>
                </View>
              ))}
            </View>
          )}
          <TextInput value={body} onChangeText={setBody} placeholder="Compose email" placeholderTextColor={C.muted} multiline autoFocus={!!p.mode}
            style={{ fontSize: 16, color: C.text, minHeight: z(260), paddingHorizontal: z(16), paddingTop: z(16), textAlignVertical: 'top', outlineStyle: 'none' }} />
        </ScrollView>
      )}

      <Sheet visible={sheet === 'from'} onClose={() => setSheet(null)} title="Send from">
        {sessions.map((s) => (
          <Pressable key={s.account.email} onPress={() => { setFrom(s.account.email); setSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: z(14), paddingHorizontal: z(24), height: z(60) }}>
            <Avatar name={s.account.name} color={s.account.color} photo={s.account.photo} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: C.text }}>{s.account.name}</Text>
              <Text style={{ fontSize: 13, color: C.muted }}>{s.account.email}</Text>
            </View>
            {s.account.email === from && <Sym name="check" size={22} color={C.blue} />}
          </Pressable>
        ))}
      </Sheet>
      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)}>
        <MenuItem icon="schedule_send" label="Schedule send" onPress={() => setSheet('schedule')} />
        <MenuItem icon="save" label="Save draft" onPress={async () => { setSheet(null); await saveDraft(); router.back(); }} />
        <MenuItem icon="delete" label="Discard" onPress={async () => { setSheet(null); done.current = true; if (draftId) await api('DELETE', `/drafts/${draftId}`, null, token).catch(() => {}); refreshCounts(); bump(); router.back(); }} />
      </Sheet>
      <Sheet visible={sheet === 'schedule'} onClose={() => setSheet(null)} title="Schedule send">
        <MenuItem icon="wb_sunny" label="Tomorrow morning · 8:00 AM" onPress={() => schedule(1, 8)} />
        <MenuItem icon="light_mode" label="Tomorrow afternoon · 1:00 PM" onPress={() => schedule(1, 13)} />
        <MenuItem icon="work" label="Monday morning · 8:00 AM" onPress={() => schedule(nextMonday(), 8)} />
        <MenuItem icon="timer" label="In 1 minute (demo)" onPress={() => { setSheet(null); send(Date.now() + 60000); }} />
      </Sheet>
      {busy && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)' }} />}
    </KeyboardAvoidingView>
  );
}
