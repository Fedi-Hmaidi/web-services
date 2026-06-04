import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

export async function initAuthSchema() {
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
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'OPERATOR',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

export default pool;

