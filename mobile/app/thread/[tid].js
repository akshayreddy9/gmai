import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/Text';
import { Avatar, Body, FileIcon, IconBtn, MenuItem, Sheet, Spinner, Sym, fileUrl, goBack } from '../../components/ui';
import { BottomBar } from '../../components/Drawer';
import { api, get } from '../../lib/api';
import { useApp, useLive } from '../../lib/store';
import { fileSize, fullDate, headerDate } from '../../lib/format';
import { C, z } from '../../lib/theme';

const QUOTE_RE = /\n(On .+ wrote:\n[\s\S]*)$/;
const FOLDER_CHIP = { inbox: 'Inbox', sent: 'Sent', spam: 'Spam', trash: 'Trash', scheduled: 'Scheduled' };

// Very small extractive summary: the most informative sentences of the latest message.
function summarize(text) {
  const clean = String(text || '').replace(QUOTE_RE, '').replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/^##-.*-##$/gm, '');
  const sentences = clean.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 25 && !/^(hi|dear|hello|regards|thanks|best|sincerely|warm)/i.test(s));
  return sentences.slice(0, 3);
}

const DRow = ({ k, v, children }) => (
  <View style={{ flexDirection: 'row', marginBottom: z(10) }}>
    <Text style={{ width: z(58), fontSize: 13.5, color: C.muted }}>{k}</Text>
    <View style={{ flex: 1 }}>{children || <Text style={{ fontSize: 13.5, color: C.text }}>{v}</Text>}</View>
  </View>
);

function Details({ m, accountEmail }) {
  const line = (list) => list.map((a) => (a.email === accountEmail ? `me` : `${a.name ? `${a.name} • ` : ''}${a.email}`)).join(', ');
  return (
    <View style={{ backgroundColor: '#F2F5FA', borderRadius: z(12), padding: z(14), marginTop: z(12) }}>
      <DRow k="From" v={`${m.from.name ? `${m.from.name} • ` : ''}${m.from.email}`} />
      <DRow k="To" v={line(m.to)} />
      {m.cc?.length > 0 && <DRow k="Cc" v={line(m.cc)} />}
      {m.bcc?.length > 0 && <DRow k="Bcc" v={line(m.bcc)} />}
      <DRow k="Date" v={fullDate(m.date)} />
      <DRow k={<Sym name="lock" size={16} color={C.muted} />}>
        <Text style={{ fontSize: 13.5, color: C.text }}>Standard encryption (TLS).</Text>
        <Text style={{ fontSize: 13.5, color: C.blue, marginTop: z(2) }}>View security details</Text>
      </DRow>
    </View>
  );
}

