import { Platform, Pressable, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FONTS, Text } from '../components/Text';
import { SYMBOL_FONTS } from '../components/Sym';
import { Snackbar, Sym } from '../components/ui';
import { useOtaUpdates } from '../lib/updates';
import { AppProvider, useApp } from '../lib/store';
import { C, z } from '../lib/theme';

function Notice({ icon, title, text, action, onAction }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: z(32) }}>
      <Sym name={icon} size={64} color={C.blue} />
      <Text style={{ fontSize: 22, color: C.text, marginTop: z(18), textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 15, color: C.muted, marginTop: z(10), textAlign: 'center', lineHeight: 22 }}>{text}</Text>
      {!!action && (
        <Pressable onPress={onAction} style={{ marginTop: z(24), backgroundColor: C.blue, borderRadius: z(20), paddingHorizontal: z(24), height: z(40), justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Shell() {
  const { account, settings, blocked, signOut } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: C.page } }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="inbox" options={{ animation: 'fade' }} />
        <Stack.Screen name="compose" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="accounts" options={{ animation: 'fade', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />
      </Stack>
      {account && settings?.maintenanceMode && <Notice icon="construction" title="We'll be back soon" text={settings.maintenanceMessage} />}
      {account && blocked && (
        <Notice icon="no_accounts" title="Signed out" text={`${account.email} was signed out or suspended by the administrator.`} action="OK"
          onAction={async () => { const next = await signOut(); router.replace(next ? '/inbox' : '/welcome'); }} />
      )}
      <Snackbar />
    </View>
  );
}

// Browser preview: show the app inside a phone-sized frame.
function Frame({ children }) {
  if (Platform.OS !== 'web') return children;
  return (
    <View style={{ flex: 1, backgroundColor: '#E8EAED', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: '100%', maxWidth: 412, height: '100%', maxHeight: 900, backgroundColor: C.page, overflow: 'hidden', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  useOtaUpdates();
  const [fontsLoaded, fontError] = useFonts({ ...FONTS, ...SYMBOL_FONTS });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  return (
    <Frame>
      <SafeAreaProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </SafeAreaProvider>
    </Frame>
  );
}
