// Firebase Admin SDK — used to send FCM push notifications to officers'
// browsers/devices. Initialization is defensive: if no credentials are
// found, push sending is silently disabled and the rest of the app (DB
// notifications, WhatsApp, everything else) keeps working exactly as
// before. This means it's always safe to deploy this file even before a
// Firebase project has been set up.
const path = require('path');
const fs = require('fs');

let messagingInstance = null;
let initAttempted = false;

// Where to look for the service account JSON file, in order:
//   1. FIREBASE_SERVICE_ACCOUNT_PATH env var, if set (absolute or relative
//      to the backend project root)
//   2. firebase-service-account.json sitting in the backend project root
//      (same folder as server.js / package.json)
const resolveServiceAccountPath = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      : path.join(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  }
  return path.join(__dirname, '..', 'firebase-service-account.json');
};

const loadCredential = (admin) => {
  // Preferred: a service account JSON file (what the Firebase console gives
  // you when you click "Generate new private key").
  const jsonPath = resolveServiceAccountPath();
  if (fs.existsSync(jsonPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`✅ Loaded Firebase service account from ${jsonPath}`);
    return admin.credential.cert(serviceAccount);
  }

  // Fallback: three separate env vars (useful on hosts where you can't
  // easily ship a JSON file, e.g. some serverless/CI setups).
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // .env stores literal "\n" sequences inside the quoted private key —
      // convert them back to real newlines before handing to the SDK.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }

  return null;
};

const initFirebase = () => {
  if (initAttempted) return;
  initAttempted = true;

  try {
    // Required lazily so the app doesn't crash if the package somehow isn't
    // installed yet (e.g. mid-deploy) — push just stays disabled.
    const admin = require('firebase-admin');

    const credential = loadCredential(admin);
    if (!credential) {
      console.warn(
        '⚠️  No Firebase credentials found (looked for firebase-service-account.json in the ' +
        'backend root, then FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY env vars) — ' +
        'push notifications are disabled. In-app and WhatsApp notifications are unaffected.'
      );
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }

    messagingInstance = admin.messaging();
    console.log('✅ Firebase Admin initialized — push notifications enabled');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    messagingInstance = null;
  }
};

initFirebase();

const isFirebaseConfigured = () => !!messagingInstance;
const getMessaging = () => messagingInstance;

module.exports = { isFirebaseConfigured, getMessaging };