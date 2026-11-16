import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Logo } from '../components/Logo';
import { useApp } from '../lib/store';
import { z } from '../lib/theme';

// Splash: app mark, then the inbox (or sign-in when no account is on this device).
export default function Splash() {
  const { booted, account } = useApp();
  useEffect(() => {
    if (!booted) return undefined;
    const t = setTimeout(() => router.replace(account ? '/inbox' : '/welcome'), 500);
    return () => clearTimeout(t);
  }, [booted, account]);
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={88} />
      <View style={{ height: z(60) }} />
    </View>
  );
}
