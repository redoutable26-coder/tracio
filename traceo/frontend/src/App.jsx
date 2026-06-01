import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --blue: #0047CC; --blue-light: #EBF1FF; --blue-mid: #3B72FF;
      --dark: #0A0F1E; --dark-2: #141929; --dark-3: #1E2640;
      --gray: #8892A4; --gray-light: #F3F5FA; --white: #FFFFFF;
      --green: #00C896; --orange: #FF8C42; --red: #FF4757; --yellow: #FFD166;
      --radius: 14px; --radius-sm: 8px;
      --shadow: 0 4px 24px rgba(0,71,204,0.10);
      --shadow-lg: 0 8px 40px rgba(0,71,204,0.18);
      --font-head: 'Syne', sans-serif; --font-body: 'DM Sans', sans-serif;
      --transition: all 0.22s cubic-bezier(.4,0,.2,1);
    }
    body { font-family: var(--font-body); background: var(--dark); color: var(--white); min-height: 100vh; -webkit-font-smoothing: antialiased; }
    input, select, textarea { font-family: var(--font-body); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--dark-2); }
    ::-webkit-scrollbar-thumb { background: var(--dark-3); border-radius: 3px; }

    .nav { background: var(--dark-2); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .nav-logo { font-family: var(--font-head); font-size: 22px; font-weight: 800; }
    .nav-logo span { color: var(--blue-mid); }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-role { background: var(--blue); color: var(--white); font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }

    .layout { display: flex; flex: 1; min-height: calc(100vh - 64px); }
    .sidebar { width: 220px; background: var(--dark-2); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 12px; display: flex; flex-direction: column; gap: 4px; }
    .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; font-weight: 500; color: var(--gray); border: none; background: none; width: 100%; text-align: left; transition: var(--transition); }
    .sidebar-item:hover { background: var(--dark-3); color: var(--white); }
    .sidebar-item.active { background: var(--blue); color: var(--white); }

    .main { flex: 1; padding: 32px; overflow-y: auto; }
    .page-title { font-family: var(--font-head); font-size: 26px; font-weight: 700; margin-bottom: 24px; }

    .card { background: var(--dark-2); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; }
    .card-title { font-family: var(--font-head); font-size: 15px; font-weight: 700; margin-bottom: 16px; }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .stat-card { background: var(--dark-2); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius); padding: 20px; position: relative; overflow: hidden; }
    .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent, var(--blue-mid)); }
    .stat-label { font-size: 11px; color: var(--gray); font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-family: var(--font-head); font-size: 30px; font-weight: 800; }

    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600; color: var(--gray); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    td { padding: 13px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.85); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }

    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge.pending { background: rgba(255,209,102,0.15); color: var(--yellow); }
    .badge.location_received { background: rgba(59,114,255,0.15); color: var(--blue-mid); }
    .badge.in_progress { background: rgba(0,200,150,0.15); color: var(--green); }
    .badge.completed { background: rgba(255,255,255,0.08); color: var(--gray); }
    .badge.cancelled { background: rgba(255,71,87,0.12); color: var(--red); }
    .badge.active { background: rgba(0,200,150,0.15); color: var(--green); }
    .badge.trial { background: rgba(255,140,66,0.15); color: var(--orange); }
    .badge.suspended { background: rgba(255,71,87,0.12); color: var(--red); }

    .btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: var(--transition); font-family: var(--font-body); }
    .btn-primary { background: var(--blue); color: var(--white); }
    .btn-primary:hover { background: var(--blue-mid); transform: translateY(-1px); }
    .btn-sm { padding: 5px 11px; font-size: 12px; }
    .btn-ghost { background: rgba(255,255,255,0.06); color: var(--white); }
    .btn-ghost:hover { background: rgba(255,255,255,0.10); }
    .btn-danger { background: rgba(255,71,87,0.15); color: var(--red); }
    .btn-danger:hover { background: rgba(255,71,87,0.25); }
    .btn-success { background: rgba(0,200,150,0.15); color: var(--green); }
    .btn-success:hover { background: rgba(0,200,150,0.25); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 13px; font-weight: 500; color: var(--gray); margin-bottom: 5px; }
    input, select, textarea { width: 100%; background: var(--dark-3); border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-sm); padding: 10px 13px; color: var(--white); font-size: 14px; outline: none; transition: var(--transition); }
    input:focus, select:focus, textarea:focus { border-color: var(--blue-mid); box-shadow: 0 0 0 3px rgba(59,114,255,0.15); }
    input::placeholder, textarea::placeholder { color: var(--gray); }
    select option { background: var(--dark-3); }
    textarea { resize: vertical; min-height: 80px; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; padding: 20px; }
    .modal { background: var(--dark-2); border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius); padding: 28px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
    .modal-title { font-family: var(--font-head); font-size: 18px; font-weight: 700; margin-bottom: 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--dark); position: relative; overflow: hidden; }
    .login-bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(0,71,204,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(59,114,255,0.08) 0%, transparent 50%); }
    .login-card { background: var(--dark-2); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 40px; width: 100%; max-width: 400px; position: relative; box-shadow: var(--shadow-lg); }
    .login-logo { font-family: var(--font-head); font-size: 32px; font-weight: 800; text-align: center; margin-bottom: 4px; }
    .login-logo span { color: var(--blue-mid); }
    .login-sub { text-align: center; color: var(--gray); font-size: 14px; margin-bottom: 28px; }
    .login-error { background: rgba(255,71,87,0.12); border: 1px solid rgba(255,71,87,0.3); color: var(--red); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 14px; }

    .share-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--dark); padding: 24px; }
    .share-card { background: var(--dark-2); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 40px 28px; width: 100%; max-width: 420px; text-align: center; }
    .share-btn { width: 100%; padding: 16px; background: var(--green); color: var(--dark); border: none; border-radius: var(--radius); font-size: 16px; font-weight: 700; cursor: pointer; font-family: var(--font-body); transition: var(--transition); }
    .share-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,200,150,0.3); }
    .share-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .code-block { background: var(--dark-3); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 16px; font-family: 'Courier New', monospace; font-size: 13px; color: var(--green); overflow-x: auto; line-height: 1.6; white-space: pre; }
    .api-key-box { background: var(--dark-3); border: 1px solid rgba(59,114,255,0.3); border-radius: var(--radius-sm); padding: 12px 16px; font-family: monospace; font-size: 13px; color: var(--blue-mid); word-break: break-all; }

    .toast { position: fixed; bottom: 24px; right: 24px; background: var(--dark-2); border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-sm); padding: 13px 18px; font-size: 14px; font-weight: 500; box-shadow: var(--shadow-lg); z-index: 9999; animation: slideUp 0.3s ease; display: flex; align-items: center; gap: 9px; }
    .toast.success { border-color: rgba(0,200,150,0.4); color: var(--green); }
    .toast.error { border-color: rgba(255,71,87,0.4); color: var(--red); }

    .empty { text-align: center; padding: 40px; color: var(--gray); font-size: 14px; }
    .empty-icon { font-size: 36px; margin-bottom: 10px; }
    .flex-between { display: flex; align-items: center; justify-content: space-between; }
    .flex { display: flex; align-items: center; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .mb-4 { margin-bottom: 16px; }
    .mt-4 { margin-top: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .table-wrap { overflow-x: auto; }
    .tab-bar { display: flex; gap: 4px; margin-bottom: 20px; background: var(--dark-3); padding: 4px; border-radius: var(--radius-sm); width: fit-content; }
    .tab { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: none; color: var(--gray); transition: var(--transition); }
    .tab.active { background: var(--dark-2); color: var(--white); }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { padding: 16px; }
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      .nav { padding: 0 16px; }
    }
  `}</style>
);

// ─── HELPERS ───
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('traceo_token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
};

const statusLabel = s => ({ pending: 'En attente', location_received: 'Position reçue', in_progress: 'En route', completed: 'Livrée', cancelled: 'Annulée' }[s] || s);
const statusDot = s => ({ pending: '🟡', location_received: '🔵', in_progress: '🟢', completed: '⚪', cancelled: '🔴' }[s] || '⚪');
const planColor = p => ({ trial: 'var(--orange)', starter: 'var(--blue-mid)', business: 'var(--green)', pro: 'var(--yellow)' }[p] || 'var(--gray)');

// ─── TOAST ───
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast ${type}`}>{type === 'success' ? '✓' : '✕'} {msg}</div>;
};

