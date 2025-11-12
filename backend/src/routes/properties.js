const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for property images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/properties/');
    },
    filename: (req, file, cb) => {
        cb(null, `property-${Date.now()}${path.extname(file.originalname)}`);
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

// Get all properties (with filters)
router.get('/', authenticateToken, (req, res) => {
    const { city, property_type, min_rent, max_rent, status, landlord_id } = req.query;
    
    let query = 'SELECT p.*, u.username as landlord_name, u.email as landlord_email, u.phone as landlord_phone FROM properties p JOIN users u ON p.landlord_id = u.id WHERE 1=1';
    const params = [];

    if (city) {
        query += ' AND p.city LIKE ?';
        params.push(`%${city}%`);
    }

    if (property_type) {
        query += ' AND p.property_type = ?';
        params.push(property_type);
    }

    if (min_rent) {
        query += ' AND p.rent_amount >= ?';
        params.push(parseFloat(min_rent));
    }

    if (max_rent) {
        query += ' AND p.rent_amount <= ?';
        params.push(parseFloat(max_rent));
    }

    if (status) {
        query += ' AND p.status = ?';
        params.push(status);
    }

    if (landlord_id) {
        query += ' AND p.landlord_id = ?';
        params.push(parseInt(landlord_id));
    }

    query += ' ORDER BY p.created_at DESC';

    db.all(query, params, (err, properties) => {
        if (err) {
            console.error('Error fetching properties:', err);
            return res.status(500).json({ error: 'Failed to fetch properties' });
        }

        // Parse JSON fields
        const parsedProperties = properties.map(prop => ({
            ...prop,
            images: prop.images ? JSON.parse(prop.images) : [],
            amenities: prop.amenities ? JSON.parse(prop.amenities) : []
        }));

        res.json(parsedProperties);
    });
});

// Get property by ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT p.*, 
               u.username as landlord_name, 
               u.email as landlord_email, 
               u.phone as landlord_phone,
               u.first_name as landlord_first_name,
               u.last_name as landlord_last_name
        FROM properties p 
        JOIN users u ON p.landlord_id = u.id 
        WHERE p.id = ?
    `;

    db.get(query, [id], (err, property) => {
        if (err) {
            console.error('Error fetching property:', err);
            return res.status(500).json({ error: 'Failed to fetch property' });
        }

        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        // Parse JSON fields
        property.images = property.images ? JSON.parse(property.images) : [];
        property.amenities = property.amenities ? JSON.parse(property.amenities) : [];

        res.json(property);
    });
});

// Create new property (landlord only)
router.post('/', authenticateToken, upload.array('images', 10), (req, res) => {
    const { role, userId } = req.user;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Only landlords can create properties' });
    }

    const {
        title, description, address, city, state, zip_code,
        property_type, bedrooms, bathrooms, square_feet,
        rent_amount, security_deposit, utilities_included,
        pet_friendly, parking_available, amenities
    } = req.body;

    // Validation
    if (!title || !address || !city || !property_type || !rent_amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Handle uploaded images
    const imageUrls = req.files ? req.files.map(file => `/uploads/properties/${file.filename}`) : [];

    const query = `
        INSERT INTO properties (
            landlord_id, title, description, address, city, state, zip_code,
            property_type, bedrooms, bathrooms, square_feet, rent_amount,
            security_deposit, utilities_included, pet_friendly, parking_available,
            images, amenities
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        userId, title, description, address, city, state, zip_code,
        property_type, bedrooms || null, bathrooms || null, square_feet || null,
        parseFloat(rent_amount), security_deposit || null,
        utilities_included ? 1 : 0, pet_friendly ? 1 : 0, parking_available ? 1 : 0,
        JSON.stringify(imageUrls),
        amenities ? JSON.stringify(amenities) : null
    ];

    db.run(query, params, function(err) {
        if (err) {
            console.error('Error creating property:', err);
            return res.status(500).json({ error: 'Failed to create property' });
        }

        res.status(201).json({
            message: 'Property created successfully',
            propertyId: this.lastID
        });
    });
});

