const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
// Isolated mobile dependencies; only this explicit sibling package is shared.
config.watchFolders = [path.resolve(__dirname, '../../packages/mobile-foundation')];
module.exports = config;
