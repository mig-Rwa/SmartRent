const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all leases (filtered by user role)
router.get('/', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { status, property_id } = req.query;

    let query = `
        SELECT l.*,
               p.title as property_title,
               p.address as property_address,
               p.city as property_city,
               t.username as tenant_name,
               t.email as tenant_email,
               t.phone as tenant_phone,
               t.first_name as tenant_first_name,
               t.last_name as tenant_last_name,
               ll.username as landlord_name,
               ll.email as landlord_email,
               ll.phone as landlord_phone
        FROM leases l
        JOIN properties p ON l.property_id = p.id
        JOIN users t ON l.tenant_id = t.id
        JOIN users ll ON l.landlord_id = ll.id
        WHERE 1=1
    `;
    const params = [];

    // Filter based on role
    if (role === 'tenant') {
        query += ' AND l.tenant_id = ?';
        params.push(userId);
    } else if (role === 'landlord') {
        query += ' AND l.landlord_id = ?';
        params.push(userId);
    }

    // Additional filters
    if (status) {
        query += ' AND l.status = ?';
        params.push(status);
    }

    if (property_id) {
        query += ' AND l.property_id = ?';
        params.push(parseInt(property_id));
    }

    query += ' ORDER BY l.created_at DESC';

    db.all(query, params, (err, leases) => {
        if (err) {
            console.error('Error fetching leases:', err);
            return res.status(500).json({ error: 'Failed to fetch leases' });
        }

        res.json(leases);
    });
});

// Get lease by ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { role, userId } = req.user;

    const query = `
        SELECT l.*,
               p.title as property_title,
               p.description as property_description,
               p.address as property_address,
               p.city as property_city,
               p.state as property_state,
               p.zip_code as property_zip_code,
               p.property_type,
               p.bedrooms,
               p.bathrooms,
               p.square_feet,
               t.username as tenant_name,
               t.email as tenant_email,
               t.phone as tenant_phone,
               t.first_name as tenant_first_name,
               t.last_name as tenant_last_name,
               ll.username as landlord_name,
               ll.email as landlord_email,
               ll.phone as landlord_phone,
               ll.first_name as landlord_first_name,
               ll.last_name as landlord_last_name
        FROM leases l
        JOIN properties p ON l.property_id = p.id
        JOIN users t ON l.tenant_id = t.id
        JOIN users ll ON l.landlord_id = ll.id
        WHERE l.id = ?
    `;

    db.get(query, [id], (err, lease) => {
        if (err) {
            console.error('Error fetching lease:', err);
            return res.status(500).json({ error: 'Failed to fetch lease' });
        }

        if (!lease) {
            return res.status(404).json({ error: 'Lease not found' });
        }

        // Check authorization
        if (role === 'tenant' && lease.tenant_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        if (role === 'landlord' && lease.landlord_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json(lease);
    });
});

