const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'traceo_secret_v2_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || null;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || null;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ════════════════════════════════════════════
// POSTGRESQL
// ════════════════════════════════════════════
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'manager',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      company_id TEXT PRIMARY KEY,
      plan TEXT DEFAULT 'trial',
      active BOOLEAN DEFAULT true,
      trial_ends_at TIMESTAMPTZ,
      deliveries_this_month INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      key TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deliverers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      whatsapp TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'deliverer',
      company_id TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_whatsapp TEXT,
      description TEXT,
      deliverer_id TEXT,
      company_id TEXT NOT NULL,
      company_name TEXT,
      location_token TEXT UNIQUE,
      token_expiry TIMESTAMPTZ,
      client_lat DOUBLE PRECISION,
      client_lng DOUBLE PRECISION,
      client_location_shared_at TIMESTAMPTZ,
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'panel',
      whatsapp_client_sent BOOLEAN DEFAULT false,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id TEXT PRIMARY KEY,
      phone TEXT,
      message TEXT,
      company_name TEXT,
      status TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Admin par défaut
  const existing = await pool.query("SELECT id FROM users WHERE email = 'admin@traceo.cm'");
  if (existing.rows.length === 0) {
    await pool.query(
      'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
      ['admin-001', 'Admin Traceo', 'admin@traceo.cm', bcrypt.hashSync('admin123', 10), 'admin']
    );
    console.log('✅ Admin créé: admin@traceo.cm / admin123');
  }

  console.log('✅ Base de données initialisée');
};

// ════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════

const sendWhatsApp = async (phone, message, companyName = 'Traceo') => {
  const cleanPhone = phone.replace(/\D/g, '');
  const logId = uuidv4();

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    await pool.query(
      'INSERT INTO whatsapp_logs (id, phone, message, company_name, status) VALUES ($1,$2,$3,$4,$5)',
      [logId, cleanPhone, message, companyName, 'simulated']
    );
    console.log(`📱 [WhatsApp SIMULÉ → ${cleanPhone}]: ${message.substring(0, 80)}...`);
    return { simulated: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: cleanPhone, type: 'text', text: { body: message } })
    });
    const status = res.ok ? 'sent' : 'failed';
    await pool.query(
      'INSERT INTO whatsapp_logs (id, phone, message, company_name, status) VALUES ($1,$2,$3,$4,$5)',
      [logId, cleanPhone, message, companyName, status]
    );
    return await res.json();
  } catch (e) {
    await pool.query(
      'INSERT INTO whatsapp_logs (id, phone, message, company_name, status) VALUES ($1,$2,$3,$4,$5)',
      [logId, cleanPhone, message, companyName, 'error']
    );
    throw e;
  }
};

const getSubscription = async (companyId) => {
  const res = await pool.query('SELECT * FROM subscriptions WHERE company_id = $1', [companyId]);
  if (res.rows.length === 0) {
    return { plan: 'trial', active: true, trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), deliveries_this_month: 0 };
  }
  return res.rows[0];
};

const checkLimits = async (companyId) => {
  const sub = await getSubscription(companyId);
  const plans = { starter: { maxDeliveries: 100 }, business: { maxDeliveries: -1 }, pro: { maxDeliveries: -1 }, trial: { maxDeliveries: 100 } };
  if (!sub.active) return { allowed: false, reason: 'Abonnement inactif' };
  if (sub.plan === 'trial' && new Date() > new Date(sub.trial_ends_at)) return { allowed: false, reason: "Période d'essai expirée" };
  const plan = plans[sub.plan];
  if (plan && plan.maxDeliveries !== -1 && sub.deliveries_this_month >= plan.maxDeliveries) return { allowed: false, reason: 'Limite de livraisons atteinte' };
  return { allowed: true };
};

const generateApiKey = async (companyId) => {
  const key = `tk_live_${crypto.randomBytes(24).toString('hex')}`;
  await pool.query('INSERT INTO api_keys (key, company_id) VALUES ($1, $2)', [key, companyId]);
  return key;
};

// ════════════════════════════════════════════
// MIDDLEWARES
// ════════════════════════════════════════════
const auth = (roles = []) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ error: 'Accès refusé' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
};

const apiKeyAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'Clé API manquante' });
  const result = await pool.query('SELECT * FROM api_keys WHERE key = $1 AND active = true', [key]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'Clé API invalide' });
  const company = await pool.query('SELECT * FROM companies WHERE id = $1', [result.rows[0].company_id]);
  if (company.rows.length === 0) return res.status(401).json({ error: 'Entreprise non trouvée' });
  req.company = company.rows[0];
  next();
};

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  let user = null;
  let role = null;

  const admin = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (admin.rows.length > 0) { user = admin.rows[0]; role = 'admin'; }

  if (!user) {
    const manager = await pool.query('SELECT * FROM companies WHERE email = $1', [email]);
    if (manager.rows.length > 0) { user = manager.rows[0]; role = 'manager'; }
  }

  if (!user) {
    const deliverer = await pool.query('SELECT * FROM deliverers WHERE email = $1', [email]);
    if (deliverer.rows.length > 0) { user = deliverer.rows[0]; role = 'deliverer'; }
  }

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  if (user.active === false) return res.status(403).json({ error: 'Compte suspendu' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role, companyId: user.company_id || user.id },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
});

// ════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════
app.get('/api/admin/profile', auth(['admin']), async (req, res) => {
  const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
  res.json(result.rows[0]);
});

app.patch('/api/admin/profile', auth(['admin']), async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];

  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), user.id]);
  }
  await pool.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name || user.name, email || user.email, user.id]);
  res.json({ id: user.id, name: name || user.name, email: email || user.email, role: user.role });
});

app.get('/api/admin/stats', auth(['admin']), async (req, res) => {
  const [companies, deliverers, deliveries, active, waSent] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM companies'),
    pool.query('SELECT COUNT(*) FROM deliverers'),
    pool.query('SELECT COUNT(*) FROM deliveries'),
    pool.query("SELECT COUNT(*) FROM deliveries WHERE status != 'completed'"),
    pool.query("SELECT COUNT(*) FROM whatsapp_logs WHERE status IN ('sent','simulated')")
  ]);
  const shareLink = `${APP_URL}/share/${locationToken}`;
const clientMsg = `Bonjour ${clientName} ! Votre commande chez *${c.name}* est prête.\n\nPour que notre livreur vous trouve, appuyez sur ce lien et partagez votre position :\n${shareLink}\n\n_Ce lien expire dans 3 heures._`;

try {
  await sendWhatsApp(clientPhone, clientMsg, c.name);
} catch (e) {
  console.error('WhatsApp error:', e.message);
}
  res.json({
    companies: parseInt(companies.rows[0].count),
    activeCompanies: parseInt(companies.rows[0].count),
    deliverers: parseInt(deliverers.rows[0].count),
    deliveries: parseInt(deliveries.rows[0].count),
    activeDeliveries: parseInt(active.rows[0].count),
    whatsappSent: parseInt(waSent.rows[0].count),
    revenue: 0
  });
});

app.get('/api/admin/companies', auth(['admin']), async (req, res) => {
  const companies = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
  const result = await Promise.all(companies.rows.map(async c => {
    const sub = await getSubscription(c.id);
    const deliverers = await pool.query('SELECT COUNT(*) FROM deliverers WHERE company_id = $1', [c.id]);
    const deliveries = await pool.query('SELECT COUNT(*) FROM deliveries WHERE company_id = $1', [c.id]);
    const apiKey = await pool.query('SELECT key FROM api_keys WHERE company_id = $1 AND active = true LIMIT 1', [c.id]);
    return { ...c, password: undefined, subscription: sub, deliverersCount: parseInt(deliverers.rows[0].count), deliveriesCount: parseInt(deliveries.rows[0].count), apiKey: apiKey.rows[0]?.key || null };
  }));
  res.json(result);
});

app.post('/api/admin/companies', auth(['admin']), async (req, res) => {
  const { name, email, phone, password, plan = 'trial' } = req.body;
  const existing = await pool.query('SELECT id FROM companies WHERE email = $1', [email]);
  if (existing.rows.length > 0) return res.status(400).json({ error: 'Email déjà utilisé' });

  const id = uuidv4();
  await pool.query(
    'INSERT INTO companies (id, name, email, password, phone, role, active) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, name, email, bcrypt.hashSync(password, 10), phone, 'manager', true]
  );
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO subscriptions (company_id, plan, active, trial_ends_at) VALUES ($1,$2,$3,$4)',
    [id, plan, true, trialEnd]
  );
  const apiKey = await generateApiKey(id);
  const sub = await getSubscription(id);
  res.json({ id, name, email, phone, role: 'manager', active: true, subscription: sub, apiKey });
});

app.patch('/api/admin/companies/:id/toggle', auth(['admin']), async (req, res) => {
  const c = await pool.query('SELECT active FROM companies WHERE id = $1', [req.params.id]);
  if (c.rows.length === 0) return res.status(404).json({ error: 'Non trouvé' });
  const newActive = !c.rows[0].active;
  await pool.query('UPDATE companies SET active = $1 WHERE id = $2', [newActive, req.params.id]);
  await pool.query('UPDATE subscriptions SET active = $1 WHERE company_id = $2', [newActive, req.params.id]);
  res.json({ active: newActive });
});

