import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from './Text';
import { Sheet, Sym } from './ui';
import { getServerUrl, setServerUrl } from '../lib/api';
import { C, z } from '../lib/theme';

// Outlined Material text field with a floating label.
export function Field({ label, value, onChangeText, secure, autoFocus, keyboardType, error, right, onSubmitEditing }) {
  const [focus, setFocus] = useState(false);
  const up = focus || !!value;
  return (
    <View style={{ marginTop: z(18) }}>
      <View style={{ borderWidth: focus ? 2 : 1, borderColor: error ? C.red : focus ? C.blue : '#747775', borderRadius: z(6), height: z(56), justifyContent: 'center', paddingHorizontal: focus ? z(13) : z(14), flexDirection: 'row', alignItems: 'center' }}>
        <TextInput value={value} onChangeText={onChangeText} secureTextEntry={secure} autoFocus={autoFocus} keyboardType={keyboardType} autoCapitalize="none" autoCorrect={false}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={onSubmitEditing}
          style={{ flex: 1, fontSize: 16, color: C.text, paddingTop: z(6), outlineStyle: 'none' }} />
        {right}
        <Text pointerEvents="none" style={{ position: 'absolute', left: z(10), top: up ? -z(10) : z(17), paddingHorizontal: z(4), backgroundColor: '#fff', fontSize: up ? 12 : 16, color: error ? C.red : focus ? C.blue : C.muted }}>{label}</Text>
      </View>
      {!!error && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: z(6), marginTop: z(6) }}>
          <Sym name="error" fill size={16} color={C.red} />
          <Text style={{ flex: 1, fontSize: 12.5, color: C.red }}>{error}</Text>
        </View>
      )}
    </View>
  );
}

export function ServerLink() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  return (
    <>
      <Pressable onPress={() => { setUrl(getServerUrl()); setOpen(true); }} style={{ alignSelf: 'center', padding: z(10) }}>
        <Text style={{ fontSize: 12, color: C.faint }}>Server: {getServerUrl().replace(/^https?:\/\//, '')}</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Server address">
        <View style={{ paddingHorizontal: z(24), paddingBottom: z(8) }}>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" style={{ borderWidth: 1, borderColor: '#747775', borderRadius: z(6), height: z(50), paddingHorizontal: z(12), fontSize: 15, color: C.text, backgroundColor: '#fff' }} />
          <Pressable onPress={async () => { await setServerUrl(url); setOpen(false); }} style={{ alignSelf: 'flex-end', marginTop: z(14), backgroundColor: C.blue, borderRadius: z(20), paddingHorizontal: z(22), height: z(40), justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
}

