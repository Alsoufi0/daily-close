// Metro config for the WebView shell inside an npm-workspaces monorepo.
//
// The web app pins React 18; this mobile app is on React 19 (Expo SDK 54), so
// npm keeps TWO copies of React (mobile's nested 19, the root's 18). Without
// pinning, Metro can bundle both and you get the dreaded "Invalid hook call /
// multiple copies of React" crash. We extend expo/metro-config, watch the
// whole workspace, resolve from both node_modules trees, and pin the React
// singletons to THIS package's copies.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native")
};

module.exports = config;
