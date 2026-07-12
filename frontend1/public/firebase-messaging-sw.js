// Firebase Cloud Messaging background handler.
//
// This file MUST live at the site root (public/firebase-messaging-sw.js →
// served as /firebase-messaging-sw.js) — the Firebase SDK auto-registers it
// from that exact path when getToken() is called in src/utils/firebase.js.
//
// IMPORTANT — this is a static file copied as-is by Vite, so it CANNOT read
// import.meta.env at build time. Paste the SAME 6 values you put in your
// .env's VITE_FIREBASE_* variables below. These are public web config values
// (safe to expose client-side — this is how every Firebase web app ships),
// not secrets.
importScripts('https://www.gstatic.com/firebasejs/10.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.6.0/firebase-messaging-compat.js');

firebase.initializeApp({

    storageBucket: 'notification-31d86.firebasestorage.app',
    apiKey: "AIzaSyAfiY1S60MrkQO4tWdqVlZI4ReHIoyH1oQ",
    authDomain: "notification-31d86.firebaseapp.com",
    projectId: "notification-31d86",
    messagingSenderId: "1046414852",
    appId: "1:1046414852:web:11a726c4faca53f2059751",
});

const messaging = firebase.messaging();

// Shown when the app/tab is NOT in the foreground (closed, backgrounded, or
// a different tab). Foreground messages are instead handled inside the app
// itself via onForegroundMessage() in src/utils/firebase.js, so they don't
// get double-shown here.
messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || payload?.data?.title || 'Duty Management System';
    const body = payload?.notification?.body || payload?.data?.body || '';

    self.registration.showNotification(title, {
        body,
        icon: '/shield.svg',
        badge: '/shield.svg',
        data: payload?.data || {},
    });
});

// Focus/open the app when a background notification is tapped.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('/');
        })
    );
});