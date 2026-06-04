import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initIncidentSchema } from './db.js';
import { authenticate } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4004);

app.use(cors());
app.use(express.json());

const ALLOWED_TYPES = ['Accident', 'Travaux', 'Route fermée', 'Embouteillage'];
const ALLOWED_STATUSES = ['Signalé', 'En cours', 'Résolu'];

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'incident-service' });
});

app.post('/incidents', authenticate, async (req, res) => {
  const { title, description, type, latitude, longitude } = req.body || {};

  if (!title || !type) {
    return res.status(400).json({ message: 'title et type sont requis' });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ message: `Le type doit être l'un des suivants: ${ALLOWED_TYPES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO incidents (title, description, type, status, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title,
        description || null,
        type,
        'Signalé',
        latitude !== undefined ? Number(latitude) : null,
        longitude !== undefined ? Number(longitude) : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error declaring incident:', error);
    res.status(500).json({ message: 'Erreur lors de la déclaration de l\'incident' });
  }
});

app.get('/incidents', authenticate, async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incidents ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting incidents:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des incidents' });
  }
});

app.patch('/incidents/:id/status', authenticate, async (req, res) => {
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ message: 'status est requis' });
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Le statut doit être l'un des suivants: ${ALLOWED_STATUSES.join(', ')}` });
  }

  try {
    const check = await pool.query('SELECT id FROM incidents WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Incident introuvable' });
    }

    const result = await pool.query(
      `UPDATE incidents 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating incident status:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut de l\'incident' });
  }
});

async function start() {
  await initIncidentSchema();
  app.listen(port, () => {
    console.log(`Incident service running on ${port}`);
  });
}

start().catch((error) => {
  console.error('Incident service failed to start', error);
  process.exit(1);
});
