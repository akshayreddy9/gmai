import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Sym } from '../components/ui';
import { Logo } from '../components/Logo';
import { Field } from '../components/forms';
import { post } from '../lib/api';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

// Create a new address on the app's domain (name@gmai.app).
export default function Signup() {
  const { signIn, settings } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const domain = settings?.domain || 'gmai.app';

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await post('/auth/register', { name, username, password });
      await signIn(r.token, r.account, r.settings);
      router.dismissAll?.();
      router.replace('/inbox');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + z(16), paddingHorizontal: z(24), paddingBottom: insets.bottom + z(16) }} keyboardShouldPersistTaps="handled">
        <Pressable hitSlop={10} onPress={() => router.back()} style={{ marginBottom: z(12) }}><Sym name="arrow_back" size={26} color={C.text} /></Pressable>
        <Logo size={44} />
        <Text style={{ fontSize: 30, color: C.text, marginTop: z(22) }}>Create a {settings?.appName || 'Gmai'} Account</Text>
        <Text style={{ fontSize: 16, color: C.muted, marginTop: z(10) }}>Enter your name and choose your address</Text>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Username" value={username} onChangeText={(t) => setUsername(t.replace(/\s/g, '').toLowerCase())}
          right={<Text style={{ color: C.faint, fontSize: 16 }}>@{domain}</Text>} />
        <Field label="Password" value={password} onChangeText={setPassword} secure error={error} onSubmitEditing={submit} />
        <Text style={{ fontSize: 13, color: C.muted, marginTop: z(10) }}>Use 6 or more characters</Text>
        <View style={{ flex: 1, minHeight: z(40) }} />
        <Pressable onPress={submit} disabled={busy} style={{ alignSelf: 'flex-end', backgroundColor: C.blue, borderRadius: z(20), paddingHorizontal: z(26), height: z(40), justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{busy ? 'Creating…' : 'Next'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
