const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for maintenance request images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/maintenance/');
    },
    filename: (req, file, cb) => {
        cb(null, `maintenance-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|webp/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Get all maintenance requests (filtered by user role)
router.get('/', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { property_id, status, priority } = req.query;

    let query = `
        SELECT mr.*, 
               p.title as property_title,
               p.address as property_address,
               t.username as tenant_name,
               l.username as landlord_name
        FROM maintenance_requests mr
        JOIN properties p ON mr.property_id = p.id
        JOIN users t ON mr.tenant_id = t.id
        JOIN users l ON mr.landlord_id = l.id
        WHERE 1=1
    `;
    const params = [];

    // Filter based on role
    if (role === 'tenant') {
        query += ' AND mr.tenant_id = ?';
        params.push(userId);
    } else if (role === 'landlord') {
        query += ' AND mr.landlord_id = ?';
        params.push(userId);
    }

    // Additional filters
    if (property_id) {
        query += ' AND mr.property_id = ?';
        params.push(parseInt(property_id));
    }

    if (status) {
        query += ' AND mr.status = ?';
        params.push(status);
    }

    if (priority) {
        query += ' AND mr.priority = ?';
        params.push(priority);
    }

    query += ' ORDER BY mr.created_at DESC';

    db.all(query, params, (err, requests) => {
        if (err) {
            console.error('Error fetching maintenance requests:', err);
            return res.status(500).json({ error: 'Failed to fetch maintenance requests' });
        }

        // Parse JSON fields
        const parsedRequests = requests.map(req => ({
            ...req,
            images: req.images ? JSON.parse(req.images) : []
        }));

        res.json(parsedRequests);
    });
});

// Get maintenance request by ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { role, userId } = req.user;

    const query = `
        SELECT mr.*, 
               p.title as property_title,
               p.address as property_address,
               t.username as tenant_name,
               t.email as tenant_email,
               t.phone as tenant_phone,
               l.username as landlord_name,
               l.email as landlord_email,
               l.phone as landlord_phone
        FROM maintenance_requests mr
        JOIN properties p ON mr.property_id = p.id
        JOIN users t ON mr.tenant_id = t.id
        JOIN users l ON mr.landlord_id = l.id
        WHERE mr.id = ?
    `;

    db.get(query, [id], (err, request) => {
        if (err) {
            console.error('Error fetching maintenance request:', err);
            return res.status(500).json({ error: 'Failed to fetch maintenance request' });
        }

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check authorization
        if (role === 'tenant' && request.tenant_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        if (role === 'landlord' && request.landlord_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Parse JSON fields
        request.images = request.images ? JSON.parse(request.images) : [];

        res.json(request);
    });
});

// Create maintenance request (tenant only)
router.post('/', authenticateToken, upload.array('images', 5), (req, res) => {
    const { role, userId } = req.user;

    if (role !== 'tenant') {
        return res.status(403).json({ error: 'Only tenants can create maintenance requests' });
    }

    const {
        property_id, title, description, category, priority
    } = req.body;

    // Validation
    if (!property_id || !title || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get landlord_id from property
    db.get('SELECT landlord_id FROM properties WHERE id = ?', [property_id], (err, property) => {
        if (err) {
            console.error('Error fetching property:', err);
            return res.status(500).json({ error: 'Failed to fetch property' });
        }

        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        // Verify tenant has access to this property (through lease)
        db.get(
            'SELECT * FROM leases WHERE property_id = ? AND tenant_id = ? AND status = "active"',
            [property_id, userId],
            (err, lease) => {
                if (err) {
                    console.error('Error verifying lease:', err);
                    return res.status(500).json({ error: 'Failed to verify lease' });
                }

                if (!lease) {
                    return res.status(403).json({ error: 'You do not have an active lease for this property' });
                }

                // Handle uploaded images
                const imageUrls = req.files ? req.files.map(file => `/uploads/maintenance/${file.filename}`) : [];

                const query = `
                    INSERT INTO maintenance_requests (
                        property_id, tenant_id, landlord_id, title, description,
                        category, priority, images
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const params = [
                    property_id, userId, property.landlord_id,
                    title, description, category || 'other',
                    priority || 'medium', JSON.stringify(imageUrls)
                ];

                db.run(query, params, function(err) {
                    if (err) {
                        console.error('Error creating maintenance request:', err);
                        return res.status(500).json({ error: 'Failed to create maintenance request' });
                    }

                    // Create notification for landlord
                    const notifQuery = `
                        INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
                        VALUES (?, 'maintenance_update', ?, ?, ?, 'maintenance')
                    `;
                    db.run(notifQuery, [
                        property.landlord_id,
                        'New Maintenance Request',
                        `New maintenance request: ${title}`,
                        this.lastID
                    ]);

                    res.status(201).json({
                        message: 'Maintenance request created successfully',
                        requestId: this.lastID
                    });
                });
            }
        );
    });
});

