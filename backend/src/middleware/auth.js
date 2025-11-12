const config = require('../config/config');
const { initializeFirebase } = require('../config/firebase');
const { getUserService } = require('../services/users.service');

// Initialize Firebase Admin
const USE_FIREBASE = Boolean(process.env.FIREBASE_PROJECT_ID);
let admin = null;

if (USE_FIREBASE) {
    try {
        const firebaseConfig = initializeFirebase();
        if (firebaseConfig.isFirebase) {
            admin = require('firebase-admin');
            console.log('✅ Firebase Admin initialized for authentication');
        }
    } catch (error) {
        console.error('⚠️ Firebase initialization failed:', error.message);
    }
}

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Authentication token required' 
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Verify Firebase token
        if (!USE_FIREBASE || !admin) {
            return res.status(500).json({
                status: 'error',
                message: 'Firebase authentication not configured'
            });
        }

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            const userId = decodedToken.uid;
            
            // Get user from Firestore
            const userService = getUserService();
            const user = await userService.getUserById(userId);
            
            if (!user) {
                console.log('[Auth Middleware] User not found in Firestore:', decodedToken.email);
                return res.status(404).json({ 
                    status: 'error', 
                    message: 'User not found. Please complete registration.' 
                });
            }
            
            // Attach user info to request
            req.user = {
                userId: user.uid,
                username: user.displayName,
                email: user.email,
                role: user.role,
                firstName: user.displayName?.split(' ')[0] || '',
                lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                phone: user.phoneNumber
            };
            
            return next();
        } catch (firebaseError) {
            console.error('Firebase token verification failed:', firebaseError.message);
            return res.status(401).json({
                status: 'error',
                message: 'Invalid authentication token'
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({
            status: 'error',
            message: 'Please authenticate'
        });
    }
};

// Middleware to check if user is a landlord
const requireLandlord = (req, res, next) => {
    if (req.user.role !== 'landlord') {
        return res.status(403).json({
            status: 'error',
            message: 'Access denied. Landlord role required.'
        });
    }
    next();
};

// Middleware to check if user is a tenant
const requireTenant = (req, res, next) => {
    if (req.user.role !== 'tenant') {
        return res.status(403).json({
            status: 'error',
            message: 'Access denied. Tenant role required.'
        });
    }
    next();
};

// Firebase-only authentication for registration (doesn't require user in DB)
const authenticateFirebaseOnly = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Authentication token required' 
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Verify Firebase token
        if (USE_FIREBASE && admin) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                
                // Attach Firebase user info to request (no DB check)
                req.user = {
                    email: decodedToken.email,
                    firebaseUid: decodedToken.uid,
                    name: decodedToken.name || ''
                };
                
                return next();
            } catch (firebaseError) {
                console.error('Firebase token verification failed:', firebaseError.message);
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid Firebase token'
                });
            }
        }
        
        return res.status(401).json({
            status: 'error',
            message: 'Firebase authentication not configured'
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({
            status: 'error',
            message: 'Please authenticate'
        });
    }
};

// Legacy export for backward compatibility
const auth = authenticateToken;

module.exports = {
    auth,
    authenticateToken,
    authenticateFirebaseOnly,
    requireLandlord,
    requireTenant
}; 