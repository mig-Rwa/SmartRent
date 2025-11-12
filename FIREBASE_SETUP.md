# Firebase Setup Guide for SmartRent

## Overview

SmartRent uses a **dual-database approach**:
- **Development**: SQLite (local, file-based database)
- **Production**: Firebase Firestore (cloud NoSQL database)

## Firebase Services Used

1. **Firestore** - NoSQL database for all application data
2. **Cloud Storage** - Store property images, maintenance photos, documents
3. **Cloud Messaging (FCM)** - Push notifications for rent reminders
4. **Cloud Functions** - Serverless functions for scheduled tasks
5. **Firebase Hosting** - Host the Next.js frontend (optional, can use Vercel)
6. **Firebase Authentication** - Optional (currently using JWT)

---

## 🚀 Setup Instructions

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name: **SmartRent**
4. Enable Google Analytics (optional)
5. Click "Create Project"

### Step 2: Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create Database"
3. Choose production mode or test mode
4. Select your region (choose closest to your users)
5. Click "Enable"

### Step 3: Set Up Firestore Security Rules

In Firestore > Rules, add these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isLandlord() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'landlord';
    }
    
    function isTenant() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'tenant';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if true; // Allow registration
      allow update, delete: if isOwner(userId);
    }
    
    // Properties collection
    match /properties/{propertyId} {
      allow read: if isAuthenticated();
      allow create: if isLandlord();
      allow update, delete: if isLandlord() && 
                               resource.data.landlord_id == request.auth.uid;
    }
    
    // Leases collection
    match /leases/{leaseId} {
      allow read: if isAuthenticated() && 
                     (resource.data.landlord_id == request.auth.uid || 
                      resource.data.tenant_id == request.auth.uid);
      allow create: if isLandlord();
      allow update, delete: if isLandlord() && 
                               resource.data.landlord_id == request.auth.uid;
    }
    
    // Payments collection
    match /payments/{paymentId} {
      allow read: if isAuthenticated() && 
                     (resource.data.landlord_id == request.auth.uid || 
                      resource.data.tenant_id == request.auth.uid);
      allow create: if isAuthenticated();
      allow update: if resource.data.landlord_id == request.auth.uid || 
                       resource.data.tenant_id == request.auth.uid;
    }
    
    // Maintenance requests
    match /maintenance_requests/{requestId} {
      allow read: if isAuthenticated() && 
                     (resource.data.landlord_id == request.auth.uid || 
                      resource.data.tenant_id == request.auth.uid);
      allow create: if isTenant();
      allow update: if resource.data.landlord_id == request.auth.uid || 
                       resource.data.tenant_id == request.auth.uid;
      allow delete: if resource.data.landlord_id == request.auth.uid;
    }
    
    // Notifications
    match /notifications/{notificationId} {
      allow read, update, delete: if isOwner(resource.data.user_id);
      allow create: if isAuthenticated();
    }
    
    // Allow read/write for other collections if authenticated
    match /{document=**} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

### Step 4: Enable Cloud Storage

1. Go to **Storage** in Firebase Console
2. Click "Get Started"
3. Choose security rules (start with test mode, update later)
4. Select storage location
5. Click "Done"

### Step 5: Set Up Cloud Messaging (FCM)

1. Go to **Cloud Messaging** in Firebase Console
2. Enable Cloud Messaging API
3. Save your Server Key for backend use

### Step 6: Generate Service Account Key

