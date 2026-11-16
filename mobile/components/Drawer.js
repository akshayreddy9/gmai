import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from './Text';
import { Sheet, Sym } from './ui';
import { Wordmark } from './Logo';
import { CATS } from './mail';
import { countLabel } from '../lib/format';
import { C, screenWidth, z } from '../lib/theme';

export const VIEW_TITLES = {
  inbox: 'All inboxes', primary: 'Primary', promotions: 'Promotions', social: 'Social', updates: 'Updates', starred: 'Starred', snoozed: 'Snoozed',
  important: 'Important', purchases: 'Purchases', sent: 'Sent', scheduled: 'Scheduled', outbox: 'Outbox', drafts: 'Drafts', all: 'All mail', spam: 'Spam', trash: 'Trash',
};
const LABEL_ITEMS = [
  ['starred', 'star', 'count'], ['snoozed', 'schedule', 'count'], ['important', 'label_important', 'unread'], ['purchases', 'shopping_bag', 'unread'],
  ['sent', 'send'], ['scheduled', 'schedule_send', 'count'], ['outbox', 'outbox', 'count'], ['drafts', 'draft', 'count'], ['all', 'mail', 'unread'],
  ['spam', 'report', 'unread'], ['trash', 'delete'],
];

function Item({ icon, label, active, onPress, right, iconColor }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', height: z(52), marginHorizontal: z(10), paddingHorizontal: z(18), borderRadius: z(26), backgroundColor: active ? C.navSel : 'transparent' }, pressed && !active && { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
      <Sym name={icon} fill={active} size={24} color={iconColor || (active ? C.navSelText : C.muted)} />
      <Text style={{ flex: 1, marginLeft: z(22), fontSize: 16, color: active ? C.navSelText : C.text, fontWeight: active ? '600' : '400' }} numberOfLines={1}>{label}</Text>
      {right}
    </Pressable>
  );
}
const Count = ({ n, active }) => (n ? <Text style={{ fontSize: 13.5, color: active ? C.navSelText : C.muted, fontWeight: active ? '600' : '400' }}>{countLabel(n)}</Text> : null);
const NewPill = ({ cat, n }) => (n ? <View style={{ backgroundColor: CATS[cat].bg, borderRadius: z(12), paddingHorizontal: z(9), paddingVertical: z(3) }}><Text style={{ fontSize: 13, color: CATS[cat].fg, fontWeight: '500' }}>{countLabel(n)} new</Text></View> : null);
const Section = ({ children }) => <Text style={{ fontSize: 13.5, color: C.muted, marginLeft: z(28), marginTop: z(14), marginBottom: z(6) }}>{children}</Text>;

