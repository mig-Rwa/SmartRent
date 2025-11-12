# Firebase Authentication Quick Start Guide

## 🚀 Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "**Add project**" or select existing project
3. Enter project name: `SmartRent` (or your choice)
4. Follow setup wizard

### 2. Enable Firebase Authentication

1. In Firebase Console, go to **Authentication**
2. Click "**Get Started**"
3. Go to **Sign-in method** tab
4. Enable these providers:
   - ✅ **Email/Password** (required)
   - ✅ **Google** (optional, for OAuth)
5. Save changes

### 3. Get Firebase Configuration

#### For Frontend (Web App):

1. Go to **Project Settings** (⚙️ gear icon)
2. Scroll to "**Your apps**" section
3. Click **Web** icon (`</>`) to add a web app
4. Register app with nickname: `SmartRent Web`
5. Copy the Firebase config object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "smartrent-xxxxx.firebaseapp.com",
  projectId: "smartrent-xxxxx",
  storageBucket: "smartrent-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx",
  measurementId: "G-XXXXXXXXX"
};
```

6. Create `frontend/.env.local` file (copy from `.env.local.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=smartrent-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=smartrent-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=smartrent-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxx
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXX

NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

#### For Backend (Admin SDK):

1. Go to **Project Settings** > **Service Accounts**
2. Click "**Generate new private key**"
3. Click "**Generate key**" - a JSON file will download
4. Save as `backend/firebase-service-account.json`
5. ⚠️ **IMPORTANT**: Add to `.gitignore` (already done)

6. Update `backend/.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key

DATABASE_PATH=./smartrent.db
CORS_ORIGIN=http://localhost:3000

# Firebase
FIREBASE_PROJECT_ID=smartrent-xxxxx
FIREBASE_STORAGE_BUCKET=smartrent-xxxxx.appspot.com
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 4. Enable Firestore (Optional - for Production Database)

1. In Firebase Console, go to **Firestore Database**
2. Click "**Create database**"
3. Choose **Start in test mode** (for development)
4. Select your region (closest to users)
5. Click "**Enable**"

### 5. Set Up Firebase Security Rules

Go to **Firestore** > **Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if true; // Allow registration
      allow update, delete: if isOwner(userId);
    }
    
    match /properties/{propertyId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAuthenticated();
    }
    
    match /{document=**} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

### 6. Test the Setup

1. **Start Backend:**
```bash
cd backend
npm start
```

2. **Start Frontend:**
```bash
cd frontend
npm run dev
```

3. **Test Registration:**
   - Go to http://localhost:3000/auth/sign-up
   - Create account with email/password
   - Should redirect to landlord or tenant dashboard

4. **Test Login:**
   - Go to http://localhost:3000/auth/sign-in
   - Login with created account
   - Should work seamlessly!

---

## 🔄 Development vs Production

### Development (Current Setup)
- ✅ **Authentication**: Firebase Auth
- ✅ **Database**: SQLite (local file)
- ✅ **Storage**: Local file system

### Production (When Ready)
- ✅ **Authentication**: Firebase Auth
- ✅ **Database**: Firestore (set `NODE_ENV=production`)
- ✅ **Storage**: Firebase Cloud Storage

---

## 🧪 Using Firebase Emulators (Optional)

For completely offline development:

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login:
```bash
firebase login
```

3. Initialize:
```bash
firebase init
```
Select: Authentication, Firestore, Storage

4. Start emulators:
```bash
firebase emulators:start
```

5. Update `frontend/.env.local`:
```env
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

---

## ✅ What's Working Now

- ✅ Firebase Authentication (email/password)
- ✅ Google Sign-In (OAuth)
- ✅ Password Reset
- ✅ User registration with role selection
- ✅ JWT fallback for backward compatibility
- ✅ Backend verifies Firebase tokens
- ✅ Frontend auto-refreshes tokens
- ✅ SQLite database for development
- ✅ Can switch to Firestore in production

---

## 🔒 Security Notes

1. **Never commit** `firebase-service-account.json` to Git
2. **Never commit** `.env` or `.env.local` files
3. Keep Firebase API keys in environment variables
4. Use Firebase Security Rules to protect data
5. Rotate service account keys periodically

---

## 📚 Next Steps

1. **Test Authentication**: Create accounts, login, logout
2. **Configure Firestore** (optional): Switch from SQLite to Firestore
3. **Add OAuth Providers**: Facebook, GitHub, etc.
4. **Set Up Cloud Functions**: Rent reminders, notifications
5. **Configure Firebase Storage**: Property images, documents

---

## 🆘 Troubleshooting

### "Firebase not initialized" error
- Check `.env.local` has all Firebase config values
- Restart dev server after changing env files

### "Invalid API key" error
- Verify API key in Firebase Console matches `.env.local`
- Check for extra spaces or quotes in env file

### Backend auth fails
- Ensure `firebase-service-account.json` exists
- Check `FIREBASE_PROJECT_ID` in `backend/.env`
- Verify service account has Admin SDK permissions

### Can't create users
- Enable Email/Password in Firebase Console
- Check Firestore security rules allow user creation

---

**Status**: ✅ Firebase Authentication Ready
**Database**: SQLite (dev), Firestore (optional for production)
**Cost**: $0 (using free tier)