function Attachments({ list, token }) {
  if (!list?.length) return null;
  return (
    <View style={{ marginTop: z(4), gap: z(10) }}>
      {list.map((a) => {
        const img = /^image\//.test(a.type) && !a.demo;
        return (
          <View key={a.id} style={{ borderRadius: z(12), overflow: 'hidden', backgroundColor: '#F2F5FA', borderWidth: 1, borderColor: '#E3E3E3' }}>
            {img ? <Image source={{ uri: fileUrl(a.id, token) }} style={{ width: '100%', height: z(150) }} resizeMode="cover" />
              : <View style={{ height: z(90), alignItems: 'center', justifyContent: 'center' }}><FileIcon type={a.type} name={a.name} size={34} /></View>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: z(10), backgroundColor: '#fff', paddingHorizontal: z(12), height: z(46) }}>
              <FileIcon type={a.type} name={a.name} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: C.text }} numberOfLines={1}>{a.name}</Text>
                {!!a.size && <Text style={{ fontSize: 11.5, color: C.muted }}>{fileSize(a.size)}</Text>}
              </View>
              <Pressable hitSlop={8} onPress={() => Linking.openURL(fileUrl(a.id, token, true))}><Sym name="download" size={22} color={C.muted} /></Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Message({ m, last, expanded, onToggle, accountEmail, token, onReply, onMore }) {
  const [details, setDetails] = useState(false);
  const [quoted, setQuoted] = useState(false);
  if (!expanded) {
    return (
      <Pressable onPress={onToggle} style={{ backgroundColor: '#fff', paddingHorizontal: z(16), paddingVertical: z(14), flexDirection: 'row', gap: z(14), marginTop: z(2) }}>
        <Avatar name={m.avatar.name} color={m.avatar.color} photo={m.avatar.photo} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flexShrink: 1, fontSize: 16, color: C.text, fontWeight: m.read ? '500' : '700' }} numberOfLines={1}>{m.mine ? 'me' : m.from.name || m.from.email}</Text>
            <Text style={{ fontSize: 12.5, color: C.muted, marginLeft: z(6) }} numberOfLines={1}>{headerDate(m.date)}</Text>
          </View>
          <Text style={{ fontSize: 14, color: C.muted, marginTop: z(2) }} numberOfLines={2}>{String(m.body).replace(QUOTE_RE, '').replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()}</Text>
        </View>
      </Pressable>
    );
  }
  const quote = String(m.body).match(QUOTE_RE);
  const main = quote ? String(m.body).slice(0, quote.index) : m.body;
  return (
    <View style={{ backgroundColor: '#fff', paddingHorizontal: z(16), paddingTop: z(14), paddingBottom: z(18), marginTop: z(2) }}>
      <View style={{ flexDirection: 'row', gap: z(14) }}>
        <Pressable onPress={last ? undefined : onToggle}><Avatar name={m.avatar.name} color={m.avatar.color} photo={m.avatar.photo} size={40} /></Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flexShrink: 1, fontSize: 16, color: C.text, fontWeight: '600' }} numberOfLines={1}>{m.mine ? (m.from.name || 'me') : m.from.name || m.from.email}</Text>
            <Text style={{ fontSize: 12.5, color: C.muted, marginLeft: z(6) }} numberOfLines={1}>{headerDate(m.date)}</Text>
          </View>
          <Pressable onPress={() => setDetails(!details)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: z(2) }}>
            <Text style={{ fontSize: 13.5, color: C.muted }} numberOfLines={1}>to {m.toLine || 'me'}</Text>
            <Sym name={details ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={18} color={C.muted} />
          </Pressable>
        </View>
        <IconBtn name="add_reaction" size={22} onPress={() => onReply('reply', '👍')} style={{ width: z(36) }} />
        <IconBtn name="reply" size={22} onPress={() => onReply('reply')} style={{ width: z(36) }} />
        <IconBtn name="more_vert" size={22} onPress={() => onMore(m)} style={{ width: z(30) }} />
      </View>
      {details && <Details m={m} accountEmail={accountEmail} />}
      <Body text={main} style={{ marginTop: z(16) }} />
      {quote && (
        <>
          <Pressable onPress={() => setQuoted(!quoted)}><Text style={{ fontSize: 14.5, color: C.blue, marginBottom: z(10) }}>{quoted ? 'Hide quoted text' : 'Show quoted text'}</Text></Pressable>
          {quoted && <View style={{ borderLeftWidth: 2, borderColor: '#C4C7C5', paddingLeft: z(12) }}><Body text={quote[1].replace(/^> ?/gm, '')} size={14} /></View>}
        </>
      )}
      <Attachments list={m.attachments} token={token} />
    </View>
  );
}

