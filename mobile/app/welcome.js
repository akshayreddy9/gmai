import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Sym } from '../components/ui';
import { Field, ServerLink } from '../components/forms';
import { Logo } from '../components/Logo';
import { post } from '../lib/api';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

// Sign in with an email address and password (also used for "Add another account").
export default function Welcome() {
  const { add } = useLocalSearchParams();
  const { signIn, settings } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const domain = settings?.domain || 'gmai.app';
  const name = settings?.appName || 'Gmai';

  const submit = async () => {
    if (!email.trim()) { setError('Enter an email'); return; }
    setBusy(true); setError('');
    try {
      const r = await post('/auth/login', { email: email.trim(), password });
      await signIn(r.token, r.account, r.settings);
      router.replace('/inbox');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + z(24), paddingHorizontal: z(24), paddingBottom: insets.bottom + z(16) }} keyboardShouldPersistTaps="handled">
        {add ? <Pressable hitSlop={10} onPress={() => router.back()} style={{ marginBottom: z(12) }}><Sym name="arrow_back" size={26} color={C.text} /></Pressable> : null}
        <Logo size={44} />
        <Text style={{ fontSize: 30, color: C.text, marginTop: z(22) }}>{add ? 'Add another account' : 'Sign in'}</Text>
        <Text style={{ fontSize: 16, color: C.muted, marginTop: z(10) }}>with your {name} Account. This account will be available to the {name} app.</Text>

        <Field label="Email" value={email} onChangeText={(t) => { setEmail(t); setError(''); }} keyboardType="email-address" autoFocus={!!add}
          right={!email.includes('@') && email ? <Text style={{ color: C.faint, fontSize: 16 }}>@{domain}</Text> : null} />
        <Field label="Password" value={password} onChangeText={(t) => { setPassword(t); setError(''); }} secure={!show} error={error} onSubmitEditing={submit}
          right={<Pressable hitSlop={8} onPress={() => setShow(!show)}><Sym name={show ? 'visibility_off' : 'visibility'} size={22} color={C.muted} /></Pressable>} />
        <Text style={{ fontSize: 13, color: C.muted, marginTop: z(12) }}>Demo: akshay@{domain} / demo123</Text>

        <View style={{ flex: 1, minHeight: z(40) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {settings?.allowSignup !== false && settings?.features?.signup !== false ? (
            <Pressable onPress={() => router.push('/signup')} style={{ paddingVertical: z(10) }}>
              <Text style={{ color: C.blue, fontSize: 15, fontWeight: '600' }}>Create account</Text>
            </Pressable>
          ) : <View />}
          <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [{ backgroundColor: C.blue, borderRadius: z(20), paddingHorizontal: z(26), height: z(40), justifyContent: 'center', opacity: busy ? 0.6 : 1 }, pressed && { opacity: 0.85 }]}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{busy ? 'Signing in…' : 'Next'}</Text>
          </Pressable>
        </View>
        <ServerLink />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
