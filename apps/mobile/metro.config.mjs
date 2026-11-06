import { getDefaultConfig } from 'expo/metro-config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.dirname(fileURLToPath(import.meta.url));
const config = getDefaultConfig(project);
// Isolated mobile dependencies; only this explicit sibling package is shared.
config.watchFolders = [path.resolve(project, '../../packages/mobile-foundation')];
export default config;
