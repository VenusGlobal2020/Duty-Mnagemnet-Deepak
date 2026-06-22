// Firebase Cloud Messaging Service Worker
// Place this file at: frontend/public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: self.FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
  projectId: self.FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: self.FIREBASE_APP_ID || 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const notificationTitle = title || 'Duty Management System';
  const notificationOptions = {
    body: body || 'You have a new notification',
    icon: '/shield.svg',
    badge: '/shield.svg',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const dutyId = event.notification.data?.dutyId;
  const url = dutyId ? `/operator/duties/${dutyId}` : '/';
  event.waitUntil(clients.openWindow(url));
});