// ─── LOGIN ───
const Login = ({ onLogin }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: form });
      localStorage.setItem('traceo_token', data.token);
      onLogin(data.user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">trace<span>o</span></div>
        <div className="login-sub">Solution livraison last-mile — v2.0</div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group"><label>Email</label><input type="email" placeholder="votre@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
        <div className="form-group"><label>Mot de passe</label><input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }} onClick={submit} disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--gray)' }}>Contactez l'administrateur Traceo pour obtenir vos accès.</p>
      </div>
    </div>
  );
};


// ─── ADMIN : Profil ───
const AdminProfile = ({ user, toast, onUpdate }) => {
  const [form, setForm] = useState({ name: user.name, email: user.email, currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast('Les mots de passe ne correspondent pas', 'error'); return;
    }
    if (form.newPassword && form.newPassword.length < 6) {
      toast('Mot de passe trop court (6 caractères minimum)', 'error'); return;
    }
    setLoading(true);
    try {
      await apiFetch('/admin/profile', {
        method: 'PATCH',
        body: { name: form.name, email: form.email, currentPassword: form.currentPassword || undefined, newPassword: form.newPassword || undefined }
      });
      toast('Profil mis à jour avec succès', 'success');
      onUpdate({ ...user, name: form.name, email: form.email });
      setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h1 className="page-title">Mon profil</h1>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-title">Informations personnelles</div>
        <div className="form-group"><label>Nom</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
      </div>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-title">Changer le mot de passe</div>
        <div className="form-group"><label>Mot de passe actuel</label><input type="password" placeholder="••••••••" value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
        <div className="form-group"><label>Nouveau mot de passe</label><input type="password" placeholder="••••••••" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} /></div>
        <div className="form-group"><label>Confirmer</label><input type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} /></div>
        <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Sauvegarde...' : '💾 Sauvegarder'}</button>
      </div>
    </div>
  );
};