1. Go to Project Settings (gear icon) > Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Save as `firebase-service-account.json` (⚠️ DON'T commit to git!)
5. Add to `.gitignore`

---

## 📦 Install Firebase Dependencies

```bash
cd backend
npm install firebase-admin
```

For frontend (if using Firebase SDK):
```bash
cd frontend
npm install firebase
```

---

## 🔧 Environment Variables

### Backend `.env`

```env
# Server
PORT=5000
NODE_ENV=production
JWT_SECRET=your_jwt_secret_key_here

# Firebase Configuration
FIREBASE_PROJECT_ID=smartrent-xxxxx
FIREBASE_STORAGE_BUCKET=smartrent-xxxxx.appspot.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}

# Or path to service account file
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Development (SQLite)
DATABASE_PATH=./smartrent.db
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Firebase (if using client SDK)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=smartrent-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=smartrent-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=smartrent-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxx
```

---

## 🔄 Data Migration

To migrate from SQLite (development) to Firestore (production):

```javascript
// Run this script once
const { initializeFirebase, migrateToFirestore } = require('./config/firebase');
const sqliteDb = require('./config/database');

async function migrate() {
    const { db } = initializeFirebase();
    await migrateToFirestore(sqliteDb);
    console.log('Migration complete!');
}

migrate().catch(console.error);
```

---

## 📊 Firestore Data Structure

### Collections

```
smartrent/
├── users/
│   └── {userId}/
│       ├── id: string
│       ├── username: string
│       ├── email: string
│       ├── role: "landlord" | "tenant"
│       ├── first_name: string
│       ├── last_name: string
│       ├── phone: string
│       ├── avatar_url: string
│       ├── created_at: timestamp
│       └── updated_at: timestamp
│
├── properties/
│   └── {propertyId}/
│       ├── landlord_id: string
│       ├── title: string
│       ├── address: string
│       ├── city: string
│       ├── rent_amount: number
│       ├── status: "available" | "occupied" | "maintenance"
│       ├── images: array
│       └── ...
│
├── leases/
│   └── {leaseId}/
│       ├── property_id: string
│       ├── tenant_id: string
│       ├── landlord_id: string
│       ├── start_date: string
│       ├── end_date: string
│       ├── monthly_rent: number
│       ├── status: "active" | "expired" | "terminated"
│       └── ...
│
├── payments/
│   └── {paymentId}/
│       ├── lease_id: string
│       ├── tenant_id: string
│       ├── amount: number
│       ├── payment_type: "rent" | "utilities"
│       ├── status: "pending" | "completed"
│       └── ...
│
├── maintenance_requests/
│   └── {requestId}/
│       ├── property_id: string
│       ├── tenant_id: string
│       ├── title: string
│       ├── status: "pending" | "in_progress" | "completed"
│       └── ...
│
└── notifications/
    └── {notificationId}/
        ├── user_id: string
        ├── type: string
        ├── message: string
        ├── is_read: boolean
        └── created_at: timestamp
```

---

## 🔥 Cloud Functions Example

Create `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Send rent reminder 3 days before due date
exports.sendRentReminders = functions.pubsub
    .schedule('0 9 * * *') // Every day at 9 AM
    .timeZone('America/New_York')
    .onRun(async (context) => {
        const db = admin.firestore();
        const today = new Date();
        const threeDaysFromNow = new Date(today.setDate(today.getDate() + 3));
        
        // Get all active leases with payment due in 3 days
        const leasesSnapshot = await db.collection('leases')
            .where('status', '==', 'active')
            .where('payment_due_day', '==', threeDaysFromNow.getDate())
            .get();
        
        const batch = db.batch();
        
        leasesSnapshot.forEach(doc => {
            const lease = doc.data();
            const notificationRef = db.collection('notifications').doc();
            
            batch.set(notificationRef, {
                user_id: lease.tenant_id,
                type: 'payment_reminder',
                title: 'Rent Payment Reminder',
                message: `Your rent payment of $${lease.monthly_rent} is due in 3 days`,
                related_id: doc.id,
                related_type: 'lease',
                is_read: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log(`Sent ${leasesSnapshot.size} rent reminders`);
    });

// Expire old leases
exports.expireLeases = functions.pubsub
    .schedule('0 0 * * *') // Every day at midnight
    .onRun(async (context) => {
        const db = admin.firestore();
        const today = new Date().toISOString().split('T')[0];
        
        const expiredLeases = await db.collection('leases')
            .where('status', '==', 'active')
            .where('end_date', '<', today)
            .get();
        
        const batch = db.batch();
        
        expiredLeases.forEach(doc => {
            batch.update(doc.ref, { 
                status: 'expired',
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log(`Expired ${expiredLeases.size} leases`);
    });
```

---

## 🚀 Deployment

### Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Storage Rules

```bash
firebase deploy --only storage
```

---

## 📝 Best Practices

1. **Use subcollections** for related data (e.g., property reviews)
2. **Index frequently queried fields** in Firestore
3. **Implement pagination** for large result sets
4. **Use batch writes** for multiple operations
5. **Enable offline persistence** in mobile apps
6. **Monitor costs** - Firestore charges per read/write
7. **Use Cloud Functions** for scheduled tasks and background jobs

---

## 🔍 Testing

### Test Firestore locally

```bash
npm install -g firebase-tools
firebase emulators:start --only firestore
```

Update connection in your code:
```javascript
if (process.env.NODE_ENV === 'development') {
    db.useEmulator('localhost', 8080);
}
```

---

## 📊 Cost Estimation

Firebase pricing is pay-as-you-go:
- **Firestore**: Free tier includes 50K reads, 20K writes/day
- **Storage**: Free tier includes 5GB
- **Cloud Functions**: Free tier includes 2M invocations/month
- **Bandwidth**: Free tier includes 10GB/month

For a small-medium app: ~$0-25/month
For larger scale: Scale with usage

---

## 🔗 Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Pricing](https://firebase.google.com/pricing)
- [Cloud Functions Guide](https://firebase.google.com/docs/functions)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)

---

**Status**: Ready for Firebase integration
**Team Member**: Miguel Tunga (Database Setup & Hosting)
