const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/config');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');

// Set up multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/avatars');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.user.userId}${ext}`);
  }
});
const upload = multer({ storage: avatarStorage });

// Register new user (with role support)
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role, first_name, last_name, phone } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Username, email, and password are required'
            });
        }

        // Validate role
        const userRole = role && ['landlord', 'tenant'].includes(role) ? role : 'tenant';

        // Check if user already exists
        db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], async (err, user) => {
            if (err) {
                console.error('Database error in registration:', err);
                return res.status(500).json({
                    status: 'error',
                    message: 'Database error'
                });
            }

            if (user) {
                return res.status(400).json({
                    status: 'error',
                    message: 'User already exists with this email or username'
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            db.run(
                'INSERT INTO users (username, email, password, role, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [username, email, hashedPassword, userRole, first_name || null, last_name || null, phone || null],
                function(err) {
                    if (err) {
                        console.error('Error creating user:', err);
                        return res.status(500).json({
                            status: 'error',
                            message: 'Error creating user'
                        });
                    }

                    // Generate token
                    const token = jwt.sign(
                        { userId: this.lastID, username, role: userRole },
                        config.jwtSecret,
                        { expiresIn: '24h' }
                    );

                    res.status(201).json({
                        status: 'success',
                        data: {
                            token,
                            user: {
                                id: this.lastID,
                                username,
                                email,
                                role: userRole,
                                first_name,
                                last_name,
                                phone
                            }
                        }
                    });
                }
            );
        });
    } catch (error) {
      console.error('Exception in /register:', error);
      res.status(500).json({
          status: 'error',
          message: 'Server error'
      });
  }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required'
            });
        }

        // Find user
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('DB error in /login:', err);
                return res.status(500).json({
                    status: 'error',
                    message: 'Database error'
                });
            }

            if (!user) {
                console.warn('Login failed: user not found for email', email);
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid credentials'
                });
            }

            // Check password
            try {
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    console.warn('Login failed: incorrect password for', user.email);
                    return res.status(401).json({
                        status: 'error',
                        message: 'Invalid credentials'
                    });
                }
            } catch (bcryptError) {
                console.error('Bcrypt error during password comparison:', bcryptError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Password check error'
                });
            }

            // Generate token with role
            const token = jwt.sign(
                { userId: user.id, username: user.username, role: user.role },
                config.jwtSecret,
                { expiresIn: '24h' }
            );

            res.json({
                status: 'success',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        phone: user.phone,
                        avatar_url: user.avatar_url
                    }
                }
            });
        });
    } catch (error) {
      console.error('Exception in /login:', error);
      res.status(500).json({
          status: 'error',
          message: 'Server error'
      });
  }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, role, first_name, last_name, phone, avatar_url, created_at FROM users WHERE id = ?', 
    [req.user.userId], (err, user) => {
    if (err) {
      console.error('DB error in /me:', err);
      return res.status(500).json({ status: 'error', message: 'DB error' });
    }
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: user });
  });
});

// Update user profile
router.put('/me', authenticateToken, (req, res) => {
  const { username, first_name, last_name, phone, email } = req.body;
  
  const updates = [];
  const params = [];
  
  if (username) { updates.push('username = ?'); params.push(username); }
  if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
  if (last_name) { updates.push('last_name = ?'); params.push(last_name); }
  if (phone) { updates.push('phone = ?'); params.push(phone); }
  if (email) { updates.push('email = ?'); params.push(email); }
  
  if (updates.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.user.userId);
  
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) {
      console.error('Error updating profile:', err);
      return res.status(500).json({ status: 'error', message: 'DB error', detail: err.message });
    }
    res.json({ status: 'success', message: 'Profile updated' });
  });
});

// POST /api/auth/avatar - upload profile picture
router.post('/avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }
  const avatarPath = `/uploads/avatars/${req.file.filename}`;
  db.run('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [avatarPath, req.user.userId], function (err) {
    if (err) {
      console.error('Error updating avatar:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to update avatar' });
    }
    res.json({ status: 'success', avatar: avatarPath });
  });
});

module.exports = router; 