// ─── PAGE CLIENT (partage position) ───
const SharePage = ({ token }) => {
  const [info, setInfo] = useState(null);
  const [linkError, setLinkError] = useState(''); // erreur lien invalide
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('intro'); // intro → requesting → denied → manual → success
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    apiFetch(`/share/${token}`)
      .then(setInfo)
      .catch(e => setLinkError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Envoyer la position au serveur
  const submitLocation = async (latitude, longitude) => {
    await apiFetch(`/share/${token}/location`, {
      method: 'POST',
      body: { latitude, longitude }
    });
    setStep('success');
  };

  // Demande GPS principale
  const requestGPS = () => {
    if (!navigator.geolocation) {
      setStep('manual');
      return;
    }
    setStep('requesting');
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await submitLocation(coords.latitude, coords.longitude);
        } catch {
          setStep('manual');
        } finally {
          setSharing(false);
        }
      },
      (err) => {
        setSharing(false);
        // PERMISSION_DENIED = 1, POSITION_UNAVAILABLE = 2, TIMEOUT = 3
        if (err.code === 1) {
          setStep('denied');
        } else {
          setStep('manual');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Plan B : client ouvre Google Maps et copie ses coordonnées
  const openMapsAndWait = () => {
    window.open('https://maps.google.com', '_blank');
    setStep('manual');
  };

  // Plan C : saisie manuelle des coordonnées depuis Google Maps
  const [manualCoords, setManualCoords] = useState({ lat: '', lng: '' });
  const [manualError, setManualError] = useState('');

  const submitManual = async () => {
    const lat = parseFloat(manualCoords.lat);
    const lng = parseFloat(manualCoords.lng);
    if (isNaN(lat) || isNaN(lng)) {
      setManualError('Coordonnées invalides. Exemple: 3.8480, 11.5021');
      return;
    }
    try {
      await submitLocation(lat, lng);
    } catch (e) {
      setManualError(e.message);
    }
  };

  // ── STYLES INTERNES PAGE CLIENT ──
  const s = {
    wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0F1E', padding: 20 },
    card: { background: '#141929', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 28px', width: '100%', maxWidth: 400, textAlign: 'center' },
    logo: { fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#8892A4', marginBottom: 24, letterSpacing: 1 },
    icon: { fontSize: 52, marginBottom: 14 },
    title: { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 },
    sub: { color: '#8892A4', fontSize: 14, lineHeight: 1.7, marginBottom: 24 },
    btnGreen: { width: '100%', padding: '16px', background: '#00C896', color: '#0A0F1E', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    btnBlue: { width: '100%', padding: '14px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 10 },
    btnGhost: { width: '100%', padding: '12px', background: 'rgba(255,255,255,0.06)', color: '#8892A4', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 10 },
    step: { background: 'rgba(59,114,255,0.08)', border: '1px solid rgba(59,114,255,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'left', fontSize: 14, color: '#fff', lineHeight: 1.8 },
    alert: { background: 'rgba(255,71,87,0.10)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: '#FF4757', lineHeight: 1.7, textAlign: 'left' },
    success: { background: 'rgba(0,200,150,0.10)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 14, padding: '24px', marginBottom: 16 },
    input: { width: '100%', background: '#1E2640', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '10px 13px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 8 },
    small: { color: '#8892A4', fontSize: 12, lineHeight: 1.6, marginTop: 16 },
  };

  if (loading) return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.icon}>⏳</div>
      <p style={{ color: '#8892A4' }}>Vérification du lien...</p>
    </div></div>
  );

  if (linkError) return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.icon}>❌</div>
      <div style={s.title}>Lien invalide</div>
      <p style={s.sub}>{linkError}</p>
    </div></div>
  );

  // ── ÉTAPE : INTRO ──
  if (step === 'intro') return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.logo}>traceo</div>
      <div style={s.icon}>📦</div>
      <div style={s.title}>Votre livraison arrive !</div>
      <p style={s.sub}>
        Bonjour <b style={{ color: '#fff' }}>{info?.clientName}</b> !<br />
        <b style={{ color: '#fff' }}>{info?.companyName}</b> prépare votre commande.<br /><br />
        Pour que le livreur vous trouve, partagez votre position.
      </p>

      {/* Instruction préventive */}
      <div style={s.step}>
        📌 <b>Important :</b> Quand votre téléphone vous demande une autorisation, appuyez sur <b style={{ color: '#00C896' }}>"Autoriser"</b> ou <b style={{ color: '#00C896' }}>"Allow"</b>.
      </div>

      <button style={s.btnGreen} onClick={requestGPS}>
        📍 Partager ma position
      </button>
      <p style={s.small}>Votre position est utilisée uniquement pour cette livraison.</p>
    </div></div>
  );

  // ── ÉTAPE : EN COURS ──
  if (step === 'requesting') return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.icon}>📡</div>
      <div style={s.title}>Localisation...</div>
      <p style={s.sub}>Votre téléphone cherche votre position.<br />Si une fenêtre s'affiche, appuyez sur <b style={{ color: '#00C896' }}>"Autoriser"</b>.</p>
      <div style={{ ...s.step, textAlign: 'center', color: '#8892A4' }}>⏳ Merci de patienter quelques secondes</div>
    </div></div>
  );

  // ── ÉTAPE : GPS REFUSÉ ──
  if (step === 'denied') return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.icon}>🔒</div>
      <div style={s.title}>Localisation bloquée</div>
      <div style={s.alert}>
        Vous avez refusé l'accès à votre position. Voici comment corriger ça :
      </div>

      <div style={{ ...s.step, marginBottom: 20 }}>
        <b style={{ color: '#3B72FF' }}>Sur Android :</b><br />
        Paramètres → Applications → Chrome (ou votre navigateur) → Autorisations → Position → Autoriser
        <br /><br />
        <b style={{ color: '#3B72FF' }}>Sur iPhone :</b><br />
        Réglages → Safari → Position → Autoriser
      </div>

      <button style={s.btnGreen} onClick={requestGPS}>
        🔄 Réessayer maintenant
      </button>
      <button style={s.btnBlue} onClick={() => setStep('manual')}>
        📝 Entrer ma position manuellement
      </button>
      <button style={s.btnGhost} onClick={openMapsAndWait}>
        🗺 Ouvrir Google Maps pour trouver mes coordonnées
      </button>
    </div></div>
  );

  // ── ÉTAPE : SAISIE MANUELLE ──
  if (step === 'manual') return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.icon}>🗺</div>
      <div style={s.title}>Entrez votre position</div>
      <p style={s.sub}>
        Ouvrez <b style={{ color: '#fff' }}>Google Maps</b>, maintenez votre doigt sur votre position, puis copiez les chiffres qui apparaissent en bas.
      </p>

      <div style={s.step}>
        <b>Exemple de coordonnées :</b><br />
        Latitude : <span style={{ color: '#00C896' }}>3.8480</span><br />
        Longitude : <span style={{ color: '#00C896' }}>11.5021</span>
      </div>

      <input
        style={s.input}
        placeholder="Latitude (ex: 3.8480)"
        value={manualCoords.lat}
        onChange={e => setManualCoords(c => ({ ...c, lat: e.target.value }))}
        inputMode="decimal"
      />
      <input
        style={s.input}
        placeholder="Longitude (ex: 11.5021)"
        value={manualCoords.lng}
        onChange={e => setManualCoords(c => ({ ...c, lng: e.target.value }))}
        inputMode="decimal"
      />

      {manualError && <div style={{ color: '#FF4757', fontSize: 13, marginBottom: 10 }}>{manualError}</div>}

      <button style={s.btnGreen} onClick={submitManual}>
        ✅ Confirmer ma position
      </button>
      <button style={s.btnGhost} onClick={() => setStep('intro')}>
        ← Réessayer automatiquement
      </button>
      <button style={{ ...s.btnGhost, marginTop: 4 }} onClick={() => window.open('https://maps.google.com', '_blank')}>
        🗺 Ouvrir Google Maps
      </button>
    </div></div>
  );

  // ── ÉTAPE : SUCCÈS ──
  if (step === 'success') return (
    <div style={s.wrap}><div style={s.card}>
      <div style={s.logo}>traceo</div>
      <div style={s.success}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
        <div style={{ color: '#00C896', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Position reçue !</div>
        <div style={{ color: '#8892A4', fontSize: 14, lineHeight: 1.6 }}>Le livreur a reçu votre position et arrive bientôt chez vous.</div>
      </div>
      <p style={s.small}>
        Vous pouvez fermer cette page.<br />
        {info?.companyName} vous remercie pour votre commande.
      </p>
    </div></div>
  );

  return null;
};

// ─── ADMIN : Dashboard ───
const AdminDashboard = ({ toast }) => {
  const [stats, setStats] = useState({});
  const [companies, setCompanies] = useState([]);
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState({});
  const [tab, setTab] = useState('companies');
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', plan: 'trial' });
  const [configForm, setConfigForm] = useState({});
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showApiModal, setShowApiModal] = useState(false);

  const load = useCallback(async () => {
    const [s, c, l, cf] = await Promise.all([
      apiFetch('/admin/stats'),
      apiFetch('/admin/companies'),
      apiFetch('/admin/whatsapp-logs'),
      apiFetch('/admin/config')
    ]);
    setStats(s); setCompanies(c); setLogs(l); setConfig(cf); setConfigForm(cf);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCompany = async () => {
    try {
      const res = await apiFetch('/admin/companies', { method: 'POST', body: form });
      toast(`Gérant créé. Clé API: ${res.apiKey}`, 'success');
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', password: '', plan: 'trial' });
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const toggleCompany = async (id) => {
    await apiFetch(`/admin/companies/${id}/toggle`, { method: 'PATCH' });
    load();
  };

  const changePlan = async (id, plan) => {
    await apiFetch(`/admin/companies/${id}/subscription`, { method: 'PATCH', body: { plan } });
    toast('Abonnement mis à jour', 'success'); load();
  };

  const regenerateKey = async (id, name) => {
    const res = await apiFetch(`/admin/companies/${id}/regenerate-key`, { method: 'POST' });
    setSelectedCompany({ name, apiKey: res.apiKey });
    setShowApiModal(true);
  };

  const saveConfig = async () => {
    try {
      await apiFetch('/admin/config', { method: 'PATCH', body: configForm });
      toast('Configuration sauvegardée', 'success');
      setShowConfigModal(false); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>Administration Traceo</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowConfigModal(true)}>⚙️ Config</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouveau gérant</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Entreprises', value: stats.companies || 0, accent: 'var(--blue-mid)' },
          { label: 'Actives', value: stats.activeCompanies || 0, accent: 'var(--green)' },
          { label: 'Livraisons/mois', value: stats.deliveriesThisMonth || 0, accent: 'var(--orange)' },
          { label: 'WhatsApp envoyés', value: stats.whatsappSent || 0, accent: 'var(--yellow)' },
          { label: 'Revenus/mois', value: `${(stats.revenue || 0).toLocaleString()} F`, accent: 'var(--green)' },
        ].map(s => (
          <div className="stat-card" key={s.label} style={{ '--accent': s.accent }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: s.label === 'Revenus/mois' ? 18 : 30 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="tab-bar">
        {['companies', 'logs'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ companies: '🏢 Entreprises', logs: '📱 WhatsApp Logs' }[t]}
          </button>
        ))}
      </div>

      {tab === 'companies' && (
        <div className="card">
          {companies.length === 0 ? <div className="empty"><div className="empty-icon">🏢</div>Aucune entreprise</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Entreprise</th><th>Plan</th><th>Livreurs</th><th>Livraisons</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.name}</b><br />
                        <span style={{ fontSize: 12, color: 'var(--gray)' }}>{c.email}</span>
                      </td>
                      <td>
                        <select value={c.subscription?.plan || 'trial'} onChange={e => changePlan(c.id, e.target.value)} style={{ width: 110, padding: '4px 8px', fontSize: 12 }}>
                          <option value="trial">Essai</option>
                          <option value="starter">Starter</option>
                          <option value="business">Business</option>
                          <option value="pro">Pro</option>
                        </select>
                      </td>
                      <td>{c.deliverersCount}</td>
                      <td>{c.deliveriesCount}</td>
                      <td><span className="badge" style={{ background: c.active ? 'rgba(0,200,150,0.15)' : 'rgba(255,71,87,0.12)', color: c.active ? 'var(--green)' : 'var(--red)' }}>{c.active ? '● Actif' : '● Suspendu'}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button className={`btn btn-sm ${c.active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleCompany(c.id)}>{c.active ? 'Suspendre' : 'Activer'}</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => regenerateKey(c.id, c.name)}>🔑 API</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="card">
          <div className="card-title">Logs WhatsApp ({logs.length})</div>
          {logs.length === 0 ? <div className="empty"><div className="empty-icon">📱</div>Aucun log</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Téléphone</th><th>Entreprise</th><th>Statut</th><th>Date</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td>{l.phone}</td>
                      <td style={{ color: 'var(--gray)' }}>{l.companyName}</td>
                      <td><span className="badge" style={{ background: l.status === 'sent' || l.status === 'simulated' ? 'rgba(0,200,150,0.15)' : 'rgba(255,71,87,0.12)', color: l.status === 'sent' || l.status === 'simulated' ? 'var(--green)' : 'var(--red)' }}>● {l.status}</span></td>
                      <td style={{ color: 'var(--gray)', fontSize: 12 }}>{new Date(l.sentAt).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal nouveau gérant */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Nouveau gérant</div>
            <div className="grid-2">
              <div className="form-group"><label>Nom entreprise</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="form-group"><label>Téléphone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label>Mot de passe</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div className="form-group"><label>Plan initial</label>
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                <option value="trial">Essai gratuit (30 jours)</option>
                <option value="starter">Starter — 5 000 FCFA/mois</option>
                <option value="business">Business — 15 000 FCFA/mois</option>
                <option value="pro">Pro — 35 000 FCFA/mois</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={createCompany}>Créer + Générer clé API</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clé API */}
      {showApiModal && selectedCompany && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowApiModal(false)}>
          <div className="modal">
            <div className="modal-title">🔑 Clé API — {selectedCompany.name}</div>
            <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 14 }}>Transmettez cette clé au gérant pour l'intégration API.</p>
            <div className="api-key-box">{selectedCompany.apiKey}</div>
            <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>⚠️ Copiez-la maintenant, elle ne sera plus visible.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(selectedCompany.apiKey); toast && toast('Clé copiée !', 'success'); }}>📋 Copier</button>
              <button className="btn btn-primary" onClick={() => setShowApiModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal config */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfigModal(false)}>
          <div className="modal">
            <div className="modal-title">⚙️ Configuration système</div>
            <div className="form-group"><label>Jours d'essai gratuit</label><input type="number" value={configForm.defaultTrialDays || 30} onChange={e => setConfigForm(f => ({ ...f, defaultTrialDays: parseInt(e.target.value) }))} /></div>
            <div className="form-group"><label>WhatsApp activé</label>
              <select value={configForm.whatsappEnabled ? 'true' : 'false'} onChange={e => setConfigForm(f => ({ ...f, whatsappEnabled: e.target.value === 'true' }))}>
                <option value="false">Non (mode simulation)</option>
                <option value="true">Oui (API WhatsApp Business)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowConfigModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveConfig}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MANAGER : Livraisons ───
const ManagerDeliveries = ({ user, toast }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [deliverers, setDeliverers] = useState([]);
  const [stats, setStats] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientPhone: '', description: '', delivererId: '' });
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    const [d, del, s] = await Promise.all([apiFetch('/manager/deliveries'), apiFetch('/manager/deliverers'), apiFetch('/manager/stats')]);
    setDeliveries(d); setDeliverers(del); setStats(s);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const create = async () => {
    try {
      const res = await apiFetch('/manager/deliveries', { method: 'POST', body: form });
      setResult(res);
      toast(res.whatsappSent ? '✅ WhatsApp envoyé au client !' : '📋 Lien généré — envoi manuel requis', res.whatsappSent ? 'success' : 'error');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const assign = async (deliveryId, delivererId) => {
    if (!delivererId) return;
    try { await apiFetch(`/manager/deliveries/${deliveryId}/assign`, { method: 'PATCH', body: { delivererId } }); toast('Livreur assigné — WhatsApp envoyé !', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const complete = async (id) => {
    try { await apiFetch(`/manager/deliveries/${id}/complete`, { method: 'PATCH' }); toast('Livraison complétée', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const active = deliveries.filter(d => d.status !== 'completed' && d.status !== 'cancelled');
  const done = deliveries.filter(d => d.status === 'completed' || d.status === 'cancelled');

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>Livraisons</h1>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setResult(null); setForm({ clientName: '', clientPhone: '', description: '', delivererId: '' }); }}>+ Nouvelle livraison</button>
      </div>

      <div className="stats-grid">
        {[
          { label: 'En cours', value: active.length, accent: 'var(--blue-mid)' },
          { label: 'Ce mois', value: stats.thisMonth || 0, accent: 'var(--green)' },
          { label: 'En attente pos.', value: stats.pending || 0, accent: 'var(--yellow)' },
          { label: 'Complétées', value: stats.completed || 0, accent: 'var(--gray)' },
        ].map(s => (
          <div className="stat-card" key={s.label} style={{ '--accent': s.accent }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Abonnement */}
      {stats.subscription && (
        <div style={{ background: 'rgba(59,114,255,0.06)', border: '1px solid rgba(59,114,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <span>Plan actuel : <b style={{ color: 'var(--white)', textTransform: 'capitalize' }}>{stats.subscription.plan}</b></span>
          <span style={{ color: 'var(--gray)' }}>{stats.deliveriesThisMonth || 0} livraisons ce mois</span>
        </div>
      )}

      <div className="card">
        <div className="card-title">Livraisons actives ({active.length})</div>
        {active.length === 0 ? <div className="empty"><div className="empty-icon">📦</div>Aucune livraison en cours</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Statut</th><th>Livreur</th><th>Position</th><th>Actions</th></tr></thead>
              <tbody>
                {active.map(d => (
                  <tr key={d.id}>
                    <td>
                      <b>{d.clientName}</b><br />
                      <span style={{ fontSize: 12, color: 'var(--gray)' }}>{d.clientPhone}</span>
                      {d.description && <><br /><span style={{ fontSize: 12, color: 'var(--gray)' }}>{d.description}</span></>}
                    </td>
                    <td><span className={`badge ${d.status}`}>{statusDot(d.status)} {statusLabel(d.status)}</span></td>
                    <td>
                      <select style={{ width: 140 }} value={d.delivererId || ''} onChange={e => assign(d.id, e.target.value)}>
                        <option value="">Choisir...</option>
                        {deliverers.map(del => <option key={del.id} value={del.id}>{del.name}</option>)}
                      </select>
                    </td>
                    <td>
                      {d.clientLocation
                        ? <a href={`https://maps.google.com/?q=${d.clientLocation.latitude},${d.clientLocation.longitude}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">🗺 Maps</a>
                        : <span style={{ color: 'var(--gray)', fontSize: 12 }}>En attente...</span>}
                    </td>
                    <td><button className="btn btn-sm btn-success" onClick={() => complete(d.id)}>✓ Livrée</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="card">
          <div className="card-title">Historique</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>
                {done.slice(0, 15).map(d => (
                  <tr key={d.id}>
                    <td>{d.clientName}<br /><span style={{ fontSize: 12, color: 'var(--gray)' }}>{d.clientPhone}</span></td>
                    <td><span className={`badge ${d.status}`}>{statusLabel(d.status)}</span></td>
                    <td style={{ color: 'var(--gray)', fontSize: 12 }}>{new Date(d.createdAt).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            {!result ? (
              <>
                <div className="modal-title">Nouvelle livraison</div>
                <div className="grid-2">
                  <div className="form-group"><label>Nom du client</label><input placeholder="Jean Dupont" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} /></div>
                  <div className="form-group"><label>WhatsApp client</label><input placeholder="+237 6XX XXX XXX" value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label>Description (optionnel)</label><input placeholder="Commande #123, restaurant, pharmacie..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="form-group"><label>Assigner un livreur</label>
                  <select value={form.delivererId} onChange={e => setForm(f => ({ ...f, delivererId: e.target.value }))}>
                    <option value="">Assigner plus tard</option>
                    {deliverers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={create}>Créer + Envoyer WhatsApp</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>{result.whatsappSent ? '✅' : '📋'}</div>
                <div className="modal-title">{result.whatsappSent ? 'WhatsApp envoyé !' : 'Lien généré'}</div>
                <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 16 }}>{result.message}</p>
                {!result.whatsappSent && (
                  <>
                    <div className="api-key-box" style={{ marginBottom: 12 }}>{result.shareLink}</div>
                    <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                      <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(result.shareLink)}>📋 Copier</button>
                      <button className="btn btn-primary" onClick={() => window.open(`https://wa.me/${form.clientPhone.replace(/\D/g,'')}?text=${encodeURIComponent('Partagez votre position ici: ' + result.shareLink)}`)}>WhatsApp</button>
                    </div>
                  </>
                )}
                <button className="btn btn-ghost" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={() => setShowModal(false)}>Fermer</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MANAGER : Livreurs ───
const ManagerDeliverers = ({ toast }) => {
  const [deliverers, setDeliverers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', whatsapp: '', password: 'traceo123' });

  const load = useCallback(async () => setDeliverers(await apiFetch('/manager/deliverers')), []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await apiFetch('/manager/deliverers', { method: 'POST', body: form });
      toast('Livreur créé — il recevra ses livraisons sur WhatsApp', 'success');
      setShowModal(false); setForm({ name: '', email: '', phone: '', whatsapp: '', password: 'traceo123' }); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce livreur ?')) return;
    try { await apiFetch(`/manager/deliverers/${id}`, { method: 'DELETE' }); toast('Livreur supprimé', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 className="page-title" style={{ margin: 0 }}>Mes livreurs</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouveau livreur</button>
      </div>
      <div className="card">
        {deliverers.length === 0 ? <div className="empty"><div className="empty-icon">🛵</div>Aucun livreur</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Téléphone</th><th>WhatsApp</th><th>Action</th></tr></thead>
              <tbody>
                {deliverers.map(d => (
                  <tr key={d.id}>
                    <td><b>{d.name}</b></td>
                    <td style={{ color: 'var(--gray)' }}>{d.phone}</td>
                    <td style={{ color: 'var(--gray)' }}>{d.whatsapp || d.phone}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => remove(d.id)}>Supprimer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Nouveau livreur</div>
            <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 16 }}>Le livreur recevra automatiquement ses livraisons sur WhatsApp.</p>
            <div className="grid-2">
              <div className="form-group"><label>Nom complet</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="form-group"><label>Téléphone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>Numéro WhatsApp (si différent)</label><input placeholder="Même que téléphone si vide" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
            <div className="form-group"><label>Email (optionnel)</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={create}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MANAGER : Intégration API ───
const ManagerApi = ({ toast }) => {
  const [profile, setProfile] = useState(null);

  useEffect(() => { apiFetch('/manager/profile').then(setProfile); }, []);

  if (!profile) return <div className="card"><p style={{ color: 'var(--gray)' }}>Chargement...</p></div>;

  const apiUrl = API.replace('/api', '');
  const exampleCreate = `curl -X POST ${apiUrl}/api/v1/deliveries \\
  -H "x-api-key: ${profile.apiKey || 'VOTRE_CLE_API'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientName": "Jean Dupont",
    "clientPhone": "+237612345678",
    "description": "Commande #1234"
  }'`;

  const exampleStatus = `curl ${apiUrl}/api/v1/deliveries/DELIVERY_ID/status \\
  -H "x-api-key: ${profile.apiKey || 'VOTRE_CLE_API'}"`;

  const exampleJs = `// Intégration JavaScript / Node.js
const response = await fetch('${apiUrl}/api/v1/deliveries', {
  method: 'POST',
  headers: {
    'x-api-key': '${profile.apiKey || 'VOTRE_CLE_API'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clientName: 'Jean Dupont',
    clientPhone: '+237612345678',
    description: 'Commande #1234'
  })
});
const delivery = await response.json();
console.log(delivery.shareLink); // Lien envoyé au client`;

  return (
    <div>
      <h1 className="page-title">Intégration API</h1>

      <div className="card">
        <div className="card-title">🔑 Votre clé API</div>
        <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 12 }}>Utilisez cette clé pour intégrer Traceo dans votre boutique en ligne.</p>
        <div className="api-key-box">{profile.apiKey || 'Contactez l\'administrateur pour obtenir votre clé API'}</div>
        {profile.apiKey && <button className="btn btn-ghost btn-sm mt-4" onClick={() => { navigator.clipboard.writeText(profile.apiKey); toast('Clé copiée !', 'success'); }}>📋 Copier la clé</button>}
      </div>

      <div className="card">
        <div className="card-title">📡 Endpoints disponibles</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Méthode</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              {[
                ['POST', '/api/v1/deliveries', 'Créer une livraison + envoyer WhatsApp client'],
                ['GET', '/api/v1/deliveries', 'Lister vos livraisons'],
                ['GET', '/api/v1/deliveries/:id', 'Détail d\'une livraison'],
                ['GET', '/api/v1/deliveries/:id/status', 'Statut d\'une livraison'],
                ['DELETE', '/api/v1/deliveries/:id', 'Annuler une livraison'],
                ['GET', '/api/v1/deliverers', 'Lister vos livreurs'],
                ['GET', '/api/v1/account', 'Infos de votre compte'],
              ].map(([m, e, d]) => (
                <tr key={e}>
                  <td><span style={{ background: m === 'POST' ? 'rgba(0,200,150,0.15)' : m === 'DELETE' ? 'rgba(255,71,87,0.12)' : 'rgba(59,114,255,0.15)', color: m === 'POST' ? 'var(--green)' : m === 'DELETE' ? 'var(--red)' : 'var(--blue-mid)', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{m}</span></td>
                  <td><code style={{ fontSize: 13, color: 'var(--gray)' }}>{e}</code></td>
                  <td style={{ color: 'var(--gray)', fontSize: 13 }}>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">💻 Exemple — Créer une livraison (cURL)</div>
        <div className="code-block">{exampleCreate}</div>
        <button className="btn btn-ghost btn-sm mt-4" onClick={() => { navigator.clipboard.writeText(exampleCreate); toast('Copié !', 'success'); }}>📋 Copier</button>
      </div>

      <div className="card">
        <div className="card-title">⚡ Exemple — JavaScript / Node.js</div>
        <div className="code-block">{exampleJs}</div>
        <button className="btn btn-ghost btn-sm mt-4" onClick={() => { navigator.clipboard.writeText(exampleJs); toast('Copié !', 'success'); }}>📋 Copier</button>
      </div>

      <div className="card">
        <div className="card-title">🔍 Exemple — Vérifier le statut</div>
        <div className="code-block">{exampleStatus}</div>
      </div>
    </div>
  );
};

// ─── APP PRINCIPALE ───
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('deliveries');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const path = window.location.pathname;
  if (path.startsWith('/share/')) {
    return <><GlobalStyles /><SharePage token={path.split('/share/')[1]} /></>;
  }

  if (!user) {
    return <><GlobalStyles /><Login onLogin={u => { setUser(u); setPage('deliveries'); }} /></>;
  }

  const navItems = {
    admin: [{ id: 'deliveries', label: 'Dashboard', icon: '📊' }, { id: 'profile', label: 'Mon profil', icon: '👤' }],
    manager: [
      { id: 'deliveries', label: 'Livraisons', icon: '📦' },
      { id: 'deliverers', label: 'Livreurs', icon: '🛵' },
      { id: 'api', label: 'Intégration API', icon: '🔌' },
    ],
    deliverer: [{ id: 'deliveries', label: 'Mes livraisons', icon: '📦' }]
  }[user.role] || [];

  const roleLabel = { admin: 'Administrateur', manager: 'Gérant', deliverer: 'Livreur' }[user.role];

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <nav className="nav">
          <div className="nav-logo">trace<span>o</span></div>
          <div className="nav-right">
            <span style={{ fontSize: 13, color: 'var(--gray)' }}>{user.name}</span>
            <span className="nav-role">{roleLabel}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => { localStorage.removeItem('traceo_token'); setUser(null); }}>Déconnexion</button>
          </div>
        </nav>
        <div className="layout">
          {navItems.length > 1 && (
            <aside className="sidebar">
              {navItems.map(item => (
                <button key={item.id} className={`sidebar-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}
            </aside>
          )}
          <main className="main">
            {user.role === 'admin' && page === 'deliveries' && <AdminDashboard toast={showToast} />}
            {user.role === 'admin' && page === 'profile' && <AdminProfile user={user} toast={showToast} onUpdate={u => setUser(u)} />}
            {user.role === 'manager' && page === 'deliveries' && <ManagerDeliveries user={user} toast={showToast} />}
            {user.role === 'manager' && page === 'deliverers' && <ManagerDeliverers toast={showToast} />}
            {user.role === 'manager' && page === 'api' && <ManagerApi toast={showToast} />}
          </main>
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
