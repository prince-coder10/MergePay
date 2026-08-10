/**
 * Utility helper for requesting browser notification permission and showing native popups
 */

export function requestNotificationPermission(): void {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().catch((err) => {
        console.warn("[Notification] Permission request error:", err);
      });
    }
  }
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
): void {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, options);
      } catch (err) {
        console.warn("[Notification] Failed to trigger notification:", err);
      }
    } else if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((permission) => {
          if (permission === "granted") {
            new Notification(title, options);
          }
        })
        .catch(() => {});
    }
  }
}
