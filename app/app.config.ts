import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "BRZEE",
  slug: "brzee",
  version: "1.0.0",
  scheme: "brzee",
  platforms: ["ios", "android"],
  orientation: "portrait",
  userInterfaceStyle: "dark",
  ios: {
    bundleIdentifier: "com.brzee.companion",
    buildNumber: "3",
    supportsTablet: false,
    infoPlist: {
      NSBluetoothAlwaysUsageDescription:
        "Connect to your BRZEE adapter for live vehicle readings and responsive engine sound.",
      UIBackgroundModes: ["bluetooth-central", "audio"],
    },
  },
  android: {
    package: "com.brzee.companion",
    versionCode: 3,
    permissions: ["android.permission.BLUETOOTH_CONNECT"],
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  plugins: [
    "expo-asset",
    "expo-status-bar",
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: "16.4" },
        android: { compileSdkVersion: 37, targetSdkVersion: 36 },
      },
    ],
    [
      "react-native-ble-plx",
      {
        isBackgroundEnabled: true,
        neverForLocation: true,
        modes: ["central"],
        bluetoothAlwaysPermission:
          "Connect to your BRZEE adapter for live vehicle readings and responsive engine sound.",
      },
    ],
    [
      "react-native-audio-api",
      {
        iosBackgroundMode: true,
        androidForegroundService: true,
        androidFSTypes: ["connectedDevice", "mediaPlayback"],
        androidFSStopWithTask: true,
        disableFFmpeg: true,
        androidPermissions: [
          "android.permission.FOREGROUND_SERVICE",
          "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE",
          "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
          "android.permission.POST_NOTIFICATIONS",
        ],
      },
    ],
  ],
};

export default config;
