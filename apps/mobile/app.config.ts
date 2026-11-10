import type { ExpoConfig } from 'expo/config';

// No API credentials or customer data in this public build configuration.
const config: ExpoConfig = {
  name: 'Gridex El', slug: 'gridex-el', version: '0.1.0',
  orientation: 'portrait', userInterfaceStyle: 'dark',
  scheme: 'gridex-el-dev',
  ios: { bundleIdentifier: 'se.gridex.el.dev', buildNumber: '1', supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: { package: 'se.gridex.el.dev', versionCode: 1 },
  updates: { enabled: false },
  plugins: ['expo-secure-store'],
};
export default config;
