const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

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
// BASE DE DONNÉES EN MÉMOIRE
// (remplacer par PostgreSQL en production)
// ════════════════════════════════════════════
const db = {
  users: [{
    id: 'admin-001',
    name: 'Admin Traceo',
    email: 'admin@traceo.cm',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    createdAt: new Date().toISOString()
  }],
  companies: [],
  deliverers: [],
  deliveries: [],
  locationTokens: {},
  apiKeys: {},        // clés API pour intégration externe
  subscriptions: {},  // abonnements par company
  whatsappLogs: [],   // logs des messages envoyés
  systemConfig: {     // configuration globale admin
    whatsappEnabled: false,
    defaultTrialDays: 30,
    plans: {
      starter:  { name: 'Starter',  price: 5000,  maxDeliverers: 3,  maxDeliveries: 100 },
      business: { name: 'Business', price: 15000, maxDeliverers: 10, maxDeliveries: -1 },
      pro:      { name: 'Pro',      price: 35000, maxDeliverers: 30, maxDeliveries: -1 }
    }
  }
};

// ════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════

// ── WhatsApp Service ──
const sendWhatsApp = async (phone, message, companyName = 'Traceo') => {
  const cleanPhone = phone.replace(/\D/g, '');
  const log = {
    id: uuidv4(),
    phone: cleanPhone,
    message,
    companyName,
    sentAt: new Date().toISOString(),
    status: 'pending'
  };

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    log.status = 'simulated';
    console.log(`📱 [WhatsApp SIMULÉ → ${cleanPhone}]`);
    console.log(`   De: ${companyName}`);
    console.log(`   Message: ${message}`);
    db.whatsappLogs.push(log);
    return { simulated: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: message }
      })
    });
    const data = await res.json();
    log.status = res.ok ? 'sent' : 'failed';
    log.response = data;
    db.whatsappLogs.push(log);
    return data;
  } catch (e) {
    log.status = 'error';
    log.error = e.message;
    db.whatsappLogs.push(log);
    throw e;
  }
};

// ── Subscription Service ──
const getSubscription = (companyId) => {
  return db.subscriptions[companyId] || {
    plan: 'trial',
    active: true,
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    deliveriesThisMonth: 0
  };
};

const checkSubscriptionLimits = (companyId) => {
  const sub = getSubscription(companyId);
  const plan = db.systemConfig.plans[sub.plan];
  if (!sub.active) return { allowed: false, reason: 'Abonnement inactif' };
  if (sub.plan === 'trial' && new Date() > new Date(sub.trialEndsAt)) {
    return { allowed: false, reason: 'Période d\'essai expirée' };
  }
  if (plan && plan.maxDeliveries !== -1 && sub.deliveriesThisMonth >= plan.maxDeliveries) {
    return { allowed: false, reason: 'Limite de livraisons atteinte' };
  }
  return { allowed: true };
};

// ── API Key Service ──
const generateApiKey = (companyId) => {
  const key = `tk_live_${crypto.randomBytes(24).toString('hex')}`;
  db.apiKeys[key] = { companyId, createdAt: new Date().toISOString(), active: true };
  return key;
};

const getCompanyFromApiKey = (key) => {
  const entry = db.apiKeys[key];
  if (!entry || !entry.active) return null;
  return db.companies.find(c => c.id === entry.companyId);
};

// ════════════════════════════════════════════
// MIDDLEWARES
// ════════════════════════════════════════════

const auth = (roles = []) => (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// Middleware API Key (pour intégrations externes)
const apiKeyAuth = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'Clé API manquante. Header: x-api-key' });
  const company = getCompanyFromApiKey(key);
  if (!company) return res.status(401).json({ error: 'Clé API invalide ou révoquée' });
  req.company = company;
  next();
};

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  let user = db.users.find(u => u.email === email)
    || db.companies.find(u => u.email === email)
    || db.deliverers.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  if (user.active === false) return res.status(403).json({ error: 'Compte suspendu' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId || user.id },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});


