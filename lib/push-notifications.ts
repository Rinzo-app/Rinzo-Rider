import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { request } from "./http-client";

// Show notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Ask for permission, mint an Expo push token, and register it with
 * the backend. Call after login. Never throws.
 *
 * Silently no-ops where pushes aren't possible: web, emulators,
 * Expo Go on Android (SDK 53+), or builds without an EAS projectId.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    const token = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      )
    ).data;

    await request("POST", "/api/notifications/token", {
      token,
      platform: Platform.OS,
    });
  } catch (err) {
    console.warn("Push registration skipped:", err);
  }
}
