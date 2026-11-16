import { Image, View } from 'react-native';
import { Text } from './Text';
import { Sym } from './Sym';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

// App mark (original): blue rounded tile with a white envelope.
export function Logo({ size = 48 }) {
  const { settings } = useApp() || {};
  const d = z(size);
  if (settings?.appIcon) return <Image source={{ uri: settings.appIcon }} style={{ width: d, height: d, borderRadius: d * 0.24 }} />;
  return (
    <View style={{ width: d, height: d, borderRadius: d * 0.24, backgroundColor: '#1A73E8', alignItems: 'center', justifyContent: 'center' }}>
      <Sym name="mail" fill size={size * 0.6} color="#fff" />
    </View>
  );
}

// Red wordmark shown at the top of the side menu.
export function Wordmark({ size = 22, style }) {
  const { settings } = useApp() || {};
  return <Text style={[{ fontSize: size, color: C.brand, fontWeight: '500', letterSpacing: -0.2 }, style]}>{settings?.appName || 'Gmai'}</Text>;
}
