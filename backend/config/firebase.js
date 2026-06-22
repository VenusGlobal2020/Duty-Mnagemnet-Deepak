const admin = require('firebase-admin');

let firebaseApp;

const initFirebase = () => {
  if (!firebaseApp) {
    try {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('⚠️ Firebase Admin init failed:', error.message);
    }
  }
  return firebaseApp;
};

const sendPushNotification = async (token, title, body, data = {}) => {
  try {
    const app = initFirebase();
    if (!app) return { success: false, error: 'Firebase not initialized' };
    const message = { token, notification: { title, body }, data, android: { priority: 'high' }, apns: { payload: { aps: { sound: 'default' } } } };
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Push notification error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendMulticastNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return;
  try {
    const app = initFirebase();
    if (!app) return;
    const validTokens = tokens.filter(Boolean);
    if (validTokens.length === 0) return;
    const message = { tokens: validTokens, notification: { title, body }, data, android: { priority: 'high' } };
    const response = await admin.messaging().sendEachForMulticast(message);
    return response;
  } catch (error) {
    console.error('Multicast notification error:', error.message);
  }
};

module.exports = { initFirebase, sendPushNotification, sendMulticastNotification };
