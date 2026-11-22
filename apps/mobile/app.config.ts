import type { ConfigContext, ExpoConfig } from "expo/config";
import { type ConfigPlugin, withAndroidManifest } from "expo/config-plugins";

// @ts-expect-error The Expo config loader needs the explicit .ts extension.
import { isDevelopmentBuild, resolveBuildApiUrl } from "./src/lib/api-url.ts";

const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE;
// Throws for a non-development EAS build without EXPO_PUBLIC_API_URL.
const API_URL = resolveBuildApiUrl(process.env.EXPO_PUBLIC_API_URL, BUILD_PROFILE);

// Cleartext HTTP (LAN / 10.0.2.2 API) is allowed on Android only in
// development builds; release builds must use HTTPS.
const withCleartextTraffic: ConfigPlugin<{ enabled: boolean }> = (config, { enabled }) =>
  withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];

    if (application) {
      application.$["android:usesCleartextTraffic"] = enabled ? "true" : "false";
    }
    return mod;
  });
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

const baseConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PT App",
  slug: "pt-app-mobile",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "ptapp",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "app.ptapp.mobile",
    supportsTablet: false,
  },
  android: {
    package: "app.ptapp.mobile",
    adaptiveIcon: {
      backgroundColor: "#f4f4f5",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f4f4f5",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Cho phép PT App truy cập ảnh để đăng bài và gửi tin nhắn.",
        cameraPermission: "Cho phép PT App dùng máy ảnh để chụp ảnh gửi đi.",
      },
    ],
    ["expo-notifications", { color: "#e8590c" }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: API_URL,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});

export default (context: ConfigContext): ExpoConfig =>
  withCleartextTraffic(baseConfig(context), { enabled: isDevelopmentBuild(BUILD_PROFILE) });
