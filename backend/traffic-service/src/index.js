import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initTrafficSchema } from './db.js';
import { authenticate } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4003);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'traffic-service' });
});

app.post('/traffic/zones', authenticate, async (req, res) => {
  const { name, latitude_min, latitude_max, longitude_min, longitude_max } = req.body || {};

  if (!name || latitude_min === undefined || latitude_max === undefined || longitude_min === undefined || longitude_max === undefined) {
    return res.status(400).json({ message: 'name, latitude_min, latitude_max, longitude_min, et longitude_max sont requis' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO traffic_zones (name, latitude_min, latitude_max, longitude_min, longitude_max)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, Number(latitude_min), Number(latitude_max), Number(longitude_min), Number(longitude_max)]
    );

    const zone = result.rows[0];
    res.status(201).json({
      ...zone,
      density: 0,
      classification: 'Faible',
      is_congested: false,
    });
  } catch (error) {
    console.error('Error creating traffic zone:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la zone de circulation' });
  }
});

app.get('/traffic/zones', authenticate, async (_req, res) => {
  try {
    // Check if vehicle_positions table exists before running join, otherwise return density 0
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'vehicle_positions'
      );
    `);

    let queryStr = `
      SELECT id, name, latitude_min, latitude_max, longitude_min, longitude_max, created_at, 0 as density
      FROM traffic_zones
      ORDER BY id ASC
    `;

    if (tableCheck.rows[0].exists) {
      queryStr = `
        WITH latest_positions AS (
          SELECT DISTINCT ON (vehicle_id) vehicle_id, latitude, longitude
          FROM vehicle_positions
          ORDER BY vehicle_id, recorded_at DESC
        )
        SELECT 
          z.id, 
          z.name, 
          z.latitude_min, 
          z.latitude_max, 
          z.longitude_min, 
          z.longitude_max,
          z.created_at,
          COUNT(lp.vehicle_id)::integer AS density
        FROM traffic_zones z
        LEFT JOIN latest_positions lp ON 
          lp.latitude >= z.latitude_min AND 
          lp.latitude <= z.latitude_max AND 
          lp.longitude >= z.longitude_min AND 
          lp.longitude <= z.longitude_max
        GROUP BY z.id
        ORDER BY z.id ASC
      `;
    }

    const result = await pool.query(queryStr);
    
    const zones = result.rows.map((row) => {
      const density = Number(row.density || 0);
      let classification = 'Faible';
      if (density >= 6) {
        classification = 'Élevé';
      } else if (density >= 3) {
        classification = 'Moyen';
      }
      return {
        ...row,
        density,
        classification,
        is_congested: classification === 'Élevé',
      };
    });

    res.json(zones);
  } catch (error) {
    console.error('Error getting traffic zones:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des zones' });
  }
});

async function start() {
  await initTrafficSchema();
  app.listen(port, () => {
    console.log(`Traffic service running on ${port}`);
  });
}

start().catch((error) => {
  console.error('Traffic service failed to start', error);
  process.exit(1);
});