app.patch('/api/admin/companies/:id/subscription', auth(['admin']), async (req, res) => {
  const { plan, active } = req.body;
  await pool.query(
    'UPDATE subscriptions SET plan = COALESCE($1, plan), active = COALESCE($2, active), updated_at = NOW() WHERE company_id = $3',
    [plan, active, req.params.id]
  );
  res.json(await getSubscription(req.params.id));
});

app.post('/api/admin/companies/:id/regenerate-key', auth(['admin']), async (req, res) => {
  await pool.query('UPDATE api_keys SET active = false WHERE company_id = $1', [req.params.id]);
  const apiKey = await generateApiKey(req.params.id);
  res.json({ apiKey });
});

app.get('/api/admin/whatsapp-logs', auth(['admin']), async (req, res) => {
  const logs = await pool.query('SELECT * FROM whatsapp_logs ORDER BY sent_at DESC LIMIT 100');
  res.json(logs.rows);
});

app.get('/api/admin/config', auth(['admin']), async (req, res) => {
  res.json({ whatsappEnabled: !!WHATSAPP_TOKEN, defaultTrialDays: 30, plans: { starter: { price: 5000, maxDeliverers: 3, maxDeliveries: 100 }, business: { price: 15000, maxDeliverers: 10, maxDeliveries: -1 }, pro: { price: 35000, maxDeliverers: 30, maxDeliveries: -1 } } });
});

// ════════════════════════════════════════════
// MANAGER
// ════════════════════════════════════════════
app.get('/api/manager/profile', auth(['manager']), async (req, res) => {
  const company = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.id]);
  const apiKey = await pool.query('SELECT key FROM api_keys WHERE company_id = $1 AND active = true LIMIT 1', [req.user.id]);
  const sub = await getSubscription(req.user.id);
  res.json({ ...company.rows[0], password: undefined, subscription: sub, apiKey: apiKey.rows[0]?.key });
});

app.get('/api/manager/deliverers', auth(['manager']), async (req, res) => {
  const result = await pool.query('SELECT * FROM deliverers WHERE company_id = $1', [req.user.id]);
  res.json(result.rows.map(d => ({ ...d, password: undefined })));
});

app.post('/api/manager/deliverers', auth(['manager']), async (req, res) => {
  const { name, email, phone, whatsapp, password } = req.body;
  const id = uuidv4();
  await pool.query(
    'INSERT INTO deliverers (id, name, email, phone, whatsapp, password, company_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, name, email || '', phone, whatsapp || phone, bcrypt.hashSync(password || 'traceo123', 10), req.user.id]
  );
  res.json({ id, name, email, phone, whatsapp: whatsapp || phone, role: 'deliverer', company_id: req.user.id });
});