// ── Profil Admin ──
app.get('/api/admin/profile', auth(['admin']), (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.patch('/api/admin/profile', auth(['admin']), async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Mot de passe actuel requis' });
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    user.password = bcrypt.hashSync(newPassword, 10);
  }

  if (name) user.name = name;
  if (email) user.email = email;

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// ════════════════════════════════════════════
// ADMIN — Dashboard complet
// ════════════════════════════════════════════

app.get('/api/admin/stats', auth(['admin']), (req, res) => {
  const now = new Date();
  const thisMonth = db.deliveries.filter(d => new Date(d.createdAt).getMonth() === now.getMonth());
  res.json({
    companies: db.companies.length,
    activeCompanies: db.companies.filter(c => c.active).length,
    deliverers: db.deliverers.length,
    deliveries: db.deliveries.length,
    deliveriesThisMonth: thisMonth.length,
    activeDeliveries: db.deliveries.filter(d => d.status !== 'completed').length,
    whatsappSent: db.whatsappLogs.filter(l => l.status === 'sent' || l.status === 'simulated').length,
    revenue: db.companies.filter(c => {
      const sub = getSubscription(c.id);
      return sub.plan !== 'trial';
    }).reduce((acc, c) => {
      const sub = getSubscription(c.id);
      const plan = db.systemConfig.plans[sub.plan];
      return acc + (plan?.price || 0);
    }, 0)
  });
});

app.get('/api/admin/companies', auth(['admin']), (req, res) => {
  const companies = db.companies.map(c => ({
    ...c, password: undefined,
    subscription: getSubscription(c.id),
    deliverersCount: db.deliverers.filter(d => d.companyId === c.id).length,
    deliveriesCount: db.deliveries.filter(d => d.companyId === c.id).length,
    apiKey: Object.entries(db.apiKeys).find(([k, v]) => v.companyId === c.id)?.[0] || null
  }));
  res.json(companies);
});

app.post('/api/admin/companies', auth(['admin']), async (req, res) => {
  const { name, email, password, phone, plan = 'trial' } = req.body;
  if (db.companies.find(c => c.email === email)) {
    return res.status(400).json({ error: 'Email déjà utilisé' });
  }
  const company = {
    id: uuidv4(), name, email, phone,
    password: bcrypt.hashSync(password, 10),
    role: 'manager', active: true,
    createdAt: new Date().toISOString()
  };
  db.companies.push(company);

  // Créer abonnement initial
  db.subscriptions[company.id] = {
    plan,
    active: true,
    trialEndsAt: new Date(Date.now() + db.systemConfig.defaultTrialDays * 24 * 60 * 60 * 1000).toISOString(),
    deliveriesThisMonth: 0,
    startedAt: new Date().toISOString()
  };

  // Générer clé API automatiquement
  const apiKey = generateApiKey(company.id);

  res.json({ ...company, password: undefined, apiKey, subscription: db.subscriptions[company.id] });
});

app.patch('/api/admin/companies/:id/toggle', auth(['admin']), (req, res) => {
  const company = db.companies.find(c => c.id === req.params.id);
  if (!company) return res.status(404).json({ error: 'Non trouvé' });
  company.active = !company.active;
  if (db.subscriptions[company.id]) db.subscriptions[company.id].active = company.active;
  res.json({ active: company.active });
});

app.patch('/api/admin/companies/:id/subscription', auth(['admin']), (req, res) => {
  const { plan, active } = req.body;
  if (!db.subscriptions[req.params.id]) db.subscriptions[req.params.id] = {};
  if (plan) db.subscriptions[req.params.id].plan = plan;
  if (typeof active !== 'undefined') db.subscriptions[req.params.id].active = active;
  db.subscriptions[req.params.id].updatedAt = new Date().toISOString();
  res.json(db.subscriptions[req.params.id]);
});

app.post('/api/admin/companies/:id/regenerate-key', auth(['admin']), (req, res) => {
  // Révoquer ancienne clé
  Object.entries(db.apiKeys).forEach(([k, v]) => {
    if (v.companyId === req.params.id) db.apiKeys[k].active = false;
  });
  const apiKey = generateApiKey(req.params.id);
  res.json({ apiKey });
});

app.get('/api/admin/whatsapp-logs', auth(['admin']), (req, res) => {
  res.json(db.whatsappLogs.slice(-100).reverse());
});

app.get('/api/admin/config', auth(['admin']), (req, res) => {
  res.json(db.systemConfig);
});

app.patch('/api/admin/config', auth(['admin']), (req, res) => {
  Object.assign(db.systemConfig, req.body);
  res.json(db.systemConfig);
});

// ════════════════════════════════════════════
// MANAGER — Panel gérant
// ════════════════════════════════════════════

app.get('/api/manager/profile', auth(['manager']), (req, res) => {
  const company = db.companies.find(c => c.id === req.user.id);
  const apiKey = Object.entries(db.apiKeys).find(([k, v]) => v.companyId === req.user.id)?.[0];
  res.json({ ...company, password: undefined, subscription: getSubscription(req.user.id), apiKey });
});

app.get('/api/manager/deliverers', auth(['manager']), (req, res) => {
  res.json(db.deliverers.filter(d => d.companyId === req.user.id).map(d => ({ ...d, password: undefined })));
});

app.post('/api/manager/deliverers', auth(['manager']), (req, res) => {
  const { name, email, phone, password, whatsapp } = req.body;
  const plan = db.systemConfig.plans[getSubscription(req.user.id).plan];
  const currentCount = db.deliverers.filter(d => d.companyId === req.user.id).length;
  if (plan && plan.maxDeliverers !== -1 && currentCount >= plan.maxDeliverers) {
    return res.status(403).json({ error: `Limite de ${plan.maxDeliverers} livreurs atteinte pour votre formule` });
  }
  const deliverer = {
    id: uuidv4(), name, email, phone,
    whatsapp: whatsapp || phone,
    password: bcrypt.hashSync(password || 'traceo123', 10),
    role: 'deliverer', companyId: req.user.id,
    active: true, createdAt: new Date().toISOString()
  };
  db.deliverers.push(deliverer);
  res.json({ ...deliverer, password: undefined });
});

app.delete('/api/manager/deliverers/:id', auth(['manager']), (req, res) => {
  const idx = db.deliverers.findIndex(d => d.id === req.params.id && d.companyId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Non trouvé' });
  db.deliverers.splice(idx, 1);
  res.json({ success: true });
});

app.get('/api/manager/deliveries', auth(['manager']), (req, res) => {
  const { status, limit = 50 } = req.query;
  let deliveries = db.deliveries.filter(d => d.companyId === req.user.id);
  if (status) deliveries = deliveries.filter(d => d.status === status);
  res.json(deliveries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, parseInt(limit)));
});

app.post('/api/manager/deliveries', auth(['manager']), async (req, res) => {
  const check = checkSubscriptionLimits(req.user.id);
  if (!check.allowed) return res.status(403).json({ error: check.reason });

  const { clientPhone, clientName, description, delivererId, clientWhatsapp } = req.body;
  const company = db.companies.find(c => c.id === req.user.id);
  const locationToken = uuidv4().split('-')[0].toUpperCase() + uuidv4().split('-')[1].toUpperCase();

  const delivery = {
    id: uuidv4(), clientPhone, clientName, description,
    clientWhatsapp: clientWhatsapp || clientPhone,
    delivererId: delivererId || null,
    companyId: req.user.id,
    companyName: company.name,
    locationToken,
    tokenExpiry: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    clientLocation: null,
    status: 'pending',
    source: 'panel',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.deliveries.push(delivery);
  db.locationTokens[locationToken] = delivery.id;

  // Incrémenter compteur abonnement
  if (db.subscriptions[req.user.id]) db.subscriptions[req.user.id].deliveriesThisMonth++;

  // Envoyer WhatsApp au client
  const shareLink = `${APP_URL}/share/${locationToken}`;
  const clientMsg = `Bonjour ${clientName} ! Votre commande chez *${company.name}* est prête.\n\nPour que notre livreur vous trouve, appuyez sur ce lien et partagez votre position :\n${shareLink}\n\n_Ce lien expire dans 3 heures._`;

  try {
    await sendWhatsApp(delivery.clientWhatsapp, clientMsg, company.name);
    delivery.whatsappClientSent = true;
  } catch (e) {
    delivery.whatsappClientSent = false;
    delivery.whatsappError = e.message;
  }

  io.to(`company-${req.user.id}`).emit('delivery-created', delivery);
  res.json({ ...delivery, shareLink });
});

app.patch('/api/manager/deliveries/:id/assign', auth(['manager']), async (req, res) => {
  const delivery = db.deliveries.find(d => d.id === req.params.id && d.companyId === req.user.id);
  if (!delivery) return res.status(404).json({ error: 'Non trouvé' });

  delivery.delivererId = req.body.delivererId;
  delivery.updatedAt = new Date().toISOString();

  const deliverer = db.deliverers.find(d => d.id === req.body.delivererId);
  const company = db.companies.find(c => c.id === req.user.id);

  // Envoyer WhatsApp au livreur si position déjà reçue
  if (deliverer && delivery.clientLocation) {
    const mapsLink = `https://maps.google.com/?q=${delivery.clientLocation.latitude},${delivery.clientLocation.longitude}`;
    const delivererMsg = `📦 *Nouvelle livraison - ${company.name}*\n\nClient: *${delivery.clientName}*\nTéléphone: ${delivery.clientPhone}\n\n📍 Position du client:\n${mapsLink}\n\nBonne route !`;
    try { await sendWhatsApp(deliverer.whatsapp, delivererMsg, company.name); } catch (e) {}
  }

  io.to(`deliverer-${req.body.delivererId}`).emit('delivery-assigned', delivery);
  io.to(`company-${req.user.id}`).emit('delivery-updated', delivery);
  res.json(delivery);
});

app.patch('/api/manager/deliveries/:id/complete', auth(['manager']), (req, res) => {
  const delivery = db.deliveries.find(d => d.id === req.params.id && d.companyId === req.user.id);
  if (!delivery) return res.status(404).json({ error: 'Non trouvé' });
  delivery.status = 'completed';
  delivery.completedAt = new Date().toISOString();
  delivery.updatedAt = new Date().toISOString();
  delete db.locationTokens[delivery.locationToken];
  io.to(`company-${req.user.id}`).emit('delivery-updated', delivery);
  res.json(delivery);
});

app.get('/api/manager/stats', auth(['manager']), (req, res) => {
  const deliveries = db.deliveries.filter(d => d.companyId === req.user.id);
  const now = new Date();
  const thisMonth = deliveries.filter(d => new Date(d.createdAt).getMonth() === now.getMonth());
  res.json({
    total: deliveries.length,
    thisMonth: thisMonth.length,
    active: deliveries.filter(d => d.status !== 'completed').length,
    completed: deliveries.filter(d => d.status === 'completed').length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    subscription: getSubscription(req.user.id)
  });
});

// ════════════════════════════════════════════
// CLIENT — Partage de position (sans auth)
// ════════════════════════════════════════════

app.get('/api/share/:token', (req, res) => {
  const deliveryId = db.locationTokens[req.params.token];
  if (!deliveryId) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  const delivery = db.deliveries.find(d => d.id === deliveryId);
  if (!delivery) return res.status(404).json({ error: 'Livraison non trouvée' });
  if (new Date() > new Date(delivery.tokenExpiry)) return res.status(410).json({ error: 'Lien expiré' });
  res.json({ valid: true, clientName: delivery.clientName, companyName: delivery.companyName });
});

app.post('/api/share/:token/location', async (req, res) => {
  const { latitude, longitude } = req.body;
  const deliveryId = db.locationTokens[req.params.token];
  if (!deliveryId) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  const delivery = db.deliveries.find(d => d.id === deliveryId);
  if (!delivery) return res.status(404).json({ error: 'Non trouvée' });
  if (new Date() > new Date(delivery.tokenExpiry)) return res.status(410).json({ error: 'Lien expiré' });

  delivery.clientLocation = { latitude, longitude, sharedAt: new Date().toISOString() };
  delivery.status = 'location_received';
  delivery.updatedAt = new Date().toISOString();

  const company = db.companies.find(c => c.id === delivery.companyId);
  const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;

  // Notifier gérant temps réel
  io.to(`company-${delivery.companyId}`).emit('delivery-updated', delivery);

  // Envoyer WhatsApp au livreur si déjà assigné
  if (delivery.delivererId) {
    const deliverer = db.deliverers.find(d => d.id === delivery.delivererId);
    if (deliverer) {
      const msg = `📦 *Livraison - ${company?.name}*\n\nClient *${delivery.clientName}* a partagé sa position !\n\n📍 Naviguer ici :\n${mapsLink}\n\nTéléphone client : ${delivery.clientPhone}`;
      try { await sendWhatsApp(deliverer.whatsapp, msg, company?.name); } catch (e) {}
      io.to(`deliverer-${delivery.delivererId}`).emit('delivery-updated', delivery);
    }
  }

  res.json({ success: true, message: 'Position partagée ! Le livreur arrive bientôt.' });
});

// ════════════════════════════════════════════
// DELIVERER
// ════════════════════════════════════════════

app.get('/api/deliverer/deliveries', auth(['deliverer']), (req, res) => {
  res.json(db.deliveries
    .filter(d => d.delivererId === req.user.id && d.status !== 'completed')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.patch('/api/deliverer/deliveries/:id/complete', auth(['deliverer']), (req, res) => {
  const delivery = db.deliveries.find(d => d.id === req.params.id && d.delivererId === req.user.id);
  if (!delivery) return res.status(404).json({ error: 'Non trouvée' });
  delivery.status = 'completed';
  delivery.completedAt = new Date().toISOString();
  delivery.updatedAt = new Date().toISOString();
  delete db.locationTokens[delivery.locationToken];
  io.to(`company-${delivery.companyId}`).emit('delivery-updated', delivery);
  res.json(delivery);
});

// ════════════════════════════════════════════
// API PUBLIQUE — Intégration boutiques externes
// ════════════════════════════════════════════

// Documentation de l'API
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Traceo API',
    version: '1.0',
    description: 'API de livraison last-mile pour boutiques en ligne',
    authentication: 'Header: x-api-key: tk_live_VOTRE_CLE',
    endpoints: {
      'POST /api/v1/deliveries': 'Créer une livraison',
      'GET /api/v1/deliveries': 'Lister vos livraisons',
      'GET /api/v1/deliveries/:id': 'Détail d\'une livraison',
      'GET /api/v1/deliveries/:id/status': 'Statut d\'une livraison',
      'DELETE /api/v1/deliveries/:id': 'Annuler une livraison',
      'GET /api/v1/deliverers': 'Lister vos livreurs',
      'GET /api/v1/account': 'Infos de votre compte'
    },
    example: {
      request: 'POST /api/v1/deliveries',
      headers: { 'x-api-key': 'tk_live_xxx', 'Content-Type': 'application/json' },
      body: {
        clientName: 'Jean Dupont',
        clientPhone: '+237612345678',
        description: 'Commande #1234 - 2 pizzas',
        delivererId: 'optionnel'
      },
      response: {
        id: 'uuid',
        status: 'pending',
        shareLink: 'https://traceo.cm/share/TOKEN',
        message: 'WhatsApp envoyé au client'
      }
    }
  });
});

// Créer une livraison via API externe
app.post('/api/v1/deliveries', apiKeyAuth, async (req, res) => {
  const check = checkSubscriptionLimits(req.company.id);
  if (!check.allowed) return res.status(403).json({ error: check.reason });

  const { clientName, clientPhone, description, delivererId, metadata } = req.body;
  if (!clientName || !clientPhone) {
    return res.status(400).json({ error: 'clientName et clientPhone sont requis' });
  }

  const locationToken = uuidv4().split('-')[0].toUpperCase() + uuidv4().split('-')[1].toUpperCase();
  const delivery = {
    id: uuidv4(), clientPhone, clientName, description,
    clientWhatsapp: clientPhone,
    delivererId: delivererId || null,
    companyId: req.company.id,
    companyName: req.company.name,
    locationToken,
    tokenExpiry: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    clientLocation: null,
    status: 'pending',
    source: 'api',
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.deliveries.push(delivery);
  db.locationTokens[locationToken] = delivery.id;
  if (db.subscriptions[req.company.id]) db.subscriptions[req.company.id].deliveriesThisMonth++;

  const shareLink = `${APP_URL}/share/${locationToken}`;
  const clientMsg = `Bonjour ${clientName} ! Votre commande chez *${req.company.name}* est confirmée.\n\nPour la livraison, appuyez ici pour partager votre position :\n${shareLink}\n\n_Lien valide 3 heures._`;

  let whatsappSent = false;
  try {
    await sendWhatsApp(clientPhone, clientMsg, req.company.name);
    whatsappSent = true;
  } catch (e) {}

  io.to(`company-${req.company.id}`).emit('delivery-created', delivery);

  res.status(201).json({
    id: delivery.id,
    status: delivery.status,
    shareLink,
    whatsappSent,
    message: whatsappSent
      ? `WhatsApp envoyé à ${clientPhone}`
      : `WhatsApp non configuré. Envoyer manuellement: ${shareLink}`,
    createdAt: delivery.createdAt
  });
});

// Lister livraisons via API
app.get('/api/v1/deliveries', apiKeyAuth, (req, res) => {
  const { status, limit = 20, page = 1 } = req.query;
  let deliveries = db.deliveries.filter(d => d.companyId === req.company.id);
  if (status) deliveries = deliveries.filter(d => d.status === status);
  const sorted = deliveries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = sorted.length;
  const paginated = sorted.slice((page - 1) * limit, page * limit);
  res.json({ total, page: parseInt(page), limit: parseInt(limit), deliveries: paginated });
});

// Détail d'une livraison via API
app.get('/api/v1/deliveries/:id', apiKeyAuth, (req, res) => {
  const delivery = db.deliveries.find(d => d.id === req.params.id && d.companyId === req.company.id);
  if (!delivery) return res.status(404).json({ error: 'Non trouvée' });
  res.json(delivery);
});

// Statut uniquement
app.get('/api/v1/deliveries/:id/status', apiKeyAuth, (req, res) => {
  const delivery = db.deliveries.find(d => d.id === req.params.id && d.companyId === req.company.id);
  if (!delivery) return res.status(404).json({ error: 'Non trouvée' });
  res.json({
    id: delivery.id,
    status: delivery.status,
    clientLocationReceived: !!delivery.clientLocation,
    updatedAt: delivery.updatedAt
  });
});

// Annuler une livraison
app.delete('/api/v1/deliveries/:id', apiKeyAuth, (req, res) => {
  const delivery = db.deliveries.find(d => d.id === req.params.id && d.companyId === req.company.id);
  if (!delivery) return res.status(404).json({ error: 'Non trouvée' });
  if (delivery.status === 'completed') return res.status(400).json({ error: 'Livraison déjà complétée' });
  delivery.status = 'cancelled';
  delivery.updatedAt = new Date().toISOString();
  delete db.locationTokens[delivery.locationToken];
  res.json({ success: true, message: 'Livraison annulée' });
});

// Livreurs via API
app.get('/api/v1/deliverers', apiKeyAuth, (req, res) => {
  res.json(db.deliverers
    .filter(d => d.companyId === req.company.id)
    .map(d => ({ id: d.id, name: d.name, phone: d.phone, active: d.active })));
});

// Infos compte via API
app.get('/api/v1/account', apiKeyAuth, (req, res) => {
  res.json({
    id: req.company.id,
    name: req.company.name,
    email: req.company.email,
    subscription: getSubscription(req.company.id),
    deliveriesThisMonth: db.deliveries.filter(d => {
      const now = new Date();
      return d.companyId === req.company.id && new Date(d.createdAt).getMonth() === now.getMonth();
    }).length
  });
});

// ════════════════════════════════════════════
// SOCKET.IO
// ════════════════════════════════════════════
io.on('connection', (socket) => {
  socket.on('join', ({ role, id }) => {
    if (role === 'manager') socket.join(`company-${id}`);
    if (role === 'deliverer') socket.join(`deliverer-${id}`);
    if (role === 'admin') socket.join('admin');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Traceo v2 Backend → port ${PORT}`);
  console.log(`📡 API publique disponible sur /api/v1`);
  console.log(`🔑 Admin: admin@traceo.cm / admin123`);
});
