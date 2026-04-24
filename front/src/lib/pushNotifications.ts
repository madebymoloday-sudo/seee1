import apiAgent from "@/lib/api";

const PERMISSION_REQUEST_FLAG = "seee_push_permission_requested";

type NotificationSettingsResponse = {
  browserPushAvailable: boolean;
  vapidPublicKey: string | null;
  telegramLinked: boolean;
  telegramNotificationsEnabled: boolean;
};

type BrowserPushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export async function registerBrowserPushNotifications() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  const settings = await apiAgent.get<NotificationSettingsResponse>("/social/notifications/settings");
  if (!settings.browserPushAvailable || !settings.vapidPublicKey) {
    return;
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  let permission = Notification.permission;

  if (permission === "default" && !localStorage.getItem(PERMISSION_REQUEST_FLAG)) {
    localStorage.setItem(PERMISSION_REQUEST_FLAG, "1");
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return;
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    await syncSubscription(existingSubscription);
    return;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(settings.vapidPublicKey),
  });

  await syncSubscription(subscription);
}

async function syncSubscription(subscription: PushSubscription) {
  const payload = subscription.toJSON() as BrowserPushSubscriptionPayload;
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    return;
  }

  await apiAgent.post<BrowserPushSubscriptionPayload, { ok: boolean }>(
    "/social/notifications/browser-subscriptions",
    payload,
  );
}