app.delete('/api/manager/deliverers/:id', auth(['manager']), async (req, res) => {
  await pool.query('DELETE FROM deliverers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

app.get('/api/manager/deliveries', auth(['manager']), async (req, res) => {
  const { status, limit = 50 } = req.query;
  let query = 'SELECT * FROM deliveries WHERE company_id = $1';
  const params = [req.user.id];
  if (status) { query += ' AND status = $2'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT ' + parseInt(limit);
  const result = await pool.query(query, params);
  res.json(result.rows.map(d => ({
    ...d,
    clientLocation: d.client_lat ? { latitude: d.client_lat, longitude: d.client_lng, sharedAt: d.client_location_shared_at } : null
  })));
});

app.post('/api/manager/deliveries', auth(['manager']), async (req, res) => {
  const check = await checkLimits(req.user.id);
  if (!check.allowed) return res.status(403).json({ error: check.reason });

  const { clientPhone, clientName, description, delivererId } = req.body;
  const company = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.id]);
  const c = company.rows[0];
  const locationToken = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
  const id = uuidv4();
  const tokenExpiry = new Date(Date.now() + 3 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO deliveries (id, client_name, client_phone, client_whatsapp, description, deliverer_id, company_id, company_name, location_token, token_expiry, status, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending','panel')`,
    [id, clientName, clientPhone, clientPhone, description, delivererId || null, req.user.id, c.name, locationToken, tokenExpiry]
  );

  await pool.query('UPDATE subscriptions SET deliveries_this_month = deliveries_this_month + 1 WHERE company_id = $1', [req.user.id]);

  const shareLink = `${APP_URL}/share/${locationToken}`;
  res.json({ id, clientName, clientPhone, description, delivererId, companyId: req.user.id, companyName: c.name, locationToken, status: 'pending', shareLink, whatsappSent: false, createdAt: new Date().toISOString() });
});

app.patch('/api/manager/deliveries/:id/assign', auth(['manager']), async (req, res) => {
  const { delivererId } = req.body;
  await pool.query('UPDATE deliveries SET deliverer_id = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3', [delivererId, req.params.id, req.user.id]);
  const delivery = await pool.query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
  const d = delivery.rows[0];

  if (d.client_lat) {
    const deliverer = await pool.query('SELECT * FROM deliverers WHERE id = $1', [delivererId]);
    const company = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.id]);
    if (deliverer.rows[0]) {
      const mapsLink = `https://maps.google.com/?q=${d.client_lat},${d.client_lng}`;
      const msg = `📦 *Livraison - ${company.rows[0].name}*\n\nClient: *${d.client_name}*\nTél: ${d.client_phone}\n\n📍 Naviguer ici:\n${mapsLink}`;
      try { await sendWhatsApp(deliverer.rows[0].whatsapp || deliverer.rows[0].phone, msg, company.rows[0].name); } catch (e) {}
    }
  }

  io.to(`company-${req.user.id}`).emit('delivery-updated', { ...d, id: d.id });
  res.json(d);
});

app.patch('/api/manager/deliveries/:id/complete', auth(['manager']), async (req, res) => {
  await pool.query("UPDATE deliveries SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND company_id = $2", [req.params.id, req.user.id]);
  await pool.query('UPDATE deliveries SET location_token = NULL WHERE id = $1', [req.params.id]);
  const d = await pool.query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
  io.to(`company-${req.user.id}`).emit('delivery-updated', d.rows[0]);
  res.json(d.rows[0]);
});

app.get('/api/manager/stats', auth(['manager']), async (req, res) => {
  const [total, active, completed, pending, sub] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM deliveries WHERE company_id = $1', [req.user.id]),
    pool.query("SELECT COUNT(*) FROM deliveries WHERE company_id = $1 AND status != 'completed'", [req.user.id]),
    pool.query("SELECT COUNT(*) FROM deliveries WHERE company_id = $1 AND status = 'completed'", [req.user.id]),
    pool.query("SELECT COUNT(*) FROM deliveries WHERE company_id = $1 AND status = 'pending'", [req.user.id]),
    getSubscription(req.user.id)
  ]);
  res.json({ total: parseInt(total.rows[0].count), active: parseInt(active.rows[0].count), completed: parseInt(completed.rows[0].count), pending: parseInt(pending.rows[0].count), subscription: sub });
});

