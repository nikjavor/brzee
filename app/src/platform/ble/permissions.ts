import { PermissionsAndroid, Platform } from "react-native";
export async function requestBlePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  if (permissions.some((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED))
    throw new Error(
      "Bluetooth permission denied. Enable it in system Settings, then retry.",
    );
  if (Number(Platform.Version) >= 33)
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
}
