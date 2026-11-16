import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { Avatar, FileIcon, Sym } from './ui';
import { countLabel, listDate } from '../lib/format';
import { C, z } from '../lib/theme';

export const CATS = {
  promotions: { label: 'Promotions', icon: 'sell', color: C.promoIcon, bg: C.promo, fg: C.promoText },
  social: { label: 'Social', icon: 'group', color: C.socialIcon, bg: C.social, fg: C.socialText },
  updates: { label: 'Updates', icon: 'info', color: C.updatesIcon, bg: C.updates, fg: C.updatesText },
};

// Row that opens a category inbox: "Promotions · ShopKart — Big sale…  [2 new]".
export function CategoryRow({ cat, info, onPress }) {
  const c = CATS[cat];
  const fresh = info && info.new > 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [rowBox, pressed && pressedBg]}>
      <View style={{ width: z(40), alignItems: 'center', paddingTop: z(4) }}><Sym name={c.icon} size={26} color={c.color} /></View>
      <View style={{ flex: 1, marginLeft: z(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 17, color: C.text, fontWeight: fresh ? '700' : '400' }}>{c.label}</Text>
          {fresh && <View style={{ backgroundColor: c.bg, borderRadius: z(10), paddingHorizontal: z(8), paddingVertical: z(2) }}><Text style={{ fontSize: 12.5, color: c.fg, fontWeight: '500' }}>{countLabel(info.new)} new</Text></View>}
        </View>
        {!!info?.subject && (
          <Text style={{ fontSize: 14.5, color: fresh ? C.text : C.muted, fontWeight: fresh ? '700' : '400', marginTop: z(4) }} numberOfLines={1}>
            {(info.senders || []).join(', ')} — {info.subject}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const rowBox = { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: z(16), paddingVertical: z(13), marginBottom: z(2), borderRadius: z(2) };
const pressedBg = { backgroundColor: '#EEF2F9' };

// One conversation in a list.
export function ThreadRow({ t, view, onPress, onLongPress, onStar, selected, selecting }) {
  const sentView = t.sentView;
  const bold = t.unread && !sentView;
  const toName = (t.to && t.to[0] && (t.to[0].name || t.to[0].email)) || '';
  const who = view === 'drafts' ? 'Draft' : sentView ? `To: ${toName}` : t.people.slice(-3).join(', ');
  const inboxChip = sentView && t.folders.includes('inbox');
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={300}
      style={({ pressed }) => [rowBox, selected && { backgroundColor: '#C2E7FF' }, pressed && !selected && pressedBg]}>
      <Pressable onPress={onLongPress} hitSlop={4}>
        {selected || selecting ? (
          <View style={{ width: z(40), height: z(40), borderRadius: z(20), backgroundColor: selected ? '#0B57D0' : '#E1E3E1', alignItems: 'center', justifyContent: 'center' }}>
            {selected && <Sym name="check" size={24} color="#fff" />}
          </View>
        ) : <Avatar name={t.avatar.name} color={t.avatar.color} photo={t.avatar.photo} size={40} />}
      </Pressable>
      <View style={{ flex: 1, marginLeft: z(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flexShrink: 1, fontSize: 17, color: view === 'drafts' ? C.red : C.text, fontWeight: bold ? '700' : '400' }} numberOfLines={1}>{who}</Text>
          {t.count > 1 && <Text style={{ fontSize: 13, color: C.muted, marginLeft: z(6), fontWeight: bold ? '700' : '400' }}>{t.count}</Text>}
          <View style={{ flex: 1 }} />
          {t.attachments.length > 0 && !sentView && <Sym name="attach_file" size={16} color={C.muted} style={{ marginRight: z(2) }} />}
          <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: 13, color: bold ? C.text : C.muted, fontWeight: bold ? '700' : '400', marginLeft: z(8) }}>{t.scheduledAt ? `⏰ ${listDate(t.scheduledAt)}` : listDate(t.date)}</Text>
          {bold && <View style={{ width: z(8), height: z(8), borderRadius: z(4), backgroundColor: C.unreadDot, marginLeft: z(6) }} />}
        </View>
        <Text style={{ fontSize: 14.5, color: C.text, fontWeight: bold ? '700' : '400', marginTop: z(2) }} numberOfLines={1}>{t.subject}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: z(2) }}>
          <Text style={{ flex: 1, fontSize: 14.5, color: C.muted }} numberOfLines={1}>{t.snippet || ' '}</Text>
          {inboxChip && <View style={{ backgroundColor: C.chipBlue, borderRadius: z(4), paddingHorizontal: z(5), paddingVertical: z(1), marginLeft: z(6) }}><Text style={{ fontSize: 11.5, color: C.chipBlueText }}>Inbox</Text></View>}
          {t.labels.slice(0, 1).map((l) => <View key={l.id} style={{ backgroundColor: '#E8EAED', borderRadius: z(4), paddingHorizontal: z(5), paddingVertical: z(1), marginLeft: z(6) }}><Text style={{ fontSize: 11.5, color: C.muted }}>{l.name}</Text></View>)}
          <Pressable hitSlop={10} onPress={onStar} style={{ marginLeft: z(10) }}>
            <Sym name="star" fill={t.starred} size={22} color={t.starred ? C.star : C.muted} />
          </Pressable>
        </View>
        {t.attachments.length > 0 && (
          <View style={{ flexDirection: 'row', gap: z(8), marginTop: z(8), flexWrap: 'wrap' }}>
            {t.attachments.slice(0, 2).map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: z(6), borderWidth: 1, borderColor: '#C4C7C5', borderRadius: z(16), paddingHorizontal: z(10), height: z(30), maxWidth: z(150) }}>
                <FileIcon type={a.type} name={a.name} size={16} />
                <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{a.name.replace(/\.[^.]+$/, '')}</Text>
              </View>
            ))}
            {t.attachments.length > 2 && <Text style={{ fontSize: 13, color: C.muted, alignSelf: 'center' }}>+{t.attachments.length - 2}</Text>}
          </View>
        )}
      </View>
    </Pressable>
  );
}
