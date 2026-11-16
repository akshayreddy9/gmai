import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Linking, Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { Sym } from './Sym';
import { useApp } from '../lib/store';
import { getServerUrl } from '../lib/api';
import { initial } from '../lib/format';
import { C, z } from '../lib/theme';

export { Sym };
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/inbox'));

// Round avatar: photo, or a coloured circle with the first letter.
export function Avatar({ name, color, photo, size = 40, ring, style }) {
  const d = z(size);
  const inner = photo
    ? <Image source={{ uri: photo }} style={{ width: d, height: d, borderRadius: d / 2 }} />
    : (
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color || '#5C6BC0', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: size * 0.45, fontWeight: '500', includeFontPadding: false }}>{initial(name)}</Text>
      </View>
    );
  if (!ring) return <View style={style}>{inner}</View>;
  return (
    <View style={[{ padding: z(2.5), borderRadius: d, borderWidth: z(2.5), borderColor: '#4285F4' }, style]}>{inner}</View>
  );
}

// Generic person icon (grey circle) used for senders without a name letter style.
export function PersonIcon({ size = 40 }) {
  const d = z(size);
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: '#9AA0A6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Sym name="person" fill size={size * 0.78} color="#fff" style={{ marginTop: d * 0.18 }} />
    </View>
  );
}

export function IconBtn({ name, onPress, color = C.muted, size = 24, fill, style, badge }) {
  return (
    <Pressable hitSlop={8} onPress={onPress} style={({ pressed }) => [{ width: z(44), height: z(44), borderRadius: z(22), alignItems: 'center', justifyContent: 'center' }, pressed && { backgroundColor: 'rgba(0,0,0,0.06)' }, style]}>
      <Sym name={name} fill={fill} size={size} color={color} />
      {badge}
    </Pressable>
  );
}

// Material circular spinner.
export function Spinner({ size = 36, style }) {
  return <View style={[{ alignItems: 'center', justifyContent: 'center', padding: z(24) }, style]}><ActivityIndicator size={z(size)} color={C.blue} /></View>;
}

// Dark snackbar at the bottom ("Conversation archived · Undo").
export function Snackbar() {
  const { snack, hideSnack } = useApp();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (snack) { y.setValue(0); Animated.timing(y, { toValue: 1, duration: 180, useNativeDriver: true }).start(); } }, [snack, y]);
  if (!snack) return null;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: z(12), right: z(12), bottom: insets.bottom + z(80), opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <View style={{ backgroundColor: '#313033', borderRadius: z(6), minHeight: z(48), flexDirection: 'row', alignItems: 'center', paddingLeft: z(16), paddingRight: z(6) }}>
        <Text style={{ flex: 1, color: '#F4EFF4', fontSize: 14, paddingVertical: z(12) }}>{snack.text}</Text>
        {snack.action && (
          <Pressable hitSlop={6} onPress={() => { hideSnack(); snack.action.fn(); }} style={{ paddingHorizontal: z(12), paddingVertical: z(10) }}>
            <Text style={{ color: '#A8C7FA', fontSize: 14, fontWeight: '600' }}>{snack.action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// Bottom sheet.
export function Sheet({ visible, onClose, title, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.32)' }} onPress={onClose} />
      <View style={{ backgroundColor: '#F3F6FC', borderTopLeftRadius: z(28), borderTopRightRadius: z(28), paddingTop: z(10), paddingBottom: insets.bottom + z(12), maxHeight: '85%' }}>
        <View style={{ width: z(32), height: z(4), borderRadius: 2, backgroundColor: '#79747E', alignSelf: 'center', marginBottom: z(12), opacity: 0.4 }} />
        {!!title && <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, paddingHorizontal: z(24), marginBottom: z(8) }}>{title}</Text>}
        {children}
      </View>
    </Modal>
  );
}

