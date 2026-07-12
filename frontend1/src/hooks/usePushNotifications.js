import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { initFirebaseMessaging, onForegroundMessage } from '../utils/firebase';

// Registers this device's Firebase Cloud Messaging token with the backend
// whenever a user is logged in, and shows a toast for any push notification
// that arrives while the tab is open/focused (background/closed-tab
// notifications are handled by public/firebase-messaging-sw.js instead).
//
// Silently does nothing if Firebase isn't configured (no VITE_FIREBASE_*
// env vars) or the browser/user denies notification permission — the rest
// of the app (in-app bell, WhatsApp) is completely unaffected either way.
export default function usePushNotifications() {
  const { user } = useAuth();
  const lastRegisteredToken = useRef(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const token = await initFirebaseMessaging();
      if (!token || cancelled || token === lastRegisteredToken.current) return;
      try {
        await api.patch('/auth/fcm-token', { fcmToken: token });
        lastRegisteredToken.current = token;
      } catch (error) {
        console.warn('Failed to register push notification token:', error.message);
      }
    })();

    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || 'New Notification';
      const body = payload?.notification?.body || payload?.data?.body || '';
      toast(body ? `${title} — ${body}` : title, { icon: '🔔', duration: 5000 });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Re-run if a different account logs in on the same device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);
}