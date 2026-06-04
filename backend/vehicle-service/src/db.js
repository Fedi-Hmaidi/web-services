import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

export async function initVehicleSchema() {
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
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      plate_number VARCHAR(50) NOT NULL UNIQUE,
      model VARCHAR(100) NOT NULL,
      brand VARCHAR(100) NOT NULL,
      vehicle_year INTEGER,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_positions (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      speed DOUBLE PRECISION,
      recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const res = await pool.query('SELECT COUNT(*) FROM vehicles');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('Seeding default vehicles and positions...');
    
    // Seed vehicles
    const v1 = await pool.query(`
      INSERT INTO vehicles (plate_number, model, brand, vehicle_year, status)
      VALUES ('AA-123-AA', 'Clio', 'Renault', 2020, 'ACTIVE') RETURNING id
    `);
    const v2 = await pool.query(`
      INSERT INTO vehicles (plate_number, model, brand, vehicle_year, status)
      VALUES ('BB-456-BB', '208', 'Peugeot', 2021, 'ACTIVE') RETURNING id
    `);
    const v3 = await pool.query(`
      INSERT INTO vehicles (plate_number, model, brand, vehicle_year, status)
      VALUES ('CC-789-CC', 'Model 3', 'Tesla', 2022, 'ACTIVE') RETURNING id
    `);
    const v4 = await pool.query(`
      INSERT INTO vehicles (plate_number, model, brand, vehicle_year, status)
      VALUES ('DD-101-DD', 'Golf', 'Volkswagen', 2019, 'ACTIVE') RETURNING id
    `);

    const id1 = v1.rows[0].id;
    const id2 = v2.rows[0].id;
    const id3 = v3.rows[0].id;
    const id4 = v4.rows[0].id;

    // Seed vehicle positions
    // Downtown: lat 48.8500 to 48.8650, lng 2.3300 to 2.3600
    await pool.query(`
      INSERT INTO vehicle_positions (vehicle_id, latitude, longitude, speed)
      VALUES 
        ($1, 48.8550, 2.3450, 35.5),
        ($2, 48.8580, 2.3520, 12.0)
    `, [id1, id2]);

    // North Corridor: lat 48.8700 to 48.8900, lng 2.3200 to 2.3500
    await pool.query(`
      INSERT INTO vehicle_positions (vehicle_id, latitude, longitude, speed)
      VALUES ($1, 48.8750, 2.3350, 48.2)
    `, [id3]);

    // West Ring Road: lat 48.8300 to 48.8500, lng 2.2400 to 2.2800
    await pool.query(`
      INSERT INTO vehicle_positions (vehicle_id, latitude, longitude, speed)
      VALUES ($1, 48.8400, 2.2600, 70.0)
    `, [id4]);
  }
}

export default pool;

