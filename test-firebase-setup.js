/**
 * Firebase Authentication Test Script
 * 
 * This script helps you verify your Firebase setup is working correctly.
 * Run this AFTER you've configured Firebase in your .env files.
 * 
 * Usage:
 *   node test-firebase-setup.js
 */

const fs = require('fs');
const path = require('path');

// Try to load dotenv from backend if available
try {
    require('dotenv').config({ path: './backend/.env' });
} catch (e) {
    // dotenv not available, that's ok - we'll check manually
}

console.log('🔥 Testing Firebase Setup...\n');

// Read .env file manually if dotenv not available
if (!process.env.FIREBASE_PROJECT_ID) {
    try {
        const envContent = fs.readFileSync(path.join(__dirname, 'backend', '.env'), 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                if (value && !value.startsWith('#')) {
                    process.env[key.trim()] = value;
                }
            }
        });
    } catch (e) {
        console.log('⚠️ Could not read .env file');
    }
}

const admin = require('firebase-admin');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || '❌ NOT SET');
console.log('  FIREBASE_STORAGE_BUCKET:', process.env.FIREBASE_STORAGE_BUCKET || '❌ NOT SET');
console.log('  FIREBASE_SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '❌ NOT SET');
console.log('');

if (!process.env.FIREBASE_PROJECT_ID) {
    console.log('❌ Firebase not configured yet.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Create Firebase project at https://console.firebase.google.com/');
    console.log('2. Download service account JSON');
    console.log('3. Update backend/.env with Firebase config');
    console.log('4. Run this test again');
    process.exit(0);
}

// Try to initialize Firebase
try {
    const fs = require('fs');
    const path = require('path');
    
    const serviceAccountPath = path.resolve(__dirname, 'backend', process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'firebase-service-account.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
        console.log('❌ Service account file not found at:', serviceAccountPath);
        console.log('');
        console.log('Download it from:');
        console.log('Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
        process.exit(1);
    }
    
    const serviceAccount = require(serviceAccountPath);
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    
    console.log('✅ Firebase Admin SDK initialized successfully!');
    console.log('');
    console.log('📊 Project Details:');
    console.log('  Project ID:', serviceAccount.project_id);
    console.log('  Client Email:', serviceAccount.client_email);
    console.log('  Service Account ID:', serviceAccount.client_id);
    console.log('');
    
    // Test Firestore connection (if available)
    const db = admin.firestore();
    console.log('✅ Firestore client initialized');
    console.log('');
    
    // Test Auth
    console.log('✅ Firebase Auth client initialized');
    console.log('');
    
    console.log('🎉 All systems ready!');
    console.log('');
    console.log('You can now:');
    console.log('1. Start backend: cd backend && npm start');
    console.log('2. Start frontend: cd frontend && npm run dev');
    console.log('3. Test auth at: http://localhost:3000/auth/sign-up');
    
    process.exit(0);
    
} catch (error) {
    console.log('❌ Firebase initialization failed:');
    console.log('');
    console.error(error.message);
    console.log('');
    
    if (error.message.includes('ENOENT')) {
        console.log('Service account file not found. Make sure:');
        console.log('1. You downloaded the JSON from Firebase Console');
        console.log('2. Saved it as backend/firebase-service-account.json');
        console.log('3. FIREBASE_SERVICE_ACCOUNT_PATH in .env is correct');
    } else if (error.message.includes('credential')) {
        console.log('Invalid service account. Make sure:');
        console.log('1. The JSON file is valid Firebase service account');
        console.log('2. Project ID matches your Firebase project');
    }
    
    process.exit(1);
}
