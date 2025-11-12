const app = require('./app');
const config = require('./config/config');
const db = require('./config/database');

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    process.exit(1);
});

const server = app.listen(config.port, () => {
    console.log(`🚀 SmartRent Server running in ${config.nodeEnv} mode on port ${config.port}`);
    console.log(`📊 Database: ${config.dbPath}`);
    console.log(`🔗 API available at: http://localhost:${config.port}/api`);
});

// --- Background task: Check for expired leases every day ---
const LEASE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkExpiredLeases() {
  const today = new Date().toISOString().split('T')[0];
  const sql = `UPDATE leases
               SET status = 'expired', updated_at = CURRENT_TIMESTAMP
               WHERE status = 'active'
                 AND end_date < ?`;
  db.run(sql, [today], function (err) {
    if (err) {
      console.error('❌ Lease expiration job error:', err);
    } else if (this.changes) {
      console.log(`✅ [Lease Job] Marked ${this.changes} leases as expired`);
      
      // Also update property status to available
      db.run(`UPDATE properties SET status = 'available' 
              WHERE id IN (SELECT property_id FROM leases WHERE status = 'expired')`,
        (err) => {
          if (err) console.error('Error updating property status:', err);
        }
      );
    }
  });
}

// Run lease check every 24 hours
setInterval(checkExpiredLeases, LEASE_CHECK_INTERVAL_MS);
// Run once at startup
checkExpiredLeases();

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
}); 