export default function Thread() {
  const { tid } = useLocalSearchParams();
  const { account, activeToken, settings, toast, refreshCounts, counts } = useApp();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState(null);
  const [open, setOpen] = useState({});
  const [summary, setSummary] = useState(null);
  const [menu, setMenu] = useState(null);
  const [labels, setLabels] = useState([]);

  useLive(() => {
    get(`/threads/${tid}`).then((r) => {
      setT(r.thread);
      if (r.thread.unread) api('PATCH', `/threads/${tid}`, { read: true }).then(refreshCounts).catch(() => {});
    }).catch((e) => { toast(e.message); goBack(); });
  }, [tid]);
  useEffect(() => { get('/labels').then((r) => setLabels(r.labels)).catch(() => {}); }, []);

  if (!t || !account) return <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}><Spinner style={{ flex: 1 }} /></View>;
  const msgs = t.messages;
  const last = msgs[msgs.length - 1];
  const folder = t.folders.includes('inbox') ? 'inbox' : t.folders.includes('spam') ? 'spam' : t.folders.includes('trash') ? 'trash' : t.folders[0];
  const many = new Set([...last.to, ...last.cc, last.from].map((a) => a.email).filter((e) => e !== account.email)).size > 1;

  const act = async (body, msg, back = true) => {
    try {
      await api('PATCH', `/threads/${tid}`, body);
      refreshCounts();
      if (msg) toast(msg, body.move ? { label: 'Undo', fn: async () => { await api('PATCH', `/threads/${tid}`, { move: 'inbox' }); refreshCounts(); } } : undefined);
      if (back) goBack();
    } catch (e) { toast(e.message); }
  };
  const reply = (mode, text, m = last) => router.push({ pathname: '/compose', params: { mode, tid, mid: m.id, body: text || '' } });
  const sugg = settings?.features?.smartReply !== false && !last.mine ? ['Thank you!', 'Got it, thanks.', "I'll check and get back to you."] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: z(60), paddingHorizontal: z(4) }}>
        <IconBtn name="arrow_back" color={C.text} onPress={goBack} />
        <View style={{ flex: 1 }} />
        {settings?.features?.summarize !== false && <IconBtn name="auto_awesome" fill color={C.text} onPress={() => setSummary(summary ? null : summarize(last.body))} />}
        {folder === 'inbox' ? <IconBtn name="archive" color={C.text} onPress={() => act({ move: 'archive' }, 'Conversation archived')} />
          : <IconBtn name="move_to_inbox" color={C.text} onPress={() => act({ move: 'inbox' }, 'Moved to Inbox', false)} />}
        <IconBtn name="delete" color={C.text} onPress={() => (folder === 'trash' ? api('DELETE', `/threads/${tid}`).then(() => { toast('Deleted forever'); refreshCounts(); goBack(); }) : act({ move: 'trash' }, 'Conversation moved to Trash'))} />
        <IconBtn name="mark_email_unread" color={C.text} onPress={() => act({ read: false }, null)} />
        <IconBtn name="more_vert" color={C.text} onPress={() => setMenu('thread')} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: z(20) }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: z(18), paddingTop: z(4), paddingBottom: z(12) }}>
          <Text style={{ flex: 1, fontSize: 23, color: C.text, lineHeight: 31 }}>
            {t.subject}{'  '}
            {!!FOLDER_CHIP[folder] && <Text style={{ fontSize: 12.5, color: C.chipBlueText, backgroundColor: C.chipBlue }}>{` ${FOLDER_CHIP[folder]} `}</Text>}
            {t.labels.map((l) => <Text key={l.id} style={{ fontSize: 12.5, color: C.muted, backgroundColor: '#E8EAED' }}>{`  ${l.name} `}</Text>)}
          </Text>
          <Pressable hitSlop={10} onPress={() => { setT({ ...t, starred: !t.starred }); act({ starred: !t.starred }, null, false); }} style={{ paddingTop: z(4), paddingLeft: z(10) }}>
            <Sym name="star" fill={t.starred} size={26} color={t.starred ? C.star : C.muted} />
          </Pressable>
        </View>

        {settings?.features?.summarize !== false && (
          <Pressable onPress={() => setSummary(summary ? null : summarize(last.body))} style={{ marginHorizontal: z(14), marginBottom: z(10), backgroundColor: '#fff', borderRadius: z(16), padding: z(14) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: z(10) }}>
              <Sym name="notes" size={20} color={C.muted} />
              <Text style={{ fontSize: 15, color: C.text }}>Summarize this email</Text>
            </View>
            {summary && (
              <View style={{ marginTop: z(10) }}>
                {(summary.length ? summary : ['This email is short — there is nothing more to summarize.']).map((s, i) => <Text key={i} style={{ fontSize: 14, color: C.muted, lineHeight: 20, marginTop: z(4) }}>• {s}</Text>)}
              </View>
            )}
          </Pressable>
        )}

        {msgs.map((m, i) => (
          <Message key={m.id} m={m} last={i === msgs.length - 1} expanded={i === msgs.length - 1 || open[m.id]} accountEmail={account.email} token={activeToken}
            onToggle={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))} onReply={(mode, text) => reply(mode, text, m)} onMore={(mm) => setMenu(mm)} />
        ))}

        {sugg.length > 0 && (
          <View style={{ paddingHorizontal: z(14), marginTop: z(12) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: z(8), marginBottom: z(8) }}>
              <Sym name="auto_fix_high" size={18} color={C.muted} />
              <Text style={{ fontSize: 14, color: C.muted }}>Suggested reply</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: z(8) }}>
              {sugg.map((s) => (
                <Pressable key={s} onPress={() => reply('reply', s)} style={{ borderWidth: 1, borderColor: '#C4C7C5', borderRadius: z(8), paddingHorizontal: z(12), paddingVertical: z(8), backgroundColor: '#fff' }}>
                  <Text style={{ fontSize: 14, color: C.muted }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: z(10), paddingHorizontal: z(12), paddingVertical: z(10) }}>
        {many && <Pressable onPress={() => reply('reply')} style={btn(true)}><Sym name="reply" size={22} color="#fff" /></Pressable>}
        <Pressable onPress={() => reply(many ? 'replyAll' : 'reply')} style={btn()}><Sym name={many ? 'reply_all' : 'reply'} size={20} color="#fff" /><Text style={btnText}>{many ? 'Reply all' : 'Reply'}</Text></Pressable>
        <Pressable onPress={() => reply('forward')} style={btn()}><Sym name="forward" size={20} color="#fff" /><Text style={btnText}>Forward</Text></Pressable>
        <Pressable onPress={() => reply('reply', '👍')} style={[btn(true), { backgroundColor: C.action }]}><Sym name="add_reaction" size={22} color="#fff" /></Pressable>
      </View>
      <BottomBar tab="mail" unread={counts?.inbox} showMeet={settings?.features?.meet !== false} onMail={() => router.replace('/inbox')} onMeet={() => router.push('/meet')} />

      <Sheet visible={!!menu} onClose={() => setMenu(null)}>
        {menu === 'thread' ? (
          <>
            {folder === 'inbox' && ['primary', 'promotions', 'social', 'updates'].filter((c) => c !== t.category).slice(0, 3).map((c) => (
              <MenuItem key={c} icon="drive_file_move" label={`Move to ${c[0].toUpperCase() + c.slice(1)}`} onPress={() => { setMenu(null); act({ category: c }, `Moved to ${c}`, false); }} />
            ))}
            {settings?.features?.snooze !== false && <MenuItem icon="schedule" label="Snooze until tomorrow" onPress={() => { setMenu(null); const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); act({ snoozeUntil: d.getTime() }, 'Snoozed until tomorrow, 8:00 AM'); }} />}
            <MenuItem icon={t.important ? 'label_important_outline' : 'label_important'} label={t.important ? 'Mark not important' : 'Mark important'} onPress={() => { setMenu(null); setT({ ...t, important: !t.important }); act({ important: !t.important }, t.important ? 'Marked not important' : 'Marked important', false); }} />
            {labels.map((l) => {
              const on = t.labels.some((x) => x.id === l.id);
              return <MenuItem key={l.id} icon="label" label={on ? `Remove label "${l.name}"` : `Label as "${l.name}"`} onPress={() => { setMenu(null); act(on ? { removeLabel: l.id } : { addLabel: l.id }, on ? 'Label removed' : `Labelled ${l.name}`, false).then(() => get(`/threads/${tid}`).then((r) => setT(r.thread))); }} />;
            })}
            <MenuItem icon={folder === 'spam' ? 'report_off' : 'report'} label={folder === 'spam' ? 'Not spam' : 'Report spam'} onPress={() => { setMenu(null); act({ move: folder === 'spam' ? 'inbox' : 'spam' }, folder === 'spam' ? 'Moved to Inbox' : 'Reported as spam'); }} />
          </>
        ) : menu && (
          <>
            <MenuItem icon="reply" label="Reply" onPress={() => { setMenu(null); reply('reply', '', menu); }} />
            <MenuItem icon="reply_all" label="Reply all" onPress={() => { setMenu(null); reply('replyAll', '', menu); }} />
            <MenuItem icon="forward" label="Forward" onPress={() => { setMenu(null); reply('forward', '', menu); }} />
            <MenuItem icon="mark_email_unread" label="Mark unread from here" onPress={() => { setMenu(null); api('PATCH', `/messages/${menu.id}`, { read: false }).then(() => { refreshCounts(); goBack(); }); }} />
            <MenuItem icon="star" label={menu.starred ? 'Remove star' : 'Add star'} onPress={() => { setMenu(null); api('PATCH', `/messages/${menu.id}`, { starred: !menu.starred }).then(() => get(`/threads/${tid}`).then((r) => setT(r.thread))); }} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const btn = (round) => ({ height: z(48), borderRadius: z(24), backgroundColor: C.action, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: z(8), ...(round ? { width: z(48) } : { flex: 1 }) });
const btnText = { color: '#fff', fontSize: 15.5, fontWeight: '600' };
