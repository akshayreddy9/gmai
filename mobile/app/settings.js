import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../components/Text';
import { Avatar, IconBtn, Sheet, Sym } from '../components/ui';
import { ServerLink } from '../components/forms';
import { post, put } from '../lib/api';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

function Row({ title, sub, onPress, right }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ paddingHorizontal: z(24), paddingVertical: z(14), flexDirection: 'row', alignItems: 'center' }, pressed && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: C.text }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 13.5, color: C.muted, marginTop: z(3) }} numberOfLines={2}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

// Account settings: name, photo, signature, password, sign out.
export default function Settings() {
  const { account, settings, updateAccount, toast, signOut } = useApp();
  const insets = useSafeAreaInsets();
  const [edit, setEdit] = useState(null);
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  if (!account) return null;

  const save = async (body, msg) => {
    try { const r = await put('/me', body); await updateAccount(r.account); toast(msg); setEdit(null); } catch (e) { toast(e.message); }
  };
  const photo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.4, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    save({ photo: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` }, 'Profile picture updated');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: z(60), paddingHorizontal: z(4) }}>
        <IconBtn name="arrow_back" color={C.text} onPress={() => router.back()} />
        <Text style={{ fontSize: 20, color: C.text, marginLeft: z(8) }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + z(30) }}>
        <View style={{ alignItems: 'center', paddingVertical: z(16) }}>
          <Pressable onPress={photo}>
            <Avatar name={account.name} color={account.color} photo={account.photo} size={84} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: z(28), height: z(28), borderRadius: z(14), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E3E3E3' }}>
              <Sym name="photo_camera" size={16} color={C.text} />
            </View>
          </Pressable>
          <Text style={{ fontSize: 22, color: C.text, marginTop: z(12) }}>{account.name}</Text>
          <Text style={{ fontSize: 14.5, color: C.muted, marginTop: z(2) }}>{account.email}</Text>
        </View>
        <Text style={{ fontSize: 13.5, color: C.blue, fontWeight: '600', paddingHorizontal: z(24), marginTop: z(8) }}>Account</Text>
        <Row title="Your name" sub={account.name} onPress={() => { setValue(account.name); setEdit('name'); }} />
        <Row title="Mobile signature" sub={account.signature || 'Not set'} onPress={() => { setValue(account.signature || ''); setEdit('signature'); }} />
        <Row title="Change password" onPress={() => { setValue(''); setValue2(''); setEdit('password'); }} />
        {account.photo && <Row title="Remove profile picture" onPress={() => save({ photo: null }, 'Profile picture removed')} />}
        <Text style={{ fontSize: 13.5, color: C.blue, fontWeight: '600', paddingHorizontal: z(24), marginTop: z(18) }}>App</Text>
        <Row title="About" sub={`${settings?.appName || 'Gmai'} ${settings?.appVersion || ''} · demo mail app. Mail is delivered only between ${settings?.domain || 'gmai.app'} and other addresses created in the admin panel.`} />
        <Row title="Sign out" sub={`Remove ${account.email} from this device`} onPress={async () => { const next = await signOut(); router.replace(next ? '/inbox' : '/welcome'); }} />
        <ServerLink />
      </ScrollView>

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit === 'name' ? 'Your name' : edit === 'signature' ? 'Mobile signature' : 'Change password'}>
        <View style={{ paddingHorizontal: z(24) }}>
          <TextInput value={value} onChangeText={setValue} autoFocus multiline={edit === 'signature'} secureTextEntry={edit === 'password'}
            placeholder={edit === 'password' ? 'Current password' : ''} placeholderTextColor={C.faint}
            style={{ borderBottomWidth: 2, borderColor: C.blue, fontSize: 16, color: C.text, paddingVertical: z(8), outlineStyle: 'none' }} />
          {edit === 'password' && (
            <TextInput value={value2} onChangeText={setValue2} secureTextEntry placeholder="New password (6+ characters)" placeholderTextColor={C.faint}
              style={{ borderBottomWidth: 2, borderColor: C.blue, fontSize: 16, color: C.text, paddingVertical: z(8), marginTop: z(14), outlineStyle: 'none' }} />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: z(8), marginTop: z(16) }}>
            <Pressable onPress={() => setEdit(null)} style={{ paddingHorizontal: z(14), height: z(40), justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '600' }}>Cancel</Text></Pressable>
            <Pressable onPress={async () => {
              if (edit === 'password') {
                try { await post('/me/password', { oldPassword: value, newPassword: value2 }); toast('Password changed'); setEdit(null); } catch (e) { toast(e.message); }
              } else save({ [edit]: value }, 'Saved');
            }} style={{ paddingHorizontal: z(14), height: z(40), justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '600' }}>Save</Text></Pressable>
          </View>
        </View>
      </Sheet>
    </View>
  );
}
