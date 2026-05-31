// Custom entry point — required because we're in an npm workspaces monorepo.
//
// Expo's default entry is `expo/AppEntry.js`, which does `import App from
// '../../App'` (path relative to node_modules/expo). That assumes the project
// has its own node_modules at the project root, but with workspaces npm hoists
// node_modules to the repo root, so `../../App` lands at the repo root — not
// `apps/mobile/App`. The build then fails with "Unable to resolve module".
//
// Defining our own entry here and pointing `"main"` in package.json at it
// gives the path a stable anchor (`./App` relative to apps/mobile/) that works
// the same whether node_modules is hoisted or local.
//
// IMPORTANT: react-native-gesture-handler must be imported BEFORE anything
// else (required by @react-navigation/drawer). See:
// https://reactnavigation.org/docs/drawer-navigator/#installation
import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
