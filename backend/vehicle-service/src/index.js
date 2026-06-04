import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initVehicleSchema } from './db.js';
import { authenticate } from './auth.js';

import { logEvent, notifyEvent } from './logger.js';

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

  try {
    const result = await pool.query(
      `INSERT INTO vehicles (plate_number, model, brand, vehicle_year, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [plate_number, model, brand, vehicle_year || null, status]
    );

    const vehicle = result.rows[0];

    logEvent({
      log_type: 'AUDIT',
      level: 'INFO',
      message: `Véhicule enregistré: ${brand} ${model} (${plate_number})`,
      module: 'vehicle-service',
      user_id: req.user.id,
      username: req.user.username,
      action: 'CREATE_VEHICLE',
      resource: 'vehicles',
      context: { vehicle_id: vehicle.id }
    });

    notifyEvent({
      title: `Nouveau véhicule enregistré`,
      message: `Le véhicule ${brand} ${model} (${plate_number}) a été ajouté par ${req.user.username}.`,
      type: 'VEHICLE',
      roles: ['ADMIN', 'OPERATOR']
    });

    res.status(201).json(vehicle);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: `Erreur lors de la création du véhicule avec plaque ${plate_number}`,
      module: 'vehicle-service',
      context: error.stack
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.get('/vehicles', authenticate, async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: 'Erreur lors de la récupération de la liste des véhicules',
      module: 'vehicle-service',
      context: error.stack
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.get('/vehicles/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: `Erreur lors de la récupération du véhicule ${req.params.id}`,
      module: 'vehicle-service',
      context: error.stack
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.post('/vehicles/:id/positions', authenticate, async (req, res) => {
  const { latitude, longitude, speed } = req.body || {};

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'latitude et longitude sont requis' });
  }

  try {
    const vehicle = await pool.query('SELECT id, plate_number FROM vehicles WHERE id = $1', [req.params.id]);
    if (vehicle.rows.length === 0) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    const result = await pool.query(
      `INSERT INTO vehicle_positions (vehicle_id, latitude, longitude, speed)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, latitude, longitude, speed ?? null]
    );

    const position = result.rows[0];

    logEvent({
      log_type: 'AUDIT',
      level: 'INFO',
      message: `Position mise à jour pour le véhicule: ${vehicle.rows[0].plate_number}`,
      module: 'vehicle-service',
      user_id: req.user.id,
      username: req.user.username,
      action: 'ADD_POSITION',
      resource: 'vehicle_positions',
      context: { latitude, longitude, speed }
    });

    // Check for congestion in traffic zones
    try {
      const checkCongestion = await pool.query(`
        WITH latest_positions AS (
          SELECT DISTINCT ON (vehicle_id) vehicle_id, latitude, longitude
          FROM vehicle_positions
          ORDER BY vehicle_id, recorded_at DESC
        ),
        zones_with_density AS (
          SELECT 
            z.id, 
            z.name,
            COUNT(lp.vehicle_id)::integer AS density
          FROM traffic_zones z
          LEFT JOIN latest_positions lp ON 
            lp.latitude >= z.latitude_min AND 
            lp.latitude <= z.latitude_max AND 
            lp.longitude >= z.longitude_min AND 
            lp.longitude <= z.longitude_max
          GROUP BY z.id
        )
        SELECT * FROM zones_with_density WHERE density >= 6
      `);

      for (const zone of checkCongestion.rows) {
        notifyEvent({
          title: `Congestion détectée : ${zone.name}`,
          message: `La zone '${zone.name}' est actuellement surchargée avec une densité de ${zone.density} véhicules.`,
          type: 'TRAFFIC',
          roles: ['ADMIN', 'OPERATOR']
        });
      }
    } catch (err) {
      console.error('Erreur lors de la vérification de la congestion:', err.message);
    }

    res.status(201).json(position);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: `Erreur lors de l'enregistrement de position pour le véhicule ${req.params.id}`,
      module: 'vehicle-service',
      context: error.stack
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
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

