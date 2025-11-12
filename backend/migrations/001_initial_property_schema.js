/**
 * Migration: Initial Property Management Schema
 * This migration sets up the SmartRent database schema
 * Run with: npm run migrate
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'smartrent.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration: Initial Property Management Schema');

db.serialize(() => {
    // Drop old fitness-related tables if they exist
    const oldTables = [
        'workouts', 'exercises', 'progress', 'food_entries', 
        'progress_entries', 'goals', 'health_metrics', 
        'bookings', 'memberships', 'membership_plans'
    ];

    console.log('Removing old fitness-related tables...');
    oldTables.forEach(table => {
        db.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
            if (err) {
                console.error(`Error dropping table ${table}:`, err);
            } else {
                console.log(`Dropped table: ${table}`);
            }
        });
    });

    // Update users table to add role column if not exists
    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'tenant'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding role column:', err);
        } else {
            console.log('Added role column to users table');
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN first_name TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding first_name column:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN last_name TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding last_name column:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding phone column:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding avatar_url column:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding updated_at column:', err);
        }
    });

    console.log('Migration completed successfully!');
    console.log('SmartRent database schema is ready.');
});

// Close database after a short delay to ensure all operations complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
}, 2000);
