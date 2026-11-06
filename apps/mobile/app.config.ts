import type { ExpoConfig } from 'expo/config';

// No API credentials or customer data in this public build configuration.
const config: ExpoConfig = {
  name: 'Gridex El', slug: 'gridex-el', version: '0.1.0',
  orientation: 'portrait', userInterfaceStyle: 'dark',
  scheme: 'gridex-el-dev',
  ios: { bundleIdentifier: 'se.gridex.el.dev' },
  android: { package: 'se.gridex.el.dev' },
  updates: { enabled: false },
};
export default config;
