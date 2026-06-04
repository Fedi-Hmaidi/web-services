import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initIncidentSchema } from './db.js';
import { authenticate } from './auth.js';

import { logEvent, notifyEvent } from './logger.js';

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

    const incident = result.rows[0];

    logEvent({
      log_type: 'AUDIT',
      level: 'INFO',
      message: `Nouvel incident déclaré: ${title} (${type})`,
      module: 'incident-service',
      user_id: req.user.id,
      username: req.user.username,
      action: 'DECLARE_INCIDENT',
      resource: 'incidents',
      context: { incident_id: incident.id, type, latitude, longitude }
    });

    notifyEvent({
      title: `Nouvel incident signalé : ${type}`,
      message: `${title} - ${description || 'Pas de description'}`,
      type: 'INCIDENT',
      roles: ['ADMIN', 'OPERATOR']
    });

    res.status(201).json(incident);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: `Erreur lors de la déclaration de l'incident ${title}`,
      module: 'incident-service',
      context: error.stack
    });
    res.status(500).json({ message: 'Erreur lors de la déclaration de l\'incident' });
  }
});

app.get('/incidents', authenticate, async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incidents ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: 'Erreur lors de la récupération des incidents',
      module: 'incident-service',
      context: error.stack
    });
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
    const check = await pool.query('SELECT id, status FROM incidents WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
      logEvent({
        log_type: 'APPLICATION',
        level: 'WARN',
        message: `Tentative de mise à jour d'un incident inexistant (ID: ${req.params.id})`,
        module: 'incident-service'
      });
      return res.status(404).json({ message: 'Incident introuvable' });
    }

    const oldStatus = check.rows[0].status;

    const result = await pool.query(
      `UPDATE incidents 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, req.params.id]
    );

    const updatedIncident = result.rows[0];

    logEvent({
      log_type: 'AUDIT',
      level: 'INFO',
      message: `Statut de l'incident mis à jour: ID ${req.params.id} -> ${status}`,
      module: 'incident-service',
      user_id: req.user.id,
      username: req.user.username,
      action: 'UPDATE_STATUS',
      resource: 'incidents',
      context: { incident_id: req.params.id, old_status: oldStatus, new_status: status }
    });

    notifyEvent({
      title: `Statut d'incident mis à jour`,
      message: `L'incident '${updatedIncident.title}' (${updatedIncident.type}) est maintenant '${status}'.`,
      type: 'INCIDENT',
      roles: ['ADMIN', 'OPERATOR']
    });

    res.json(updatedIncident);
  } catch (error) {
    logEvent({
      log_type: 'APPLICATION',
      level: 'ERROR',
      message: `Erreur lors de la mise à jour du statut de l'incident ${req.params.id}`,
      module: 'incident-service',
      context: error.stack
    });
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