// Update property (landlord only)
router.put('/:id', authenticateToken, upload.array('images', 10), (req, res) => {
    const { role, userId } = req.user;
    const { id } = req.params;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Only landlords can update properties' });
    }

    // First verify the property belongs to this landlord
    db.get('SELECT * FROM properties WHERE id = ? AND landlord_id = ?', [id, userId], (err, property) => {
        if (err) {
            console.error('Error fetching property:', err);
            return res.status(500).json({ error: 'Failed to fetch property' });
        }

        if (!property) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }

        const {
            title, description, address, city, state, zip_code,
            property_type, bedrooms, bathrooms, square_feet,
            rent_amount, security_deposit, utilities_included,
            pet_friendly, parking_available, status, amenities
        } = req.body;

        // Handle new images
        let imageUrls = property.images ? JSON.parse(property.images) : [];
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/uploads/properties/${file.filename}`);
            imageUrls = [...imageUrls, ...newImages];
        }

        const query = `
            UPDATE properties SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                address = COALESCE(?, address),
                city = COALESCE(?, city),
                state = COALESCE(?, state),
                zip_code = COALESCE(?, zip_code),
                property_type = COALESCE(?, property_type),
                bedrooms = COALESCE(?, bedrooms),
                bathrooms = COALESCE(?, bathrooms),
                square_feet = COALESCE(?, square_feet),
                rent_amount = COALESCE(?, rent_amount),
                security_deposit = COALESCE(?, security_deposit),
                utilities_included = COALESCE(?, utilities_included),
                pet_friendly = COALESCE(?, pet_friendly),
                parking_available = COALESCE(?, parking_available),
                status = COALESCE(?, status),
                images = ?,
                amenities = COALESCE(?, amenities),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const params = [
            title, description, address, city, state, zip_code,
            property_type, bedrooms, bathrooms, square_feet,
            rent_amount ? parseFloat(rent_amount) : null,
            security_deposit ? parseFloat(security_deposit) : null,
            utilities_included !== undefined ? (utilities_included ? 1 : 0) : null,
            pet_friendly !== undefined ? (pet_friendly ? 1 : 0) : null,
            parking_available !== undefined ? (parking_available ? 1 : 0) : null,
            status,
            JSON.stringify(imageUrls),
            amenities ? JSON.stringify(amenities) : null,
            id
        ];

        db.run(query, params, function(err) {
            if (err) {
                console.error('Error updating property:', err);
                return res.status(500).json({ error: 'Failed to update property' });
            }

            res.json({ message: 'Property updated successfully' });
        });
    });
});

// Delete property (landlord only)
router.delete('/:id', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { id } = req.params;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Only landlords can delete properties' });
    }

    // Verify the property belongs to this landlord
    db.run('DELETE FROM properties WHERE id = ? AND landlord_id = ?', [id, userId], function(err) {
        if (err) {
            console.error('Error deleting property:', err);
            return res.status(500).json({ error: 'Failed to delete property' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }

        res.json({ message: 'Property deleted successfully' });
    });
});

// Get properties by landlord
router.get('/landlord/:landlordId', authenticateToken, (req, res) => {
    const { landlordId } = req.params;
    const { role, userId } = req.user;

    // Landlords can only see their own properties, tenants can see any landlord's properties
    if (role === 'landlord' && parseInt(landlordId) !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const query = 'SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC';

    db.all(query, [landlordId], (err, properties) => {
        if (err) {
            console.error('Error fetching properties:', err);
            return res.status(500).json({ error: 'Failed to fetch properties' });
        }

        const parsedProperties = properties.map(prop => ({
            ...prop,
            images: prop.images ? JSON.parse(prop.images) : [],
            amenities: prop.amenities ? JSON.parse(prop.amenities) : []
        }));

        res.json(parsedProperties);
    });
});

module.exports = router;
