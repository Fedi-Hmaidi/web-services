import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initLogSchema } from './db.js';
import { authenticate, requireAdmin } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4005);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'logging-service' });
});

// Endpoint to create a log (internal usage)
app.post('/logs', async (req, res) => {
  const {
    log_type = 'APPLICATION',
    level = 'INFO',
    message,
    module,
    user_id,
    username,
    action,
    resource,
    context,
  } = req.body || {};

  if (!message || !module) {
    return res.status(400).json({ message: 'message and module are required' });
  }

  try {
    const contextStr = context && typeof context === 'object' 
      ? JSON.stringify(context) 
      : (context || null);

    const result = await pool.query(
      `INSERT INTO logs (log_type, level, message, module, user_id, username, action, resource, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        log_type,
        level,
        message,
        module,
        user_id || null,
        username || null,
        action || null,
        resource || null,
        contextStr,
      ]
    );

    // Trigger system notification for ADMIN if an APPLICATION error is logged
    if (log_type === 'APPLICATION' && level === 'ERROR') {
      const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4006';
      fetch(`${notificationServiceUrl}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Alerte Système : Erreur dans ${module}`,
          message: message,
          type: 'SYSTEM',
          roles: ['ADMIN']
        })
      }).catch(err => {
        console.error('Failed to send error notification:', err.message);
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error writing log:', error);
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement du log' });
  }
});

// Endpoint to retrieve logs (admin only, filterable, paginated)
app.get('/logs', authenticate, requireAdmin, async (req, res) => {
  const {
    log_type,
    level,
    module,
    username,
    action,
    search,
    page = 1,
    limit = 10,
  } = req.query || {};

  try {
    let queryParts = [];
    let queryParams = [];

    if (log_type) {
      queryParams.push(log_type);
      queryParts.push(`log_type = $${queryParams.length}`);
    }
    if (level) {
      queryParams.push(level);
      queryParts.push(`level = $${queryParams.length}`);
    }
    if (module) {
      queryParams.push(module);
      queryParts.push(`module = $${queryParams.length}`);
    }
    if (username) {
      queryParams.push(username);
      queryParts.push(`username = $${queryParams.length}`);
    }
    if (action) {
      queryParams.push(action);
      queryParts.push(`action = $${queryParams.length}`);
    }
    if (search) {
      queryParams.push(`%${search}%`);
      queryParts.push(`(message ILIKE $${queryParams.length} OR username ILIKE $${queryParams.length} OR action ILIKE $${queryParams.length} OR module ILIKE $${queryParams.length})`);
    }

    const whereClause = queryParts.length > 0 ? 'WHERE ' + queryParts.join(' AND ') : '';

    // Count query
    const countQuery = `SELECT COUNT(*)::integer FROM logs ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = countResult.rows[0].count;

    // Pagination limit & offset
    const offset = (Number(page) - 1) * Number(limit);
    
    // Clone parameters for select query
    const selectParams = [...queryParams];
    selectParams.push(Number(limit));
    const limitIndex = selectParams.length;
    selectParams.push(offset);
    const offsetIndex = selectParams.length;

    const dataQuery = `
      SELECT * FROM logs 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;
    const dataResult = await pool.query(dataQuery, selectParams);
    
    const pages = Math.ceil(total / Number(limit));

    res.json({
      logs: dataResult.rows,
      total,
      pages,
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
  }
});

async function start() {
  await initLogSchema();
  app.listen(port, () => {
    console.log(`Logging service running on ${port}`);
  });
}

start().catch((error) => {
  console.error('Logging service failed to start', error);
  process.exit(1);
});
