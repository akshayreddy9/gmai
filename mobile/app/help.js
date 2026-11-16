import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { IconBtn } from '../components/ui';
import { useApp } from '../lib/store';
import { C, z } from '../lib/theme';

const FAQ = [
  ['How do I add another mail ID?', 'Tap your profile picture at the top right, then "Add another account" and sign in. Switch between accounts from the same place, and pick which one to send from in Compose.'],
  ['Who can I send mail to?', 'Anyone with an address in this app. Mail to other addresses bounces back with "Address not found", just like a real mail service.'],
  ['Where are my sent and scheduled emails?', 'Open the menu (☰) and choose Sent or Scheduled. Drafts are saved automatically when you leave Compose.'],
  ['How do I undo archive or delete?', 'Tap Undo on the message at the bottom of the screen, or find the conversation in All mail or Trash.'],
  ['I forgot my password', 'Ask the administrator to reset it from the admin panel.'],
];

export default function Help() {
  const { settings } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.page, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: z(60), paddingHorizontal: z(4) }}>
        <IconBtn name="arrow_back" color={C.text} onPress={() => router.back()} />
        <Text style={{ fontSize: 20, color: C.text, marginLeft: z(8) }}>Help & feedback</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: z(16), paddingBottom: insets.bottom + z(30) }}>
        {FAQ.map(([q, a]) => (
          <View key={q} style={{ backgroundColor: '#fff', borderRadius: z(16), padding: z(16), marginBottom: z(10) }}>
            <Text style={{ fontSize: 16, color: C.text, fontWeight: '600' }}>{q}</Text>
            <Text style={{ fontSize: 14.5, color: C.muted, marginTop: z(6), lineHeight: 21 }}>{a}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 12.5, color: C.faint, textAlign: 'center', marginTop: z(10) }}>{settings?.appName || 'Gmai'} {settings?.appVersion || ''} · college demo project</Text>
      </ScrollView>
    </View>
  );
}
