import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

export async function initIncidentSchema() {
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
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Signalé',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const res = await pool.query('SELECT COUNT(*) FROM incidents');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('Seeding default incidents...');
    await pool.query(`
      INSERT INTO incidents (title, description, type, status, latitude, longitude)
      VALUES 
        ('Accident majeur A89', 'Collision entre deux véhicules bloquant la voie de droite.', 'Accident', 'Signalé', 48.8566, 2.3522),
        ('Travaux Boulevard Saint-Germain', 'Travaux de voirie prévus sur la chaussée principale.', 'Travaux', 'En cours', 48.8512, 2.3421),
        ('Fermeture temporaire Rue de Rivoli', 'Route fermée pour travaux d''assainissement.', 'Route fermée', 'Résolu', 48.8738, 2.2950)
    `);
  }
}

export default pool;
