import { Dimensions, Platform } from 'react-native';

// In the browser preview the app lives in a phone-sized frame.
export const PHONE_WIDTH = 412;
// Sizes in the code were measured on a 412dp-wide screen; z() scales them to the real phone.
export const SCALE = Math.min(1, (Platform.OS === 'web' ? Math.min(Dimensions.get('window').width, PHONE_WIDTH) : Dimensions.get('window').width) / PHONE_WIDTH);
export const z = (n) => Math.round(n * SCALE * 2) / 2;

export const screenWidth = () => (Platform.OS === 'web' ? Math.min(Dimensions.get('window').width, PHONE_WIDTH) : Dimensions.get('window').width);

// Colours sampled from the reference recording (Material 3 mail app).
export const C = {
  page: '#F6F8FC', // app background (light blue-grey)
  card: '#FFFFFF', // mail rows
  text: '#1F1F1F',
  muted: '#444746',
  faint: '#747775',
  line: '#E3E3E3',
  blue: '#0B57D0', // links, "View security details"
  navSel: '#D3E3FD', // selected drawer item
  navSelText: '#041E49',
  fab: '#C2E7FF', // Compose button
  fabText: '#001D35',
  action: '#00639B', // Reply / Forward buttons
  chipBlue: '#D3E3FD',
  chipBlueText: '#0842A0',
  badge: '#B3261E', // 99+ badge
  promo: '#A8DAB5', promoText: '#0D652D', promoIcon: '#188038',
  social: '#A8C7FA', socialText: '#0842A0', socialIcon: '#1A73E8',
  updates: '#FFB683', updatesText: '#6B2A00', updatesIcon: '#E8710A',
  star: '#F4B400',
  unreadDot: '#0B57D0',
  red: '#D93025',
  green: '#188038',
  infoBg: '#F2F2F2',
  brand: '#D93025', // wordmark red
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};
