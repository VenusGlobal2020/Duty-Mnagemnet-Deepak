// Firebase Cloud Messaging Service Worker
// Place this file at: frontend/public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAfiY1S60MrkQO4tWdqVlZI4ReHIoyH1oQ",
  authDomain: "notification-31d86.firebaseapp.com",
  projectId: "notification-31d86",
  storageBucket: "notification-31d86.firebasestorage.app",
  messagingSenderId: "1046414852",
  appId: "1:1046414852:web:11a726c4faca53f2059751",
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
