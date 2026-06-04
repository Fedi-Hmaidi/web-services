import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import pool, { initNotificationSchema } from './db.js';
import { authenticate, requireAdmin } from './auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Active WebSocket connections: userId -> Set of WebSocket clients
const connections = new Map();

// Helper to push notification to a connected user in real time
function sendToUser(userId, notification) {
  const userSockets = connections.get(userId);
  if (userSockets) {
    const payload = JSON.stringify({ event: 'notification', data: notification });
    for (const socket of userSockets) {
      if (socket.readyState === 1) { // OPEN
        socket.send(payload);
      }
    }
  }
}

// REST Endpoints
app.get('/notifications', authenticate, async (req, res) => {
  try {
    let queryStr = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [req.user.id];
    
    if (req.query.unread === 'true') {
      queryStr += ' AND is_read = FALSE';
    }
    
    queryStr += ' ORDER BY created_at DESC';
    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des notifications', error: err.message });
  }
});

app.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la notification', error: err.message });
  }
});

app.post('/notifications/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour des notifications', error: err.message });
  }
});

// Internal endpoint to create notifications (triggered by other microservices)
app.post('/notifications', async (req, res) => {
  try {
    const { title, message, type, roles, userId } = req.body || {};

    if (!title || !message || !type) {
      return res.status(400).json({ message: 'Champs obligatoires manquants: title, message, type' });
    }

    // Deduplication for traffic congestion alerts (skip if sent within last 5 minutes)
    if (type === 'TRAFFIC') {
      const recent = await pool.query(
        `SELECT id FROM notifications 
         WHERE type = 'TRAFFIC' AND title = $1 AND created_at > NOW() - INTERVAL '5 minutes' 
         LIMIT 1`,
        [title]
      );
      if (recent.rows.length > 0) {
        return res.json({ message: 'Notification ignorée (doublon récent)' });
      }
    }

    let targetUserIds = [];

    if (userId) {
      targetUserIds.push(Number(userId));
    } else if (roles && roles.length > 0) {
      const usersRes = await pool.query('SELECT id FROM users WHERE role = ANY($1)', [roles]);
      targetUserIds = usersRes.rows.map(r => r.id);
    } else {
      const usersRes = await pool.query('SELECT id FROM users');
      targetUserIds = usersRes.rows.map(r => r.id);
    }

    const insertedNotifications = [];

    for (const uid of targetUserIds) {
      const insertRes = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read)
         VALUES ($1, $2, $3, $4, FALSE)
         RETURNING *`,
        [uid, title, message, type]
      );
      const newNotification = insertRes.rows[0];
      insertedNotifications.push(newNotification);
      
      // Deliver via WebSocket
      sendToUser(uid, newNotification);
    }

    res.json({ success: true, count: insertedNotifications.length, notifications: insertedNotifications });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création de la notification', error: err.message });
  }
});

// Admin-only broadcast announcement route
app.post('/notifications/announcement', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, message } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ message: 'Champs obligatoires: title, message' });
    }

    // Query all users to broadcast to everyone
    const usersRes = await pool.query('SELECT id FROM users');
    const targetUserIds = usersRes.rows.map(r => r.id);

    const inserted = [];
    for (const uid of targetUserIds) {
      const insertRes = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read)
         VALUES ($1, $2, $3, 'ANNOUNCEMENT', FALSE)
         RETURNING *`,
        [uid, title, message]
      );
      const newNotification = insertRes.rows[0];
      inserted.push(newNotification);
      
      // Deliver via WebSocket in real-time
      sendToUser(uid, newNotification);
    }

    res.json({ success: true, count: inserted.length, notifications: inserted });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la diffusion de l\'annonce', error: err.message });
  }
});

// WebSocket upgrade authorization & setup
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  const userId = ws.user.id;
  
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId).add(ws);

  console.log(`WebSocket client connecté pour l'utilisateur ID: ${userId} (${ws.user.username})`);

  ws.on('close', () => {
    const userSockets = connections.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        connections.delete(userId);
      }
    }
    console.log(`WebSocket client déconnecté pour l'utilisateur ID: ${userId}`);
  });
});

const PORT = process.env.PORT || 4006;
initNotificationSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Notification service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize Notification Service:', err);
    process.exit(1);
  });