// Create new lease (landlord only)
router.post('/', authenticateToken, (req, res) => {
    const { role, userId } = req.user;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Only landlords can create leases' });
    }

    const {
        property_id, tenant_id, start_date, end_date,
        monthly_rent, security_deposit, utilities_cost,
        payment_due_day, lease_document_url, notes
    } = req.body;

    // Validation
    if (!property_id || !tenant_id || !start_date || !end_date || !monthly_rent) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the property belongs to this landlord
    db.get('SELECT * FROM properties WHERE id = ? AND landlord_id = ?', [property_id, userId], (err, property) => {
        if (err) {
            console.error('Error fetching property:', err);
            return res.status(500).json({ error: 'Failed to fetch property' });
        }

        if (!property) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }

        // Verify tenant exists and has tenant role
        db.get('SELECT * FROM users WHERE id = ? AND role = "tenant"', [tenant_id], (err, tenant) => {
            if (err) {
                console.error('Error fetching tenant:', err);
                return res.status(500).json({ error: 'Failed to fetch tenant' });
            }

            if (!tenant) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            // Check for overlapping active leases for this property
            db.get(
                'SELECT * FROM leases WHERE property_id = ? AND status = "active"',
                [property_id],
                (err, existingLease) => {
                    if (err) {
                        console.error('Error checking existing leases:', err);
                        return res.status(500).json({ error: 'Failed to check existing leases' });
                    }

                    if (existingLease) {
                        return res.status(400).json({ 
                            error: 'Property already has an active lease',
                            existingLeaseId: existingLease.id
                        });
                    }

                    // Create the lease
                    const query = `
                        INSERT INTO leases (
                            property_id, tenant_id, landlord_id, start_date, end_date,
                            monthly_rent, security_deposit, utilities_cost, payment_due_day,
                            lease_document_url, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    const params = [
                        property_id, tenant_id, userId, start_date, end_date,
                        parseFloat(monthly_rent),
                        security_deposit ? parseFloat(security_deposit) : null,
                        utilities_cost ? parseFloat(utilities_cost) : 0,
                        payment_due_day || 1,
                        lease_document_url || null,
                        notes || null
                    ];

                    db.run(query, params, function(err) {
                        if (err) {
                            console.error('Error creating lease:', err);
                            return res.status(500).json({ error: 'Failed to create lease' });
                        }

                        // Update property status to occupied
                        db.run('UPDATE properties SET status = "occupied" WHERE id = ?', [property_id]);

                        // Create notification for tenant
                        const notifQuery = `
                            INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
                            VALUES (?, 'general', 'New Lease Agreement', 'A new lease agreement has been created for you', ?, 'lease')
                        `;
                        db.run(notifQuery, [tenant_id, this.lastID]);

                        res.status(201).json({
                            message: 'Lease created successfully',
                            leaseId: this.lastID
                        });
                    });
                }
            );
        });
    });
});

// Update lease (landlord only)
router.put('/:id', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { id } = req.params;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Only landlords can update leases' });
    }

    // Fetch the lease and verify ownership
    db.get('SELECT * FROM leases WHERE id = ? AND landlord_id = ?', [id, userId], (err, lease) => {
        if (err) {
            console.error('Error fetching lease:', err);
            return res.status(500).json({ error: 'Failed to fetch lease' });
        }

        if (!lease) {
            return res.status(404).json({ error: 'Lease not found or unauthorized' });
        }

        const {
            start_date, end_date, monthly_rent, security_deposit,
            utilities_cost, payment_due_day, status, lease_document_url, notes
        } = req.body;

        const updates = [];
        const params = [];

        if (start_date) { updates.push('start_date = ?'); params.push(start_date); }
        if (end_date) { updates.push('end_date = ?'); params.push(end_date); }
        if (monthly_rent) { updates.push('monthly_rent = ?'); params.push(parseFloat(monthly_rent)); }
        if (security_deposit !== undefined) { 
            updates.push('security_deposit = ?'); 
            params.push(security_deposit ? parseFloat(security_deposit) : null); 
        }
        if (utilities_cost !== undefined) { 
            updates.push('utilities_cost = ?'); 
            params.push(parseFloat(utilities_cost)); 
        }
        if (payment_due_day) { updates.push('payment_due_day = ?'); params.push(parseInt(payment_due_day)); }
        if (status) { updates.push('status = ?'); params.push(status); }
        if (lease_document_url) { updates.push('lease_document_url = ?'); params.push(lease_document_url); }
        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const query = `UPDATE leases SET ${updates.join(', ')} WHERE id = ?`;

        db.run(query, params, function(err) {
            if (err) {
                console.error('Error updating lease:', err);
                return res.status(500).json({ error: 'Failed to update lease' });
            }

            // If status changed to terminated/expired, update property status
            if (status && (status === 'terminated' || status === 'expired')) {
                db.run('UPDATE properties SET status = "available" WHERE id = ?', [lease.property_id]);
            } else if (status === 'active') {
                db.run('UPDATE properties SET status = "occupied" WHERE id = ?', [lease.property_id]);
            }

            // Notify tenant if status changed
            if (status && status !== lease.status) {
                const notifQuery = `
                    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
                    VALUES (?, 'general', 'Lease Status Updated', 'Your lease status has been updated to: ${status}', ?, 'lease')
                `;
                db.run(notifQuery, [lease.tenant_id, id]);
            }

            res.json({ message: 'Lease updated successfully' });
        });
    });
});

// Delete/Terminate lease (landlord only)
router.delete('/:id', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { id } = req.params;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Only landlords can delete leases' });
    }

    // Fetch the lease and verify ownership
    db.get('SELECT * FROM leases WHERE id = ? AND landlord_id = ?', [id, userId], (err, lease) => {
        if (err) {
            console.error('Error fetching lease:', err);
            return res.status(500).json({ error: 'Failed to fetch lease' });
        }

        if (!lease) {
            return res.status(404).json({ error: 'Lease not found or unauthorized' });
        }

        // Instead of deleting, we'll mark as terminated
        db.run(
            'UPDATE leases SET status = "terminated", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    console.error('Error terminating lease:', err);
                    return res.status(500).json({ error: 'Failed to terminate lease' });
                }

                // Update property status
                db.run('UPDATE properties SET status = "available" WHERE id = ?', [lease.property_id]);

                // Notify tenant
                const notifQuery = `
                    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
                    VALUES (?, 'general', 'Lease Terminated', 'Your lease has been terminated', ?, 'lease')
                `;
                db.run(notifQuery, [lease.tenant_id, id]);

                res.json({ message: 'Lease terminated successfully' });
            }
        );
    });
});

// Get leases for a specific property (landlord only)
router.get('/property/:propertyId', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { propertyId } = req.params;

    if (role !== 'landlord') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Verify property belongs to landlord
    db.get('SELECT * FROM properties WHERE id = ? AND landlord_id = ?', [propertyId, userId], (err, property) => {
        if (err) {
            console.error('Error fetching property:', err);
            return res.status(500).json({ error: 'Failed to fetch property' });
        }

        if (!property) {
            return res.status(404).json({ error: 'Property not found or unauthorized' });
        }

        const query = `
            SELECT l.*,
                   t.username as tenant_name,
                   t.email as tenant_email,
                   t.phone as tenant_phone,
                   t.first_name as tenant_first_name,
                   t.last_name as tenant_last_name
            FROM leases l
            JOIN users t ON l.tenant_id = t.id
            WHERE l.property_id = ?
            ORDER BY l.created_at DESC
        `;

        db.all(query, [propertyId], (err, leases) => {
            if (err) {
                console.error('Error fetching leases:', err);
                return res.status(500).json({ error: 'Failed to fetch leases' });
            }

            res.json(leases);
        });
    });
});

// Get leases for a specific tenant
router.get('/tenant/:tenantId', authenticateToken, (req, res) => {
    const { role, userId } = req.user;
    const { tenantId } = req.params;

    // Tenants can only view their own leases
    if (role === 'tenant' && parseInt(tenantId) !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const query = `
        SELECT l.*,
               p.title as property_title,
               p.address as property_address,
               p.city as property_city,
               p.state as property_state,
               ll.username as landlord_name,
               ll.email as landlord_email,
               ll.phone as landlord_phone,
               ll.first_name as landlord_first_name,
               ll.last_name as landlord_last_name
        FROM leases l
        JOIN properties p ON l.property_id = p.id
        JOIN users ll ON l.landlord_id = ll.id
        WHERE l.tenant_id = ?
        ORDER BY l.created_at DESC
    `;

    db.all(query, [tenantId], (err, leases) => {
        if (err) {
            console.error('Error fetching leases:', err);
            return res.status(500).json({ error: 'Failed to fetch leases' });
        }

        res.json(leases);
    });
});

module.exports = router;
