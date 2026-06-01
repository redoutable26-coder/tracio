# 📦 TRACEO v2.0 — Guide complet

Infrastructure de livraison last-mile SaaS pour l'Afrique subsaharienne.

---

## Ce qui est nouveau dans la v2

- ✅ API publique complète (intégration boutiques externes)
- ✅ Bot WhatsApp automatique pour le client ET le livreur
- ✅ Gestion des abonnements (Essai / Starter / Business / Pro)
- ✅ Panel admin complet avec logs WhatsApp
- ✅ Clés API générées automatiquement par gérant
- ✅ Le livreur reçoit la position du client directement sur WhatsApp
- ✅ Le message client mentionne le nom de la boutique (pas Traceo)

---

## Structure

```
traceo-v2/
├── backend/
│   ├── server.js       ← API complète + WebSocket + Bot WhatsApp
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx     ← Toutes les interfaces (Admin, Gérant, Client, API docs)
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## DÉPLOIEMENT RENDER — Étape par étape

### Backend

1. Render → "New Web Service" → connecter repo GitHub
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Variables d'environnement :
   ```
   JWT_SECRET=traceo_prod_2026_changez_ceci
   APP_URL=https://votre-frontend.onrender.com
   WHATSAPP_TOKEN=votre_token_meta (optionnel)
   WHATSAPP_PHONE_ID=votre_phone_id_meta (optionnel)
   ```

### Frontend

1. Render → "New Static Site" → même repo
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `dist`
5. Variable d'environnement :
   ```
   VITE_API_URL=https://votre-backend.onrender.com/api
   ```

---

## COMPTES PAR DÉFAUT

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@traceo.cm | admin123 |

---

## FLUX COMPLET v2

```
1. Admin crée un compte gérant → clé API générée automatiquement

2. Gérant crée un livreur → saisit son numéro WhatsApp

3. Gérant crée une livraison → saisit numéro WhatsApp du client
   OU boutique appelle POST /api/v1/deliveries avec sa clé API

4. Système envoie WhatsApp au client :
   "Bonjour Jean ! Votre commande chez [NOM BOUTIQUE]
   est prête. Partagez votre position ici : [lien]"

5. Client appuie sur le lien → 1 tap pour partager sa position

6. Système envoie WhatsApp au livreur :
   "📦 Livraison - [NOM BOUTIQUE]
   Client: Jean Dupont
   📍 Naviguer ici: [lien Google Maps direct]"

7. Livreur clique le lien Maps → navigue directement

8. Gérant voit tout en temps réel dans son dashboard
```

---

## INTÉGRATION API — Pour les boutiques externes

### Créer une livraison depuis votre boutique

```bash
curl -X POST https://votre-backend.onrender.com/api/v1/deliveries \
  -H "x-api-key: tk_live_VOTRE_CLE" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Jean Dupont",
    "clientPhone": "+237612345678",
    "description": "Commande #1234 - 2 pizzas"
  }'
```

### Réponse

```json
{
  "id": "uuid-livraison",
  "status": "pending",
  "shareLink": "https://traceo.cm/share/TOKEN",
  "whatsappSent": true,
  "message": "WhatsApp envoyé à +237612345678"
}
```

### Vérifier le statut

```bash
curl https://votre-backend.onrender.com/api/v1/deliveries/ID/status \
  -H "x-api-key: tk_live_VOTRE_CLE"
```

---

## CONFIGURER WHATSAPP BUSINESS

1. Créer compte Meta Business → business.facebook.com
2. Ajouter WhatsApp Business API
3. Obtenir : WHATSAPP_TOKEN et WHATSAPP_PHONE_ID
4. Ajouter ces variables dans Render → backend → Environment
5. Dans le panel Admin → Config → activer WhatsApp

Sans ces variables, le système fonctionne en mode simulation (logs visibles dans admin).

---

## PLANS TARIFAIRES

| Plan | Prix | Livreurs | Livraisons |
|------|------|----------|------------|
| Essai | Gratuit 30j | 3 | 100 |
| Starter | 5 000 FCFA/mois | 3 | 100 |
| Business | 15 000 FCFA/mois | 10 | Illimitées |
| Pro | 35 000 FCFA/mois | 30 | Illimitées |
