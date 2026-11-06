import { getDefaultConfig } from 'expo/metro-config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.dirname(fileURLToPath(import.meta.url));
const config = getDefaultConfig(project);
// Isolated mobile dependencies; only these reviewed sibling packages are shared.
config.watchFolders = [path.resolve(project, '../../packages/mobile-foundation'), path.resolve(project, '../../packages/customer-backend')];
export default config;
