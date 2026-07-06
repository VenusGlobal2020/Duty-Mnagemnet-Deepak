import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAfiY1S60MrkQO4tWdqVlZI4ReHIoyH1oQ",
  authDomain: "notification-31d86.firebaseapp.com",
  projectId: "notification-31d86",
  storageBucket: "notification-31d86.firebasestorage.app",
  messagingSenderId: "1046414852",
  appId: "1:1046414852:web:11a726c4faca53f2059751",
  measurementId: "G-CHVPM18D79"
};

let app, messaging;

export const initFirebaseMessaging = async () => {
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: "BNiJX2pz0IdycogqLGmSv08zpVFT6sBzXhJ3O-t28edpWmQXdeAmMCpaMs2ZEpeuMbnLdgKpAmqq6pphkNxQG-c",
    });
    return token;
  } catch (error) {
    console.warn('Firebase messaging not available:', error.message);
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  if (!messaging) return () => { };
  return onMessage(messaging, callback);
};
