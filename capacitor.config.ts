import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lorebook',
  appName: 'Lorebook',
  webDir: 'dist',
  android: {
    backgroundColor: '#faf8f4',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#e9a23b',
    },
  },
};

export default config;
