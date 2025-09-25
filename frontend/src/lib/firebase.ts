// frontend/src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
// Analytics is optional and only works in the browser with a measurementId
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTHDOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECTID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGEBUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APPID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENTID,
};

// Avoid re-initializing in Vite HMR
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// --- Auth ---
export const auth = getAuth(app);

// --- Firestore ---
// Use initializeFirestore to enable modern cache + multi-tab persistence
export const db =
  // If Firestore already exists (HMR), reuse it
  (getApps().length && (() => { try { return getFirestore(app); } catch { return null; } })()) ||
  initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

// --- Analytics (guarded so it doesn't error in SSR/test environments) ---
export const analyticsPromise =
  typeof window !== "undefined" && !!firebaseConfig.measurementId
    ? isSupported().then((ok) => (ok ? getAnalytics(app) : null))
    : Promise.resolve(null);

// --- Optional: Local emulators for dev ---
// Set in .env.local (Vite): VITE_FIREBASE_EMULATOR="true"
// Optionally override ports with VITE_AUTH_EMULATOR_PORT / VITE_FIRESTORE_EMULATOR_PORT
const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === "true";

if (useEmulator && typeof window !== "undefined") {
  const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT ?? 9099);
  const fsPort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? 8080);

  try {
    // Safe to call multiple times in HMR; Firebase will no-op subsequent calls
    connectAuthEmulator(auth, `http://localhost:${authPort}`, { disableWarnings: true });
  } catch { /* noop */ }

  try {
    connectFirestoreEmulator(db, "localhost", fsPort);
  } catch { /* noop */ }
}