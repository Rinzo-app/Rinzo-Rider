import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence is exported at runtime via Metro's
// react-native-specific entry point but missing from the default
// TypeScript declarations.  This augmentation bridges the gap.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}

// ── Required Firebase env vars ──
const REQUIRED_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

// EXPO_PUBLIC_* vars must be referenced STATICALLY — Metro inlines
// literal `process.env.EXPO_PUBLIC_X` expressions into release
// bundles; dynamic `process.env[key]` access is undefined there.
const RAW_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

function getEnv(key: string): string | undefined {
  const value = RAW_ENV[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

const missingRequired = REQUIRED_VARS.filter((k) => !getEnv(k));

if (missingRequired.length > 0) {
  console.error(
    `[Firebase] Missing required environment variables: ${missingRequired.join(', ')}`
  );
}

const firebaseConfig = {
  apiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

export const isFirebaseConfigured = missingRequired.length === 0;

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firebaseAuth: ReturnType<typeof getAuth> | null = null;

function initFirebase() {
  if (!isFirebaseConfigured) return;

  firebaseApp =
    getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];

  if (Platform.OS === 'web') {
    firebaseAuth = getAuth(firebaseApp);
  } else {
    try {
      firebaseAuth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      firebaseAuth = getAuth(firebaseApp);
    }
  }
}

const firebaseReady = Promise.resolve(initFirebase());

export function getFirebaseAuth() {
  return firebaseAuth;
}

export { firebaseReady };
