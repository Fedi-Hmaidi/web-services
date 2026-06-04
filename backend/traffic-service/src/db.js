import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

export async function initTrafficSchema() {
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
    CREATE TABLE IF NOT EXISTS traffic_zones (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      latitude_min DOUBLE PRECISION NOT NULL,
      latitude_max DOUBLE PRECISION NOT NULL,
      longitude_min DOUBLE PRECISION NOT NULL,
      longitude_max DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const res = await pool.query('SELECT COUNT(*) FROM traffic_zones');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('Seeding default traffic zones...');
    await pool.query(`
      INSERT INTO traffic_zones (name, latitude_min, latitude_max, longitude_min, longitude_max)
      VALUES 
        ('Downtown / Centre Ville', 48.8500, 48.8650, 2.3300, 2.3600),
        ('North Corridor / Zone Nord', 48.8700, 48.8900, 2.3200, 2.3500),
        ('West Ring Road / Périphérique Ouest', 48.8300, 48.8500, 2.2400, 2.2800)
    `);
  }
}

export default pool;
