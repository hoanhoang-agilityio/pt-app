import type { ConfigContext, ExpoConfig } from "expo/config";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
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
