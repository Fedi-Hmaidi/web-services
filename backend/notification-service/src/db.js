import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

export async function initNotificationSchema() {
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
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const res = await pool.query('SELECT COUNT(*) FROM notifications');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('Seeding default notifications for notification-service...');
    const usersRes = await pool.query('SELECT id FROM users LIMIT 10');
    for (const row of usersRes.rows) {
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, type, is_read)
        VALUES 
          ($1, 'Bienvenue !', 'Bienvenue sur la plateforme Smart Traffic Management. Votre centre de notifications est opérationnel.', 'SYSTEM', FALSE),
          ($1, 'Initialisation du Réseau', 'Le réseau de surveillance a été démarré avec succès.', 'SYSTEM', TRUE)
      `, [row.id]);
    }
  }
}

export default pool;
