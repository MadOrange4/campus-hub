import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const auth = getAuth(app);

// Optional: analytics (guarded so it doesn't error in SSR/test environments)
export const analyticsPromise = typeof window !== "undefined" && firebaseConfig.measurementId
  ? isSupported().then((ok) => (ok ? getAnalytics(app) : null))
  : Promise.resolve(null);