// Update maintenance request (landlord can update status, tenant can update details)
router.put('/:id', authenticateToken, upload.array('images', 5), (req, res) => {
    const { role, userId } = req.user;
    const { id } = req.params;

    // Fetch the maintenance request
    db.get('SELECT * FROM maintenance_requests WHERE id = ?', [id], (err, request) => {
        if (err) {
            console.error('Error fetching maintenance request:', err);
            return res.status(500).json({ error: 'Failed to fetch maintenance request' });
        }

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check authorization
        if (role === 'tenant' && request.tenant_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        if (role === 'landlord' && request.landlord_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const {
            title, description, category, priority, status,
            assigned_to, estimated_cost, actual_cost, scheduled_date,
            completed_date, notes
        } = req.body;

        // Handle new images
        let imageUrls = request.images ? JSON.parse(request.images) : [];
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/uploads/maintenance/${file.filename}`);
            imageUrls = [...imageUrls, ...newImages];
        }

        // Tenants can only update title, description, category, priority if status is pending
        // Landlords can update all fields
        let query, params;

        if (role === 'tenant') {
            if (request.status !== 'pending') {
                return res.status(403).json({ error: 'Cannot update request after it has been processed' });
            }

            query = `
                UPDATE maintenance_requests SET
                    title = COALESCE(?, title),
                    description = COALESCE(?, description),
                    category = COALESCE(?, category),
                    priority = COALESCE(?, priority),
                    images = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            params = [title, description, category, priority, JSON.stringify(imageUrls), id];
        } else {
            // Landlord update
            query = `
                UPDATE maintenance_requests SET
                    status = COALESCE(?, status),
                    assigned_to = COALESCE(?, assigned_to),
                    estimated_cost = COALESCE(?, estimated_cost),
                    actual_cost = COALESCE(?, actual_cost),
                    scheduled_date = COALESCE(?, scheduled_date),
                    completed_date = COALESCE(?, completed_date),
                    notes = COALESCE(?, notes),
                    priority = COALESCE(?, priority),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            params = [
                status, assigned_to, estimated_cost, actual_cost,
                scheduled_date, completed_date, notes, priority, id
            ];
        }

        db.run(query, params, function(err) {
            if (err) {
                console.error('Error updating maintenance request:', err);
                return res.status(500).json({ error: 'Failed to update maintenance request' });
            }

            // Create notification if status changed
            if (status && status !== request.status) {
                const notifQuery = `
                    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
                    VALUES (?, 'maintenance_update', ?, ?, ?, 'maintenance')
                `;
                db.run(notifQuery, [
                    request.tenant_id,
                    'Maintenance Request Updated',
                    `Your maintenance request status changed to: ${status}`,
                    id
                ]);
            }

            res.json({ message: 'Maintenance request updated successfully' });
        });
    });
});

// Delete maintenance request (tenant can delete if pending, landlord can always delete)
router.delete('/:id', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { id } = req.params;

    // Fetch the maintenance request
    db.get('SELECT * FROM maintenance_requests WHERE id = ?', [id], (err, request) => {
        if (err) {
            console.error('Error fetching maintenance request:', err);
            return res.status(500).json({ error: 'Failed to fetch maintenance request' });
        }

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Check authorization
        if (role === 'tenant') {
            if (request.tenant_id !== userId || request.status !== 'pending') {
                return res.status(403).json({ error: 'Can only delete pending requests' });
            }
        } else if (role === 'landlord') {
            if (request.landlord_id !== userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        db.run('DELETE FROM maintenance_requests WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('Error deleting maintenance request:', err);
                return res.status(500).json({ error: 'Failed to delete maintenance request' });
            }

            res.json({ message: 'Maintenance request deleted successfully' });
        });
    });
});

module.exports = router;
