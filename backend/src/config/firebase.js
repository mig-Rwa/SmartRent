/**
 * Firebase Configuration for SmartRent
 * 
 * This file contains the Firebase/Firestore configuration for production deployment.
 * For local development, we use SQLite (see database.js)
 * 
 * Services used:
 * - Firestore: NoSQL database for storing properties, leases, payments, etc.
 * - Firebase Authentication: User authentication (optional, can use JWT)
 * - Cloud Storage: For storing images (property photos, maintenance request images)
 * - Cloud Messaging: Push notifications for rent reminders and updates
 * - Cloud Functions: Serverless backend functions
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// In production, use environment variable for service account
let db = null;
let storage = null;
let messaging = null;

const initializeFirebase = () => {
    try {
        // Check if Firebase credentials are configured
        if (process.env.FIREBASE_PROJECT_ID) {
            // Initialize with service account credentials
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                : require('../../firebase-service-account.json'); // Corrected path

            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
                });
            }

            db = admin.firestore();
            storage = admin.storage();
            messaging = admin.messaging();

            console.log('✅ Firebase initialized successfully');
            return { db, storage, messaging, isFirebase: true };
        } else {
            console.log('ℹ️ Running without Firebase - using SQLite only');
            // Use SQLite for development
            const sqlite = require('./database');
            return { db: sqlite, isFirebase: false };
        }
    } catch (error) {
        console.error('❌ Error initializing Firebase:', error);
        console.log('⚠️ Falling back to SQLite database');
        const sqlite = require('./database');
        return { db: sqlite, isFirebase: false };
    }
};

// Firestore Collection Names
const COLLECTIONS = {
    USERS: 'users',
    PROPERTIES: 'properties',
    LEASES: 'leases',
    PAYMENTS: 'payments',
    MAINTENANCE_REQUESTS: 'maintenance_requests',
    NOTIFICATIONS: 'notifications',
    UTILITIES: 'utilities',
    DOCUMENTS: 'documents',
    MESSAGES: 'messages'
};

// Helper functions for Firestore operations
const firestoreHelpers = {
    // Convert Firestore document to plain object
    docToObject: (doc) => {
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    },

    // Convert Firestore query snapshot to array of objects
    queryToArray: (snapshot) => {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // Add timestamp fields
    withTimestamps: (data, isUpdate = false) => {
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        if (isUpdate) {
            return { ...data, updated_at: timestamp };
        }
        return { ...data, created_at: timestamp, updated_at: timestamp };
    },

    // Batch write operations
    batchWrite: async (operations) => {
        const batch = db.batch();
        operations.forEach(({ ref, data, operation = 'set' }) => {
            if (operation === 'set') {
                batch.set(ref, data);
            } else if (operation === 'update') {
                batch.update(ref, data);
            } else if (operation === 'delete') {
                batch.delete(ref);
            }
        });
        return await batch.commit();
    }
};

// Example: Migration helper from SQLite to Firestore
const migrateToFirestore = async (sqliteDb) => {
    console.log('🔄 Starting migration from SQLite to Firestore...');
    
    try {
        // Migrate users
        const users = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const batch = db.batch();
        users.forEach(user => {
            const userRef = db.collection(COLLECTIONS.USERS).doc(user.id.toString());
            batch.set(userRef, firestoreHelpers.withTimestamps(user));
        });
        await batch.commit();
        console.log(`✅ Migrated ${users.length} users`);

        // Similar migrations for other tables...
        // This is just an example structure

        console.log('✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    }
};

module.exports = {
    initializeFirebase,
    COLLECTIONS,
    firestoreHelpers,
    migrateToFirestore,
    admin // Export admin for advanced usage
};