// ════════════════════════════════════════════
// CLIENT — Partage position
// ════════════════════════════════════════════
app.get('/api/share/:token', async (req, res) => {
  const result = await pool.query('SELECT * FROM deliveries WHERE location_token = $1', [req.params.token]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  const d = result.rows[0];
  if (new Date() > new Date(d.token_expiry)) return res.status(410).json({ error: 'Lien expiré' });
  res.json({ valid: true, clientName: d.client_name, companyName: d.company_name });
});

app.post('/api/share/:token/location', async (req, res) => {
  const { latitude, longitude } = req.body;
  const result = await pool.query('SELECT * FROM deliveries WHERE location_token = $1', [req.params.token]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Lien invalide' });
  const d = result.rows[0];
  if (new Date() > new Date(d.token_expiry)) return res.status(410).json({ error: 'Lien expiré' });

  await pool.query(
    "UPDATE deliveries SET client_lat = $1, client_lng = $2, client_location_shared_at = NOW(), status = 'location_received', updated_at = NOW() WHERE id = $3",
    [latitude, longitude, d.id]
  );

  io.to(`company-${d.company_id}`).emit('delivery-updated', { ...d, client_lat: latitude, client_lng: longitude, status: 'location_received' });

  if (d.deliverer_id) {
    const deliverer = await pool.query('SELECT * FROM deliverers WHERE id = $1', [d.deliverer_id]);
    const company = await pool.query('SELECT * FROM companies WHERE id = $1', [d.company_id]);
    if (deliverer.rows[0]) {
      const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
      const msg = `📦 *Livraison - ${company.rows[0]?.name}*\n\nClient *${d.client_name}* a partagé sa position !\n\n📍 Naviguer ici :\n${mapsLink}\n\nTél: ${d.client_phone}`;
      try { await sendWhatsApp(deliverer.rows[0].whatsapp || deliverer.rows[0].phone, msg, company.rows[0]?.name); } catch (e) {}
      io.to(`deliverer-${d.deliverer_id}`).emit('delivery-updated', d);
    }
  }

  res.json({ success: true, message: 'Position partagée ! Le livreur arrive bientôt.' });
});

// ════════════════════════════════════════════
// DELIVERER
// ════════════════════════════════════════════
app.get('/api/deliverer/deliveries', auth(['deliverer']), async (req, res) => {
  const result = await pool.query("SELECT * FROM deliveries WHERE deliverer_id = $1 AND status != 'completed' ORDER BY created_at DESC", [req.user.id]);
  res.json(result.rows.map(d => ({
    ...d,
    clientLocation: d.client_lat ? { latitude: d.client_lat, longitude: d.client_lng } : null
  })));
});

app.patch('/api/deliverer/deliveries/:id/complete', auth(['deliverer']), async (req, res) => {
  await pool.query("UPDATE deliveries SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND deliverer_id = $2", [req.params.id, req.user.id]);
  const d = await pool.query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
  io.to(`company-${d.rows[0].company_id}`).emit('delivery-updated', d.rows[0]);
  res.json(d.rows[0]);
});

// ════════════════════════════════════════════
// API PUBLIQUE v1
// ════════════════════════════════════════════
app.get('/api/v1', (req, res) => {
  res.json({ name: 'Traceo API', version: '1.0', authentication: 'Header: x-api-key: tk_live_VOTRE_CLE', endpoints: { 'POST /api/v1/deliveries': 'Créer une livraison', 'GET /api/v1/deliveries': 'Lister vos livraisons', 'GET /api/v1/deliveries/:id/status': 'Statut d\'une livraison', 'GET /api/v1/deliverers': 'Lister vos livreurs' } });
});

app.post('/api/v1/deliveries', apiKeyAuth, async (req, res) => {
  const check = await checkLimits(req.company.id);
  if (!check.allowed) return res.status(403).json({ error: check.reason });

  const { clientName, clientPhone, description, delivererId } = req.body;
  if (!clientName || !clientPhone) return res.status(400).json({ error: 'clientName et clientPhone sont requis' });

  const locationToken = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
  const id = uuidv4();
  await pool.query(
    `INSERT INTO deliveries (id, client_name, client_phone, client_whatsapp, description, deliverer_id, company_id, company_name, location_token, token_expiry, status, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending','api')`,
    [id, clientName, clientPhone, clientPhone, description, delivererId || null, req.company.id, req.company.name, locationToken, new Date(Date.now() + 3 * 60 * 60 * 1000)]
  );
  await pool.query('UPDATE subscriptions SET deliveries_this_month = deliveries_this_month + 1 WHERE company_id = $1', [req.company.id]);

  const shareLink = `${APP_URL}/share/${locationToken}`;
  res.status(201).json({ id, status: 'pending', shareLink, message: `Envoyez ce lien au client: ${shareLink}`, createdAt: new Date().toISOString() });
});

app.get('/api/v1/deliveries', apiKeyAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM deliveries WHERE company_id = $1 ORDER BY created_at DESC LIMIT 20', [req.company.id]);
  res.json({ deliveries: result.rows });
});

app.get('/api/v1/deliveries/:id/status', apiKeyAuth, async (req, res) => {
  const result = await pool.query('SELECT id, status, client_lat, updated_at FROM deliveries WHERE id = $1 AND company_id = $2', [req.params.id, req.company.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Non trouvée' });
  const d = result.rows[0];
  res.json({ id: d.id, status: d.status, clientLocationReceived: !!d.client_lat, updatedAt: d.updated_at });
});

app.get('/api/v1/deliverers', apiKeyAuth, async (req, res) => {
  const result = await pool.query('SELECT id, name, phone, active FROM deliverers WHERE company_id = $1', [req.company.id]);
  res.json(result.rows);
});

app.get('/api/v1/account', apiKeyAuth, async (req, res) => {
  const sub = await getSubscription(req.company.id);
  res.json({ id: req.company.id, name: req.company.name, email: req.company.email, subscription: sub });
});

// ════════════════════════════════════════════
// SOCKET.IO
// ════════════════════════════════════════════
io.on('connection', (socket) => {
  socket.on('join', ({ role, id }) => {
    if (role === 'manager') socket.join(`company-${id}`);
    if (role === 'deliverer') socket.join(`deliverer-${id}`);
  });
});

// ════════════════════════════════════════════
// START
// ════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Traceo v2 Backend PostgreSQL → port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ Erreur DB:', err);
  process.exit(1);
});
