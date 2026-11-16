import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { Avatar, IconBtn, Sym } from '../components/ui';
import { BottomBar } from '../components/Drawer';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

// Meet tab: video calling isn't part of this demo, so it explains that with the familiar layout.
export default function Meet() {
  const { account, counts, toast } = useApp();
  const insets = useSafeAreaInsets();
  if (!account) return null;
  return (
    <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: z(64), paddingHorizontal: z(8) }}>
        <IconBtn name="menu" color={C.text} onPress={() => router.replace('/inbox')} />
        <Text style={{ flex: 1, fontSize: 21, color: C.text, marginLeft: z(8) }}>Meet</Text>
        <Pressable onPress={() => router.push('/accounts')} style={{ marginRight: z(8) }}><Avatar name={account.name} color={account.color} photo={account.photo} size={34} ring /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: z(12), paddingHorizontal: z(16), marginTop: z(8) }}>
        <Pressable onPress={() => toast('Video meetings are not part of this demo')} style={{ flex: 1, height: z(44), borderRadius: z(22), backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>New meeting</Text>
        </Pressable>
        <Pressable onPress={() => toast('Video meetings are not part of this demo')} style={{ flex: 1, height: z(44), borderRadius: z(22), borderWidth: 1, borderColor: '#747775', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.blue, fontSize: 15, fontWeight: '600' }}>Join with a code</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: z(40) }}>
        <View style={{ width: z(180), height: z(180), borderRadius: z(90), backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center' }}>
          <Sym name="video_chat" size={84} color={C.blue} />
        </View>
        <Text style={{ fontSize: 22, color: C.text, marginTop: z(24), textAlign: 'center' }}>Get a link you can share</Text>
        <Text style={{ fontSize: 15, color: C.muted, marginTop: z(10), textAlign: 'center', lineHeight: 22 }}>Tap New meeting to get a link you can send to people you want to meet with</Text>
      </View>
      <BottomBar tab="meet" unread={counts?.inbox} onMail={() => router.replace('/inbox')} onMeet={() => {}} />
    </View>
  );
}
