const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Authentication token required' 
            });
        }

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

// Legacy export for backward compatibility
const auth = authenticateToken;

module.exports = {
    auth,
    authenticateToken,
    requireLandlord,
    requireTenant
}; 