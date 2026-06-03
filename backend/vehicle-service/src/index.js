import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initVehicleSchema } from './db.js';
import { authenticate } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4002);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vehicle-service' });
});

app.post('/vehicles', authenticate, async (req, res) => {
  const { plate_number, model, brand, vehicle_year, status = 'ACTIVE' } = req.body || {};

  if (!plate_number || !model || !brand) {
    return res.status(400).json({ message: 'plate_number, model et brand sont requis' });
  }

  const result = await pool.query(
    `INSERT INTO vehicles (plate_number, model, brand, vehicle_year, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [plate_number, model, brand, vehicle_year || null, status]
  );

  res.status(201).json(result.rows[0]);
});

app.get('/vehicles', authenticate, async (_req, res) => {
  const result = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
  res.json(result.rows);
});

app.get('/vehicles/:id', authenticate, async (req, res) => {
  const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Véhicule introuvable' });
  }

  res.json(result.rows[0]);
});

app.post('/vehicles/:id/positions', authenticate, async (req, res) => {
  const { latitude, longitude, speed } = req.body || {};

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'latitude et longitude sont requis' });
  }

  const vehicle = await pool.query('SELECT id FROM vehicles WHERE id = $1', [req.params.id]);
  if (vehicle.rows.length === 0) {
    return res.status(404).json({ message: 'Véhicule introuvable' });
  }

  const result = await pool.query(
    `INSERT INTO vehicle_positions (vehicle_id, latitude, longitude, speed)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [req.params.id, latitude, longitude, speed ?? null]
  );

  res.status(201).json(result.rows[0]);
});

app.get('/vehicles/:id/history', authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM vehicle_positions
     WHERE vehicle_id = $1
     ORDER BY recorded_at DESC`,
    [req.params.id]
  );

  res.json(result.rows);
});

async function start() {
  await initVehicleSchema();
  app.listen(port, () => {
    console.log(`Vehicle service running on ${port}`);
  });
}

start().catch((error) => {
  console.error('Vehicle service failed to start', error);
  process.exit(1);
});

