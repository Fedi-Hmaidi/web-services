import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool, { initAuthSchema } from './db.js';
import { authenticate, requireRole, signToken } from './auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

app.post('/auth/register', async (req, res) => {
  const { username, email, password, role = 'OPERATOR' } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email et password sont requis' });
  }

  if (!['ADMIN', 'OPERATOR'].includes(role)) {
    return res.status(400).json({ message: 'Role invalide' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role, created_at`,
    [username, email, hashedPassword, role]
  );

  const user = result.rows[0];
  const token = signToken(user);

  res.status(201).json({ user, token });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'email et password sont requis' });
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ message: 'Identifiants invalides' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ message: 'Identifiants invalides' });
  }

  const publicUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };

  res.json({ user: publicUser, token: signToken(publicUser) });
});

app.get('/auth/profile', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }

  res.json(result.rows[0]);
});

app.get('/auth/users', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const result = await pool.query(
    'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
  );

  res.json(result.rows);
});

async function start() {
  await initAuthSchema();
  app.listen(port, () => {
    console.log(`Auth service running on ${port}`);
  });
}

start().catch((error) => {
  console.error('Auth service failed to start', error);
  process.exit(1);
});