export function MenuItem({ icon, label, onPress, color = C.text, right }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#ddd' }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: z(18), paddingHorizontal: z(24), height: z(52) }, pressed && { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
      {!!icon && <Sym name={icon} size={22} color={color === C.text ? C.muted : color} />}
      <Text style={{ flex: 1, fontSize: 15.5, color }}>{label}</Text>
      {right}
    </Pressable>
  );
}

// Light formatting for message bodies: "# Banner", "**bold**", "- bullets", links and emails.
export function Body({ text, style, size = 16 }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ t: 'p', lines: para }); para = []; } };
  lines.forEach((l) => {
    if (/^#\s+/.test(l)) { flush(); blocks.push({ t: 'h', text: l.replace(/^#\s+/, '') }); }
    else if (/^\s*[-•]\s+/.test(l)) { flush(); blocks.push({ t: 'li', text: l.replace(/^\s*[-•]\s+/, '') }); }
    else if (/^##-.*-##$/.test(l.trim())) { flush(); blocks.push({ t: 'muted', text: l.trim() }); }
    else if (!l.trim()) flush();
    else para.push(l);
  });
  flush();
  return (
    <View style={style}>
      {blocks.map((b, k) => {
        if (b.t === 'h') return <View key={k} style={{ backgroundColor: '#9B2CF0', paddingHorizontal: z(18), paddingVertical: z(16), marginBottom: z(14) }}><Text style={{ color: '#fff', fontSize: size * 1.55, lineHeight: size * 1.85 }}>{b.text}</Text></View>;
        if (b.t === 'li') return <View key={k} style={{ flexDirection: 'row', paddingLeft: z(14), marginBottom: z(6) }}><Text style={{ fontSize: size, color: C.text, width: z(16) }}>•</Text><Inline text={b.text} size={size} /></View>;
        if (b.t === 'muted') return <Text key={k} style={{ fontSize: size * 0.82, color: '#9AA0A6', marginBottom: z(12) }}>{b.text}</Text>;
        return <View key={k} style={{ marginBottom: z(14) }}>{b.lines.map((l, i) => <Inline key={i} text={l} size={size} />)}</View>;
      })}
    </View>
  );
}

function Inline({ text, size }) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ s: text.slice(last, m.index) });
    const v = m[0];
    if (v.startsWith('**')) parts.push({ s: v.slice(2, -2), b: true });
    else parts.push({ s: v, link: v.includes('@') && !v.startsWith('http') ? `mailto:${v}` : v });
    last = m.index + v.length;
  }
  if (last < text.length) parts.push({ s: text.slice(last) });
  return (
    <Text style={{ flex: 1, fontSize: size, color: C.text, lineHeight: size * 1.38 }}>
      {parts.map((p, i) => (p.link
        ? <Text key={i} style={{ color: C.blue, textDecorationLine: 'underline' }} onPress={() => (p.link.startsWith('mailto:') ? router.push({ pathname: '/compose', params: { to: p.s } }) : Linking.openURL(p.link))}>{p.s}</Text>
        : <Text key={i} style={p.b ? { fontWeight: '700' } : null}>{p.s}</Text>))}
    </Text>
  );
}

// Link to download/view an attachment with the active session.
export const fileUrl = (id, token, download) => `${getServerUrl()}/api/files/${id}?token=${encodeURIComponent(token || '')}${download ? '&download=1' : ''}`;

// Red/blue/grey file-type badge.
export function FileIcon({ type = '', name = '', size = 18 }) {
  const pdf = /pdf/.test(type) || /\.pdf$/i.test(name);
  const img = /^image\//.test(type);
  const doc = /word|document/.test(type) || /\.docx?$/i.test(name);
  const color = pdf ? '#D93025' : img ? '#D93025' : doc ? '#4285F4' : '#5F6368';
  const label = pdf ? 'PDF' : null;
  if (label) {
    return <View style={{ backgroundColor: color, borderRadius: z(2), paddingHorizontal: z(2), height: z(size * 0.8), justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{label}</Text></View>;
  }
  return <Sym name={img ? 'image' : doc ? 'description' : 'draft'} fill size={size} color={color} />;
}
