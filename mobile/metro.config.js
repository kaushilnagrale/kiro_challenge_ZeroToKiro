const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Include global node_modules that Metro resolves outside the project root
config.watchFolders = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve('C:\\Users\\kaush\\node_modules'),
];

// Ensure the resolver checks local node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
