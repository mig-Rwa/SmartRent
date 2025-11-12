const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../config/database');
const { initializeFirebase } = require('../config/firebase');

// Check if Firebase is configured (removed production check)
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
        console.error('⚠️ Firebase initialization failed, falling back to JWT:', error.message);
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
        
        // Try Firebase Authentication first if available
        if (USE_FIREBASE && admin) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                
                // Get user data from Firestore or SQLite
                const userId = decodedToken.uid;
                
                // Try Firestore first
                try {
                    const { db: firestoreDb } = initializeFirebase();
                    if (firestoreDb && firestoreDb.collection) {
                        const userDoc = await firestoreDb.collection('users').doc(userId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            req.user = {
                                userId: userId,
                                username: userData.username,
                                email: decodedToken.email,
                                role: userData.role || 'tenant',
                                firstName: userData.first_name,
                                lastName: userData.last_name,
                                phone: userData.phone
                            };
                            return next();
                        }
                    }
                } catch (firestoreError) {
                    console.log('Firestore not available, checking SQLite');
                }
                
                // Fall back to SQLite (check by email since Firebase UID might not match)
                db.get('SELECT id, username, email, role, first_name, last_name, phone FROM users WHERE email = ?', 
                    [decodedToken.email], 
                    (err, user) => {
                        if (err) {
                            console.error('[Auth Middleware] Database error:', err);
                            return res.status(500).json({ 
                                status: 'error', 
                                message: 'Database error' 
                            });
                        }
                        
                        if (!user) {
                            // Don't auto-create - let /firebase-register handle user creation with correct role
                            console.log('[Auth Middleware] User not found in database:', decodedToken.email);
                            return res.status(404).json({ 
                                status: 'error', 
                                message: 'User not found. Please complete registration.' 
                            });
                        }
                        
                        // User exists - return their data
                        req.user = {
                            userId: user.id,
                            username: user.username,
                            email: user.email,
                            role: user.role,
                            firstName: user.first_name,
                            lastName: user.last_name,
                            phone: user.phone
                        };
                        next();
                    }
                );
                return;
            } catch (firebaseError) {
                console.error('Firebase token verification failed:', firebaseError.message);
                // Fall through to JWT verification
            }
        }
        
        // Fall back to JWT authentication
        const decoded = jwt.verify(token, config.jwtSecret);
        
        // Fetch user from DB to get latest data including role
        db.get('SELECT id, username, email, role, first_name, last_name, phone FROM users WHERE id = ?', 
            [decoded.userId || decoded.id], 
            (err, user) => {
                if (err || !user) {
                    return res.status(401).json({ 
                        status: 'error', 
                        message: 'Invalid authentication token' 
                    });
                }
                
                // Attach user info to request
                req.user = {
                    userId: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    phone: user.phone
                };
                
                next();
            }
        );
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