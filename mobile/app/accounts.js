import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Avatar, Sym } from '../components/ui';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import { countLabel } from '../lib/format';
import { C, z } from '../lib/theme';

const Row = ({ icon, label, onPress, color = C.text }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: z(18), paddingHorizontal: z(22), height: z(56), backgroundColor: '#fff', marginTop: z(2) }, pressed && { backgroundColor: '#F1F3F4' }]}>
    <Sym name={icon} size={24} color={color === C.text ? C.muted : color} />
    <Text style={{ fontSize: 15.5, color }}>{label}</Text>
  </Pressable>
);

// Account switcher: the current account on top, every other signed-in mail ID with its unread count.
export default function Accounts() {
  const { account, sessions, switchTo, signOut, counts } = useApp();
  const insets = useSafeAreaInsets();
  const [unread, setUnread] = useState({});
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    sessions.forEach((s) => {
      api('GET', '/counts', null, s.token).then((r) => setUnread((u) => ({ ...u, [s.account.email]: r.counts.inbox }))).catch(() => setUnread((u) => ({ ...u, [s.account.email]: -1 })));
    });
  }, [sessions]);

  if (!account) return null;
  const others = sessions.filter((s) => s.account.email !== account.email);
  const pick = async (email) => { await switchTo(email); router.back(); };

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F4F9', paddingTop: insets.top }}>
      <View style={{ height: z(56), alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: z(12) }}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={{ padding: z(8) }}><Sym name="close" size={26} color={C.text} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: z(14), paddingBottom: insets.bottom + z(24) }}>
        <View style={{ borderRadius: z(28), overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: z(14), gap: z(14) }}>
            <Pressable onPress={() => { router.back(); router.push('/settings'); }}>
              <Avatar name={account.name} color={account.color} photo={account.photo} size={60} ring />
              <View style={{ position: 'absolute', right: -z(2), bottom: z(2), width: z(24), height: z(24), borderRadius: z(12), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E3E3E3' }}>
                <Sym name="edit" size={14} color={C.text} />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, color: C.text }} numberOfLines={1}>{account.name}</Text>
              <Text style={{ fontSize: 14.5, color: C.muted, marginTop: z(2) }} numberOfLines={1}>{account.email}</Text>
            </View>
            <Pressable hitSlop={8} onPress={() => setExpanded(!expanded)} style={{ width: z(36), height: z(36), borderRadius: z(18), backgroundColor: '#E9EEF6', alignItems: 'center', justifyContent: 'center' }}>
              <Sym name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={24} color={C.text} />
            </Pressable>
          </View>
          {expanded && others.map((s) => {
            const n = unread[s.account.email];
            return (
              <Pressable key={s.account.email} onPress={() => pick(s.account.email)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: z(16), backgroundColor: '#fff', paddingHorizontal: z(20), paddingVertical: z(12), marginTop: z(2) }, pressed && { backgroundColor: '#F1F3F4' }]}>
                <Avatar name={s.account.name} color={s.account.color} photo={s.account.photo} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: C.text }} numberOfLines={1}>{s.account.name}</Text>
                  <Text style={{ fontSize: 13.5, color: C.muted }} numberOfLines={1}>{s.account.email}</Text>
                </View>
                {n === -1 ? <Text style={{ fontSize: 12, color: C.red }}>Signed out</Text> : n ? <Text style={{ fontSize: 13, color: C.muted }}>{countLabel(n)}</Text> : null}
              </Pressable>
            );
          })}
          {expanded && (
            <>
              <Row icon="person_add" label="Add another account" onPress={() => { router.back(); router.push({ pathname: '/welcome', params: { add: '1' } }); }} />
              <Row icon="manage_accounts" label="Manage your account" onPress={() => { router.back(); router.push('/settings'); }} />
              <Row icon="logout" label={`Sign out of ${account.email}`} onPress={async () => { const next = await signOut(); router.back(); router.replace(next ? '/inbox' : '/welcome'); }} />
            </>
          )}
        </View>
        <Text style={{ textAlign: 'center', fontSize: 12.5, color: C.muted, marginTop: z(18) }}>{counts?.inbox ? `${countLabel(counts.inbox)} unread in this account · ` : ''}Privacy Policy · Terms of Service</Text>
      </ScrollView>
    </View>
  );
}
