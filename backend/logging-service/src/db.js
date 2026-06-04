import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

export async function initLogSchema() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      console.log(`Database not ready, retrying... (${retries} left)`);
      retries -= 1;
      if (retries === 0) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      log_type VARCHAR(50) NOT NULL,
      level VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      module VARCHAR(100) NOT NULL,
      user_id INTEGER,
      username VARCHAR(100),
      action VARCHAR(100),
      resource VARCHAR(100),
      context TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const res = await pool.query('SELECT COUNT(*) FROM logs');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('Seeding default logs for logging-service...');
    
    // Seed Application logs
    await pool.query(`
      INSERT INTO logs (log_type, level, message, module, context)
      VALUES 
        ('APPLICATION', 'INFO', 'Auth service started successfully on port 4001', 'auth-service', null),
        ('APPLICATION', 'DEBUG', 'Decoded JWT token for user admin (ID: 1)', 'auth-service', null),
        ('APPLICATION', 'WARN', 'Failed login attempt for email fake@user.com', 'auth-service', '{"ip": "192.168.1.50"}'),
        ('APPLICATION', 'ERROR', 'Database connection timeout in vehicle-service', 'vehicle-service', 'Error: connect ETIMEDOUT 172.29.0.2:5432\\n    at Connection._Config.connect (node_modules/pg/lib/connection.js:98:12)\\n    at Socket.<anonymous> (node_modules/pg/lib/connection.js:64:12)'),
        ('APPLICATION', 'INFO', 'Traffic service successfully loaded 3 circulation zones', 'traffic-service', null),
        ('APPLICATION', 'ERROR', 'Failed to update incident status: Incident not found', 'incident-service', 'Error: Incident with ID 999 does not exist\\n    at updateIncidentStatus (src/index.js:56:11)')
    `);

    // Seed Audit logs
    await pool.query(`
      INSERT INTO logs (log_type, level, message, module, user_id, username, action, resource, context)
      VALUES
        ('AUDIT', 'INFO', 'Utilisateur connecté avec succès', 'auth-service', 1, 'admin', 'LOGIN', 'users', '{"ip": "127.0.0.1"}'),
        ('AUDIT', 'INFO', 'Nouveau véhicule ajouté: AA-123-AA', 'vehicle-service', 1, 'admin', 'CREATE_VEHICLE', 'vehicles', '{"plate_number": "AA-123-AA", "model": "Clio"}'),
        ('AUDIT', 'INFO', 'Zone de circulation créée: Downtown / Centre Ville', 'traffic-service', 1, 'admin', 'CREATE_ZONE', 'traffic_zones', '{"latitude_min": 48.85, "latitude_max": 48.865}'),
        ('AUDIT', 'INFO', 'Incident déclaré: Accident majeur A89', 'incident-service', 2, 'operator1', 'DECLARE_INCIDENT', 'incidents', '{"type": "Accident", "status": "Signalé"}'),
        ('AUDIT', 'INFO', 'Statut de l''incident 1 mis à jour à ''En cours''', 'incident-service', 2, 'operator1', 'UPDATE_STATUS', 'incidents', '{"old_status": "Signalé", "new_status": "En cours"}')
    `);
  }
}

export default pool;