// Slide-in side menu: inboxes, categories, all labels, user labels, settings.
export function Drawer({ open, onClose, view, counts, labels, onPick, onCreateLabel, onSettings, onHelp, onApp }) {
  const insets = useSafeAreaInsets();
  const w = Math.min(screenWidth() * 0.84, z(340));
  const x = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(open);
  const [newLabel, setNewLabel] = useState(null);
  useEffect(() => {
    if (open) setShown(true);
    Animated.timing(x, { toValue: open ? 1 : 0, duration: open ? 240 : 180, useNativeDriver: true }).start(() => { if (!open) setShown(false); });
  }, [open, x]);
  if (!shown) return null;
  const c = counts || {};
  const pick = (v) => { onPick(v); onClose(); };
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.38)', opacity: x }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w, backgroundColor: '#F8FAFD', borderTopRightRadius: z(16), borderBottomRightRadius: z(16), transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] }) }] }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + z(14), paddingBottom: insets.bottom + z(20) }} showsVerticalScrollIndicator={false}>
          <Wordmark size={24} style={{ marginLeft: z(28), marginBottom: z(16) }} />
          <View style={{ height: 1, backgroundColor: '#E0E3E7', marginBottom: z(8) }} />
          <Item icon="all_inbox" label="All inboxes" active={view === 'inbox'} onPress={() => pick('inbox')} right={<Count n={c.inbox} active={view === 'inbox'} />} />
          <View style={{ height: 1, backgroundColor: '#E0E3E7', marginVertical: z(8) }} />
          <Item icon="inbox" label="Primary" active={view === 'primary'} onPress={() => pick('primary')} right={<Count n={c.primary} active={view === 'primary'} />} />
          {['promotions', 'social', 'updates'].map((k) => (
            <Item key={k} icon={CATS[k].icon} label={CATS[k].label} active={view === k} onPress={() => pick(k)} right={<NewPill cat={k} n={c[k]?.new} />} />
          ))}
          <Section>All labels</Section>
          {LABEL_ITEMS.map(([k, icon, mode]) => (
            <Item key={k} icon={icon} label={VIEW_TITLES[k]} active={view === k} onPress={() => pick(k)} right={mode ? <Count n={c[k]} active={view === k} /> : null} />
          ))}
          {(labels || []).map((l) => (
            <Item key={l.id} icon="label" iconColor={l.color} label={l.name} active={view === `label:${l.id}`} onPress={() => pick(`label:${l.id}`)} right={<Count n={c.labels?.[l.id]} />} />
          ))}
          <Item icon="add" label="Create label" onPress={() => setNewLabel('')} />
          <Section>Apps</Section>
          <Item icon="calendar_today" label="Calendar" onPress={() => onApp('Calendar')} />
          <Item icon="account_circle" label="Contacts" onPress={() => onApp('Contacts')} />
          <View style={{ height: 1, backgroundColor: '#E0E3E7', marginVertical: z(8) }} />
          <Item icon="settings" label="Settings" onPress={() => { onClose(); onSettings(); }} />
          <Item icon="help" label="Help & feedback" onPress={() => { onClose(); onHelp(); }} />
        </ScrollView>
      </Animated.View>
      <Sheet visible={newLabel !== null} onClose={() => setNewLabel(null)} title="New label">
        <View style={{ paddingHorizontal: z(24) }}>
          <TextInput value={newLabel || ''} onChangeText={setNewLabel} autoFocus placeholder="Label name" placeholderTextColor={C.faint}
            style={{ borderBottomWidth: 2, borderColor: C.blue, fontSize: 16, color: C.text, paddingVertical: z(8), outlineStyle: 'none' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: z(8), marginTop: z(16) }}>
            <Pressable onPress={() => setNewLabel(null)} style={{ paddingHorizontal: z(14), height: z(40), justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '600' }}>Cancel</Text></Pressable>
            <Pressable onPress={async () => { if (await onCreateLabel(newLabel)) setNewLabel(null); }} style={{ paddingHorizontal: z(14), height: z(40), justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '600' }}>Create</Text></Pressable>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

// Bottom navigation: Mail (with unread badge) and Meet.
export function BottomBar({ tab, unread, onMail, onMeet, showMeet = true }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#F3F6FC', paddingBottom: insets.bottom, height: z(64) + insets.bottom, borderTopWidth: 0 }}>
      <Pressable onPress={onMail} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: z(64), height: z(32), borderRadius: z(16), backgroundColor: tab === 'mail' ? '#C2E7FF' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <Sym name="mail" fill={tab === 'mail'} size={24} color={tab === 'mail' ? '#001D35' : C.muted} />
          {!!unread && (
            <View style={{ position: 'absolute', left: z(34), top: -z(4), backgroundColor: C.badge, borderRadius: z(9), minWidth: z(18), height: z(18), paddingHorizontal: z(4), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{countLabel(unread)}</Text>
            </View>
          )}
        </View>
      </Pressable>
      {showMeet && (
        <Pressable onPress={onMeet} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: z(64), height: z(32), borderRadius: z(16), backgroundColor: tab === 'meet' ? '#C2E7FF' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <Sym name="videocam" fill={tab === 'meet'} size={24} color={tab === 'meet' ? '#001D35' : C.muted} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
