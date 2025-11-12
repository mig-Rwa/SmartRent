/**
 * Firebase Configuration for SmartRent Frontend
 * 
 * This file initializes Firebase client SDK for authentication
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your web app's Firebase configuration
// Get these from Firebase Console > Project Settings > Your Apps > Web App
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ''
};

// Debug: Log Firebase config (remove in production)
console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? '✓ Set' : '✗ Missing',
  authDomain: firebaseConfig.authDomain || '✗ Missing',
  projectId: firebaseConfig.projectId || '✗ Missing',
  appId: firebaseConfig.appId ? '✓ Set' : '✗ Missing'
});

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
export const auth = getAuth(app);

// Initialize Firestore and Storage (optional - may not be enabled)
let dbInstance = null;
let storageInstance = null;

try {
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
  console.log('✅ Firestore and Storage initialized');
} catch (error) {
  console.log('ℹ️ Firestore/Storage not enabled - using Firebase Auth only');
}

export const db = dbInstance as any;
export const storage = storageInstance as any;

// Connect to emulators in development (optional)
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  console.log('🔥 Connected to Firebase Emulators');
}

export default app;
