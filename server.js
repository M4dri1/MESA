'use strict';

/**
 * Servidor do Mesa.
 *
 * Um único processo Node que serve o app Next.js e também:
 *  - API de contas (cadastro, login, perfil) com senha protegida e nick/e-mail únicos
 *  - Salas, chat, materiais e anotações guardados em disco (pasta data/)
 *  - Upload e download de arquivos
 *  - WebSocket em /ws para tempo real (presença, chat, lousa) e sinalização da chamada WebRTC
 *  - Confirmação de e-mail no cadastro (quando email.config.json existe) e moderação das salas
 *
 * Uso:  node server.js          (desenvolvimento)
 *       node server.js --prod   (produção, depois de `next build`)
 */

const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
process.env.NODE_ENV = isProd ? 'production' : 'development';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const next = require('next');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.MESA_DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// 100 MB é o teto do túnel gratuito do Cloudflare para um envio; acima disso ele recusa antes de chegar aqui
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_CALL_SIZE = 12;
// Quantas mensagens cada sala guarda (a busca do chat olha todas elas; 50 000 é anos de conversa de uma turma)
const MAX_MESSAGES_PER_ROOM = 50000;
// Mensagens por página quando o navegador pede o histórico antigo (a busca)
const HISTORY_PAGE = 2000;
// Limites de arquivos (cada um pode ser mudado por variável de ambiente, em MB):
//  - por sala: tudo que a sala guarda (fotos, vídeos, áudios, PDFs...);
//  - por pessoa: quanto ela pode enviar em um dia;
//  - disco: quando sobra menos que isso no disco, o servidor para de aceitar arquivos (o banco precisa de espaço para gravar).
const ROOM_QUOTA_BYTES = (Number(process.env.MESA_ROOM_QUOTA_MB) || 3072) * 1024 * 1024;
const USER_DAILY_BYTES = (Number(process.env.MESA_USER_DAILY_MB) || 500) * 1024 * 1024;
const MIN_FREE_DISK_BYTES = (Number(process.env.MESA_MIN_FREE_MB) || 2048) * 1024 * 1024;

const SUBJECTS = [
  'Matemática', 'Biologia', 'Português', 'História', 'Programação',
  'Idiomas', 'Direito', 'Química', 'Física', 'Outra',
];
const AVATAR_COLORS = ['#2563eb', '#db2777', '#7c3aed', '#059669', '#d97706', '#0891b2', '#dc2626', '#4f46e5'];

/* ------------------------------------------------------------------ */
/* Criptografia em repouso (AES-256-GCM) e Banco de dados em arquivo  */
/* ------------------------------------------------------------------ */

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const KEY_DIR = path.join(__dirname, 'key');
const MASTER_KEY_FILE = path.join(KEY_DIR, 'master.key');
const DATA_KEY_FILE = path.join(DATA_DIR, '.master.key');
const ENC_PREFIX = 'enc:v1:';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function loadOrCreateMasterKey() {
  if (process.env.MESA_MASTER_KEY) {
    return crypto.createHash('sha256').update(String(process.env.MESA_MASTER_KEY)).digest();
  }
  try {
    fs.mkdirSync(KEY_DIR, { recursive: true });
    for (const candidate of [MASTER_KEY_FILE, DATA_KEY_FILE]) {
      if (fs.existsSync(candidate)) {
        const hex = fs.readFileSync(candidate, 'utf8').trim();
        if (/^[0-9a-fA-F]{64}$/.test(hex)) {
          try {
            if (!fs.existsSync(MASTER_KEY_FILE)) fs.writeFileSync(MASTER_KEY_FILE, hex, { mode: 0o600 });
            if (!fs.existsSync(DATA_KEY_FILE)) fs.writeFileSync(DATA_KEY_FILE, hex, { mode: 0o600 });
          } catch {}
          return Buffer.from(hex, 'hex');
        }
      }
    }
    const key = crypto.randomBytes(32);
    const hex = key.toString('hex');
    fs.writeFileSync(MASTER_KEY_FILE, hex, { mode: 0o600 });
    try { fs.writeFileSync(DATA_KEY_FILE, hex, { mode: 0o600 }); } catch {}
    return key;
  } catch {
    return crypto.createHash('sha256').update(__dirname).digest();
  }
}

const MASTER_KEY = loadOrCreateMasterKey();

function sealText(plain) {
  if (typeof plain !== 'string' || !plain || plain.startsWith(ENC_PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`;
}

function openText(sealed) {
  if (typeof sealed !== 'string' || !sealed.startsWith(ENC_PREFIX)) return sealed;
  try {
    const parts = sealed.slice(ENC_PREFIX.length).split(':');
    if (parts.length !== 3) return sealed;
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const data = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return sealed;
  }
}

const { Transform } = require('stream');

function fileKey(fileId) {
  return crypto.createHmac('sha256', MASTER_KEY).update(`file:${fileId}`).digest();
}

function addCounter128(ivBuf, blocks) {
  const out = Buffer.from(ivBuf);
  let carry = BigInt(blocks);
  for (let i = 15; i >= 0 && carry > 0n; i--) {
    const sum = BigInt(out[i]) + (carry & 0xffn);
    out[i] = Number(sum & 0xffn);
    carry = (carry >> 8n) + (sum >> 8n);
  }
  return out;
}

function streamFileRange(file, filePath, start, end, res) {
  if (!file.iv) {
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  const blockIndex = Math.floor(start / 16);
  let skip = start % 16;
  const alignedStart = blockIndex * 16;
  const counterIv = addCounter128(Buffer.from(file.iv, 'hex'), blockIndex);
  const decipher = crypto.createDecipheriv('aes-256-ctr', fileKey(file.id), counterIv);
  const slicer = new Transform({
    transform(chunk, _enc, cb) {
      if (skip > 0) {
        if (chunk.length <= skip) {
          skip -= chunk.length;
          return cb();
        }
        chunk = chunk.subarray(skip);
        skip = 0;
      }
      cb(null, chunk);
    },
  });
  fs.createReadStream(filePath, { start: alignedStart, end }).pipe(decipher).pipe(slicer).pipe(res);
}

function decryptDbInPlace(target) {
  for (const room of target.rooms || []) {
    room.e2eKey = openText(room.e2eKey) || crypto.randomBytes(32).toString('hex');
  }
  for (const list of Object.values(target.messages || {})) {
    if (!Array.isArray(list)) continue;
    for (const msg of list) {
      if (msg && typeof msg.content === 'string') msg.content = openText(msg.content);
    }
  }
  for (const [roomId, note] of Object.entries(target.notes || {})) {
    if (typeof note === 'string') target.notes[roomId] = openText(note);
  }
}

function serializeEncryptedDb(source) {
  const sealedRooms = (source.rooms || []).map((r) => ({
    ...r,
    e2eKey: sealText(r.e2eKey || ''),
  }));
  const sealedMessages = {};
  for (const [roomId, list] of Object.entries(source.messages || {})) {
    sealedMessages[roomId] = (list || []).map((m) => ({
      ...m,
      content: sealText(m.content || ''),
    }));
  }
  const sealedNotes = {};
  for (const [roomId, note] of Object.entries(source.notes || {})) {
    sealedNotes[roomId] = sealText(String(note || ''));
  }
  const payload = JSON.stringify({
    ...source,
    rooms: sealedRooms,
    messages: sealedMessages,
    notes: sealedNotes,
  });
  return JSON.stringify({ _sealed: sealText(payload) });
}

let db = { users: [], sessions: {}, rooms: [], messages: {}, materials: {}, notes: {}, files: {}, boards: {}, pomodoro: {}, stickers: {}, sounds: {} };
try {
  if (fs.existsSync(DB_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const unpacked = parsed && typeof parsed._sealed === 'string' ? JSON.parse(openText(parsed._sealed)) : parsed;
    db = Object.assign(db, unpacked);
    decryptDbInPlace(db);
  }
} catch (err) {
  console.error('Não foi possível ler data/db.json:', err.message);
  process.exit(1);
}

// Cifra no disco arquivos antigos que ainda estavam sem IV em data/uploads/
for (const file of Object.values(db.files || {})) {
  if (!file || file.iv) continue;
  const fp = path.join(UPLOAD_DIR, file.id);
  if (!fs.existsSync(fp)) continue;
  try {
    const plain = fs.readFileSync(fp);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', fileKey(file.id), iv);
    fs.writeFileSync(fp, Buffer.concat([cipher.update(plain), cipher.final()]));
    file.iv = iv.toString('hex');
  } catch {}
}

// Salas criadas antes da moderação e E2EE existirem ganham os campos novos
for (const room of db.rooms) {
  room.adminIds = room.adminIds || [];
  room.bans = room.bans || {};
  room.timeouts = room.timeouts || {};
  room.e2eKey = room.e2eKey || crypto.randomBytes(32).toString('hex');
}

let saveTimer = null;
function saveNow() {
  saveTimer = null;
  const data = serializeEncryptedDb(db);
  const tmp = DB_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    // Se a troca do arquivo falhar (arquivo travado pelo OneDrive ou antivírus), grava direto
    try {
      fs.writeFileSync(DB_FILE, data);
    } catch (err2) {
      console.error('Não foi possível salvar os dados agora; tentando de novo em 2s:', err2.message);
      saveTimer = setTimeout(saveNow, 2000);
    }
  }
}
function save() {
  if (!saveTimer) saveTimer = setTimeout(saveNow, 150);
}
function flushAndExit() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveNow();
  }
  process.exit(0);
}
process.on('SIGINT', flushAndExit);
// Um erro inesperado não pode derrubar a chamada de todo mundo: registra e segue
process.on('uncaughtException', (err) => console.error('Erro não tratado:', err));
process.on('unhandledRejection', (err) => console.error('Promessa rejeitada sem tratamento:', err));
process.on('SIGTERM', flushAndExit);

const newId = (prefix) => `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
const norm = (s) => String(s || '').trim().normalize('NFKC').toLowerCase();

/* ------------------------------------------------------------------ */
/* Contas                                                              */
/* ------------------------------------------------------------------ */

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function checkPassword(user, password) {
  const a = Buffer.from(hashPassword(password, user.salt), 'hex');
  const b = Buffer.from(user.passHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[hashToken(token)] = { userId, createdAt: Date.now() };
  save();
  return token;
}
function userFromToken(token) {
  if (!token) return null;
  const key = hashToken(token);
  const session = db.sessions[key];
  if (!session) return null;
  if (session.createdAt && Date.now() - session.createdAt > SESSION_TTL_MS) {
    delete db.sessions[key];
    save();
    return null;
  }
  return db.users.find((u) => u.id === session.userId) || null;
}
const findUser = (id) => db.users.find((u) => u.id === id) || null;

function publicUser(u) {
  return {
    id: u.id,
    name: u.nickname,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl || '',
    bannerUrl: u.bannerUrl || '',
    avatarLetter: (u.nickname[0] || '?').toUpperCase(),
    avatarColor: u.avatarColor,
    statusText: u.statusText || '',
    // online, ausente ou ocupado (não perturbe): os outros veem a bolinha
    presence: u.presence || 'online',
  };
}
function privateUser(u) {
  // notify: todas as mensagens, só quando me marcarem, ou nenhuma
  return {
    ...publicUser(u),
    email: u.email,
    isEmailVerified: !!u.emailVerified,
    status: 'online',
    notify: u.notify || 'all',
    joinSoundId: u.joinSoundId || '',
  };
}

function validateNickname(nickname) {
  const value = String(nickname || '').trim();
  if (value.length < 3 || value.length > 20) return 'O nickname precisa ter de 3 a 20 caracteres.';
  if (!/^[\p{L}\p{N}_.-]+$/u.test(value)) return 'Use só letras, números, ponto, hífen ou _ no nickname (sem espaços).';
  return null;
}
// Foto da sala: imagem pequena (o navegador reduz antes de mandar)
function validateRoomIcon(icon) {
  if (!icon) return '';
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(icon) || icon.length > 180000) return 'Imagem inválida ou grande demais.';
  return '';
}

function validateAvatar(avatarUrl) {
  if (!avatarUrl) return null;
  if (typeof avatarUrl !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(avatarUrl)) {
    return 'Foto de perfil inválida.';
  }
  if (avatarUrl.length > 400000) return 'A foto de perfil é grande demais.';
  return null;
}

function validateBanner(bannerUrl) {
  if (!bannerUrl) return null;
  if (typeof bannerUrl !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(bannerUrl)) {
    return 'Banner inválido.';
  }
  if (bannerUrl.length > 500000) return 'A imagem de capa é grande demais.';
  return null;
}

// Limite simples de tentativas de login por conta
const loginFailures = new Map();
function tooManyFailures(key) {
  const entry = loginFailures.get(key);
  return !!entry && entry.count >= 8 && Date.now() - entry.first < 5 * 60 * 1000;
}
function registerFailure(key) {
  const entry = loginFailures.get(key);
  if (!entry || Date.now() - entry.first > 5 * 60 * 1000) loginFailures.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

/* ------------------------------------------------------------------ */
/* Salas e presença                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Confirmação de e-mail                                               */
/* ------------------------------------------------------------------ */

// O cadastro só exige confirmação quando há como enviar e-mail:
//  - email.config.json na raiz do projeto ({ "user": "...@gmail.com", "pass": "senha de app" })
//  - MESA_EMAIL_MODE=file grava os códigos em data/outbox.log (usado pelos testes)
const { renderCodeEmail } = require('./email-template');
let mailer = null;
(function setupMailer() {
  if (process.env.MESA_EMAIL_MODE === 'file') {
    mailer = {
      kind: 'file',
      send: async (to, code, kind = 'signup', name = '') => fs.appendFileSync(path.join(DATA_DIR, 'outbox.log'), JSON.stringify({ to, code, kind }) + '\n'),
    };
    return;
  }
  if (process.env.MESA_EMAIL_MODE === 'off') return; // sem confirmação de e-mail, mesmo que exista email.config.json
  const configPath = path.join(__dirname, 'email.config.json');
  if (!fs.existsSync(configPath)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!cfg.user || !cfg.pass) throw new Error('faltam "user" e "pass"');
    const transport = require('nodemailer').createTransport({
      host: cfg.host || 'smtp.gmail.com',
      port: cfg.port || 465,
      secure: cfg.secure !== false,
      auth: { user: cfg.user, pass: String(cfg.pass).replace(/\s/g, '') },
    });
    mailer = {
      kind: 'smtp',
      send: (to, code, kind = 'signup', name = '') => {
        const { subject, text, html } = renderCodeEmail({ kind, code, name });
        return transport.sendMail({ from: cfg.from || `Mesa <${cfg.user}>`, to, subject, text, html });
      },
    };
  } catch (err) {
    console.error('email.config.json inválido; o cadastro segue SEM confirmação de e-mail:', err.message);
  }
})();

const pendingSignups = new Map(); // email -> { data, codeHash, expires, attempts, lastSent }
const pendingResets = new Map(); // email da conta -> { codeHash, expires, attempts, sent: [horários] }
const newCode = () => String(crypto.randomInt(100000, 1000000));
const hashCode = (email, code) => crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');

function nicknameTaken(nickname, exceptId) {
  return db.users.some((u) => u.id !== exceptId && u.nickLower === norm(nickname));
}

function createUser(data) {
  const user = {
    id: newId('user'),
    fullName: data.fullName,
    nickname: data.nickname,
    nickLower: norm(data.nickname),
    email: data.email,
    salt: data.salt,
    passHash: data.passHash,
    avatarUrl: data.avatarUrl || '',
    avatarColor: AVATAR_COLORS[db.users.length % AVATAR_COLORS.length],
    statusText: 'Pronto para estudar',
    emailVerified: !!data.emailVerified,
    presence: 'online',
    notify: 'all',
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save();
  return user;
}

/* ------------------------------------------------------------------ */
/* Moderação: dono > adm > membro                                      */
/* ------------------------------------------------------------------ */

const FOREVER = -1;
const activeUntil = (until) => until === FOREVER || (typeof until === 'number' && until > Date.now());
const RANK = { owner: 3, admin: 2, member: 1 };

function roleOf(room, userId) {
  if (room.ownerId === userId) return 'owner';
  return (room.adminIds || []).includes(userId) ? 'admin' : 'member';
}
/** Quem modera precisa ser adm ou dono E estar acima do alvo. Ninguém age sobre o dono. */
function canModerate(room, actorId, targetId) {
  const actor = RANK[roleOf(room, actorId)];
  return actor >= RANK.admin && actor > RANK[roleOf(room, targetId)];
}
function punishedUntil(room, userId) {
  const until = (room.timeouts || {})[userId];
  return activeUntil(until) ? until : 0;
}
function bannedUntil(room, userId) {
  const until = (room.bans || {})[userId];
  return activeUntil(until) ? until : 0;
}
function parseUntil(value) {
  if (value === 'forever') return FOREVER;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Date.now() + Math.min(minutes, 60 * 24 * 365) * 60000;
}
function durationText(value) {
  if (value === 'forever') return 'para sempre';
  const minutes = Math.round(Number(value));
  if (minutes < 60) return `por ${minutes} min`;
  if (minutes < 1440) return `por ${Math.round(minutes / 60)} h`;
  const days = Math.round(minutes / 1440);
  return `por ${days} ${days === 1 ? 'dia' : 'dias'}`;
}
function untilText(until) {
  if (until === FOREVER) return 'para sempre';
  return `até ${new Date(until).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

const BOARD_TOOLS = ['pen', 'eraser', 'line', 'rect', 'ellipse'];

/* ------------------------------------------------------------------ */
/* Bot de música                                                       */
/* ------------------------------------------------------------------ */

// O servidor guarda a fila e "onde a música está". Cada navegador toca por conta própria
// (player oficial do YouTube ou o arquivo enviado) e se alinha a esse ponto: ninguém precisa
// retransmitir áudio. O estado vive só na memória e some quando a sala esvazia.
let youtubeKey = process.env.YOUTUBE_KEY || '';
try {
  const ytPath = path.join(__dirname, 'youtube.config.json');
  if (!youtubeKey && fs.existsSync(ytPath)) youtubeKey = String(JSON.parse(fs.readFileSync(ytPath, 'utf8')).key || '').trim();
} catch (err) {
  console.error('youtube.config.json inválido:', err.message);
}

const musics = new Map(); // roomId -> { queue, playing, startedAt, positionMs, seq }
const MAX_QUEUE = 30;
const musicSearchCache = new Map();

function musicDto(roomId) {
  const m = musics.get(roomId);
  if (!m) return { on: false, queue: [], playing: false, positionMs: 0, seq: 0, serverTime: Date.now() };
  const hasSong = m.queue.length > 0;
  const positionMs = hasSong ? (m.playing ? Date.now() - m.startedAt : m.positionMs) : 0;
  return { on: true, queue: m.queue, playing: hasSong && m.playing, positionMs: Math.max(0, Math.round(positionMs)), seq: m.seq, serverTime: Date.now() };
}
const musicBroadcast = (roomId) => broadcastCall(roomId, { type: 'music:state', roomId, music: musicDto(roomId) });

/** Arquivo de uma música enviada: some do disco quando ela sai da fila */
function musicDrop(song) {
  if (!song || song.kind !== 'file' || !song.fileId) return;
  delete db.files[song.fileId];
  fs.rm(path.join(UPLOAD_DIR, song.fileId), { force: true }, () => {});
}
function musicStop(roomId) {
  const m = musics.get(roomId);
  if (!m) return;
  m.queue.forEach(musicDrop);
  musics.delete(roomId);
  save();
}
/** Começa a tocar a primeira da fila (ou para, se não sobrou nada) */
function musicRestart(m) {
  m.startedAt = Date.now();
  m.positionMs = 0;
  m.playing = m.queue.length > 0;
  m.seq++;
}
function musicAdvance(roomId) {
  const m = musics.get(roomId);
  if (!m || !m.queue.length) return;
  musicDrop(m.queue.shift());
  musicRestart(m);
  save();
  musicBroadcast(roomId);
}
/** Adm e dono controlam tudo; quem pediu a música que está tocando controla ela */
function canControlMusic(room, userId, m) {
  return RANK[roleOf(room, userId)] >= RANK.admin || (m.queue[0] && m.queue[0].addedById === userId);
}
function musicAddSong(room, user, song) {
  const m = musics.get(room.id);
  if (!m) return { error: 'O bot de música não está na sala. Chame o bot primeiro.' };
  if (m.queue.length >= MAX_QUEUE) return { error: `A fila está cheia (máximo de ${MAX_QUEUE} músicas).` };
  const entry = { id: newId('song'), ...song, addedBy: user.nickname, addedById: user.id };
  m.queue.push(entry);
  if (m.queue.length === 1) musicRestart(m);
  else m.seq++;
  musicBroadcast(room.id);
  return { song: entry };
}

/** Só o código do vídeo: youtu.be/ID, watch?v=ID, shorts/ID, embed/ID, music.youtube.com */
function parseYoutubeId(text) {
  try {
    const url = new URL(String(text || '').trim());
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else {
        const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
        if (m) id = m[1];
      }
    }
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Título e capa pelo oEmbed do YouTube (sem chave). Vídeo que não permite embed responde 401/403. */
async function youtubeInfo(id) {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return { error: 'Vídeo não encontrado. Confira o link.' };
  if (res.status === 401 || res.status === 403) return { error: 'Esse vídeo não permite tocar fora do YouTube (o dono bloqueou). Escolha outro.' };
  if (!res.ok) throw new Error(`YouTube respondeu ${res.status}`);
  const data = await res.json();
  return {
    kind: 'youtube',
    ref: id,
    title: String(data.title || 'Vídeo do YouTube').slice(0, 120),
    author: String(data.author_name || '').slice(0, 80),
    thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

const sockets = new Map(); // userId -> Set<ws>
const calls = new Map(); // roomId -> Map<userId, { ws, media }>

const DEFAULT_MEDIA = () => ({
  isMicOn: false,
  isCameraOn: false,
  isSharingScreen: false,
  micStreamId: null,
  camStreamId: null,
  screenStreamId: null,
});

const findRoom = (id) => db.rooms.find((r) => r.id === id) || null;
const normalizeCode = (code) => {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length === 4 ? `MESA${clean}` : clean;
};
function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += alphabet[crypto.randomInt(alphabet.length)];
    const code = `MESA-${suffix}`;
    if (!db.rooms.some((r) => r.code === code)) return code;
  }
}

const canSee = (room, userId) =>
  (!room.isPrivate || room.memberIds.includes(userId) || room.isHidden === false) && !bannedUntil(room, userId);
const callOf = (roomId) => calls.get(roomId) || new Map();

function memberDto(userId, roomId) {
  const user = findUser(userId);
  const entry = callOf(roomId).get(userId);
  const room = findRoom(roomId);
  if (!user || !room) return null;
  return {
    ...publicUser(user),
    status: 'estudando',
    currentRoomId: roomId,
    ...(entry ? entry.media : DEFAULT_MEDIA()),
    role: roleOf(room, userId),
    punishedUntil: punishedUntil(room, userId),
  };
}

function roomDto(room, viewerId, includeSecret = false) {
  const members = [...callOf(room.id).keys()].map((id) => memberDto(id, room.id)).filter(Boolean);
  const isMember = room.memberIds.includes(viewerId);
  return {
    id: room.id,
    name: room.name,
    subject: room.subject,
    code: !room.isPrivate || isMember ? room.code : '••••',
    color: room.color,
    gradient: room.gradient,
    isPrivate: room.isPrivate,
    isHidden: room.isPrivate ? room.isHidden !== false : false,
    hasPassword: !!(room.isPrivate && room.password),
    isMember,
    createdAt: room.createdAt,
    ownerId: room.ownerId,
    isOwner: room.ownerId === viewerId,
    iconUrl: room.iconUrl || '',
    memberIds: room.memberIds,
    adminIds: room.adminIds || [],
    myRole: roleOf(room, viewerId),
    myPunishedUntil: punishedUntil(room, viewerId),
    ...(includeSecret ? { e2eKey: room.e2eKey } : {}),
    // Só quem modera enxerga a lista de expulsos
    bans:
      RANK[roleOf(room, viewerId)] >= RANK.admin
        ? Object.keys(room.bans || {})
            .filter((id) => bannedUntil(room, id) && findUser(id))
            .map((id) => ({ user: publicUser(findUser(id)), until: room.bans[id] }))
        : [],
    activeCount: members.length,
    members,
  };
}

function roomsFor(userId) {
  return db.rooms
    .filter((r) => canSee(r, userId))
    .sort((a, b) => {
      const mine = Number(b.memberIds.includes(userId)) - Number(a.memberIds.includes(userId));
      return mine || String(b.createdAt).localeCompare(String(a.createdAt));
    })
    .map((r) => roomDto(r, userId));
}

function currentCallRoom(userId) {
  for (const [roomId, map] of calls) if (map.has(userId)) return findRoom(roomId);
  return null;
}

// Pessoas que dividem alguma sala com o usuário
function peopleFor(userId) {
  const ids = new Set();
  for (const room of db.rooms) {
    if (room.memberIds.includes(userId)) room.memberIds.forEach((id) => ids.add(id));
  }
  ids.delete(userId);
  return [...ids]
    .map((id) => {
      const user = findUser(id);
      if (!user) return null;
      const room = currentCallRoom(id);
      const online = sockets.has(id);
      if (room && canSee(room, userId)) {
        return { ...publicUser(user), status: 'estudando', statusText: `Estudando em ${room.name}`, currentRoomId: room.id };
      }
      return {
        ...publicUser(user),
        status: online ? 'online' : 'ausente',
        statusText: online ? user.statusText || 'Online' : 'Offline',
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.status === 'ausente') - Number(b.status === 'ausente') || a.name.localeCompare(b.name));
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
}
function sendToUser(userId, payload) {
  const set = sockets.get(userId);
  if (set) set.forEach((ws) => send(ws, payload));
}
function pushState(userId) {
  sendToUser(userId, { type: 'state', rooms: roomsFor(userId), people: peopleFor(userId) });
}
function pushStateAll() {
  for (const userId of sockets.keys()) pushState(userId);
}
function broadcastCall(roomId, payload, exceptUserId) {
  for (const [userId, entry] of callOf(roomId)) {
    if (userId !== exceptUserId) send(entry.ws, payload);
  }
}

/** Avisa quem compartilha a tela quem está assistindo agora (cada pessoa da chamada guarda em "watching" de quem está vendo a tela) */
function sendScreenViewers(roomId, sharerId) {
  const sharer = callOf(roomId).get(sharerId);
  if (!sharer) return;
  const viewers = [...callOf(roomId)]
    .filter(([id, entry]) => id !== sharerId && entry.watching === sharerId)
    .map(([id]) => memberDto(id, roomId))
    .filter(Boolean);
  send(sharer.ws, { type: 'screen:viewers', roomId, viewers });
}

function removeFromCall(roomId, userId) {
  const map = calls.get(roomId);
  if (!map || !map.has(userId)) return;
  const entry = map.get(userId);
  const wasWatching = entry.watching || null;
  if (entry.ws) entry.ws.roomId = null;
  map.delete(userId);
  // Quem estava vendo a tela de quem saiu deixa de ver
  for (const other of map.values()) if (other.watching === userId) other.watching = null;
  if (wasWatching) sendScreenViewers(roomId, wasWatching);
  if (map.size === 0) {
    calls.delete(roomId);
    musicStop(roomId);
  }
  broadcastCall(roomId, { type: 'peer:left', roomId, userId });
}

/* ------------------------------------------------------------------ */
/* Mensagens e materiais                                               */
/* ------------------------------------------------------------------ */

function messageDto(message) {
  if (message.senderId === 'system') {
    return { ...message, senderName: 'Mesa', senderAvatar: 'M', senderColor: '#ffd027', senderAvatarUrl: '' };
  }
  const user = findUser(message.senderId);
  return {
    ...message,
    senderName: user ? user.nickname : 'Conta removida',
    senderAvatar: user ? (user.nickname[0] || '?').toUpperCase() : '?',
    senderAvatarUrl: user ? user.avatarUrl || '' : '',
    senderColor: user ? user.avatarColor : '#64748b',
  };
}

/** Acha no texto quem foi marcado com @nick (e @todos, só para adm e dono) */
function parseMentions(room, sender, content) {
  const byNick = new Map();
  for (const id of room.memberIds) {
    const user = findUser(id);
    if (user) byNick.set(user.nickLower, user.id);
  }
  const ids = new Set();
  let all = false;
  const re = /@([\p{L}\p{N}_.-]{2,20})/gu;
  let match;
  while ((match = re.exec(content))) {
    let candidate = norm(match[1]);
    if (candidate === 'todos' || candidate === 'everyone') {
      if (RANK[roleOf(room, sender.id)] >= RANK.admin) all = true;
      continue;
    }
    // "@ana." no fim da frase: o ponto não faz parte do nick
    while (candidate.length >= 3) {
      if (byNick.has(candidate)) {
        ids.add(byNick.get(candidate));
        break;
      }
      const stripped = candidate.replace(/[._-]+$/, '');
      if (stripped === candidate) break;
      candidate = stripped;
    }
  }
  ids.delete(sender.id);
  return { mentions: [...ids], mentionAll: all };
}

function addMessage(roomId, senderId, content, attachment, extra) {
  const message = { id: newId('msg'), roomId, senderId, content, ts: Date.now() };
  if (attachment) message.attachment = attachment;
  if (extra) Object.assign(message, extra);
  const list = db.messages[roomId] || (db.messages[roomId] = []);
  list.push(message);
  if (list.length > MAX_MESSAGES_PER_ROOM) list.splice(0, list.length - MAX_MESSAGES_PER_ROOM);
  save();
  broadcastCall(roomId, { type: 'chat:new', message: messageDto(message) });
  return message;
}

function addMaterial(roomId, user, data) {
  const material = {
    id: newId('mat'),
    roomId,
    title: data.title,
    type: data.type,
    size: data.size || undefined,
    url: data.url,
    uploadedBy: user.nickname,
    uploadedById: user.id,
    ts: Date.now(),
    isCustomFile: data.type !== 'link',
    fileId: data.fileId || undefined,
  };
  (db.materials[roomId] || (db.materials[roomId] = [])).unshift(material);
  save();
  broadcastCall(roomId, { type: 'material:new', material });
  addMessage(
    roomId,
    user.id,
    data.type === 'link' ? `Compartilhou o link "${data.title}"` : `Compartilhou o arquivo "${data.title}"`,
    { id: material.id, name: material.title, type: material.type, size: material.size || '', url: material.url, asDocument: true }
  );
  return material;
}

const uploadDays = new Map(); // userId -> { day, bytes } do que a pessoa enviou hoje (zera sozinho a cada dia)
const today = () => new Date().toISOString().slice(0, 10);
const limitText = (bytes) => (bytes >= 1024 * 1024 * 1024 ? `${Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10} GB` : `${Math.round(bytes / 1024 / 1024)} MB`);

/** Quanto ainda dá para enviar agora: pela sala, pela pessoa (hoje) e pelo disco */
function uploadBudget(room, user) {
  let roomUsed = 0;
  for (const file of Object.values(db.files)) if (file.roomId === room.id) roomUsed += file.size || 0;
  const record = uploadDays.get(user.id);
  const dayUsed = record && record.day === today() ? record.bytes : 0;
  let diskFree = Infinity;
  try {
    const stat = fs.statfsSync(UPLOAD_DIR);
    diskFree = Number(stat.bavail) * Number(stat.bsize);
  } catch {}
  return { room: ROOM_QUOTA_BYTES - roomUsed, day: USER_DAILY_BYTES - dayUsed, disk: diskFree - MIN_FREE_DISK_BYTES };
}
function budgetError(budget, size) {
  if (size > budget.disk) return { status: 507, error: 'O servidor está sem espaço para novos arquivos agora. Avise quem cuida do Mesa.' };
  if (size > budget.room) return { status: 413, error: `Essa sala já guarda arquivos demais (limite de ${limitText(ROOM_QUOTA_BYTES)}). Apague arquivos antigos para enviar novos.` };
  if (size > budget.day) return { status: 429, error: `Você já enviou muita coisa hoje (limite de ${limitText(USER_DAILY_BYTES)} por dia). Tente de novo amanhã.` };
  return null;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function pomodoroDto(roomId) {
  const p = (db.pomodoro || {})[roomId];
  if (!p) return { mode: 'focus', running: false, remainingMs: 25 * 60 * 1000 };
  const remainingMs = p.running ? p.remainingMs - (Date.now() - p.updatedAt) : p.remainingMs;
  return { mode: p.mode, running: p.running && remainingMs > 0, remainingMs: Math.max(0, remainingMs) };
}

/* ------------------------------------------------------------------ */
/* API HTTP                                                            */
/* ------------------------------------------------------------------ */

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

function readJson(req, limit = 600 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Requisição grande demais.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function cookieToken(req) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === 'mesa_token' && v.length) {
      try {
        return decodeURIComponent(v.join('='));
      } catch {
        return v.join('=');
      }
    }
  }
  return null;
}

function setAuthCookie(req, res, token) {
  const isHttps = req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const secure = isHttps ? '; Secure' : '';
  const value = token
    ? `mesa_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax${secure}`
    : `mesa_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secure}`;
  res.setHeader('Set-Cookie', value);
}

function setSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=()');
  const isHttps = req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://i.ytimg.com https://*.giphy.com https://media.tenor.com https://c.tenor.com https://i.imgur.com; media-src 'self' data: blob:; connect-src 'self' ws: wss: https://*.giphy.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
  );
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === String(host).toLowerCase();
  } catch {
    return false;
  }
}

function bearer(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return cookieToken(req);
}

const INLINE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/flac',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
const EXT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.opus': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.weba': 'audio/webm',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
};

// Supressão de ruído (RNNoise): o navegador baixa estes arquivos direto da biblioteca instalada
const NOISE_DIR = path.join(__dirname, 'node_modules', '@sapphi-red', 'web-noise-suppressor', 'dist');
const NOISE_FILES = {
  'rnnoiseWorklet.js': { file: path.join(NOISE_DIR, 'rnnoise', 'workletProcessor.js'), type: 'text/javascript; charset=utf-8' },
  'rnnoise.wasm': { file: path.join(NOISE_DIR, 'rnnoise.wasm'), type: 'application/wasm' },
  'rnnoise_simd.wasm': { file: path.join(NOISE_DIR, 'rnnoise_simd.wasm'), type: 'application/wasm' },
};

// Busca de GIFs: precisa de uma chave gratuita do Giphy em giphy.config.json ({ "key": "..." })
let giphyKey = process.env.GIPHY_KEY || '';
try {
  const giphyPath = path.join(__dirname, 'giphy.config.json');
  if (!giphyKey && fs.existsSync(giphyPath)) giphyKey = String(JSON.parse(fs.readFileSync(giphyPath, 'utf8')).key || '').trim();
} catch (err) {
  console.error('giphy.config.json inválido:', err.message);
}
const gifCache = new Map(); // consulta -> { at, gifs }
const isGiphyMedia = (value) => /^https:\/\/(media\d*|i)\.giphy\.com\/[\w\-./?=&%]+$/i.test(String(value || ''));

/* ------------------------------------------------------------------ */
/* Soundpad: sons curtos de cada pessoa, tocados para a chamada toda   */
/* ------------------------------------------------------------------ */

const SOUND_TYPES = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/ogg': 'audio/ogg',
  'audio/webm': 'audio/webm',
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/aac': 'audio/aac',
  'audio/flac': 'audio/flac',
  'audio/x-flac': 'audio/flac',
};
const SOUND_EXTENSIONS = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/flac': 'flac' };
const MAX_SOUND_BYTES = 2 * 1024 * 1024;
const MAX_SOUNDS_PER_USER = 24;
const SOUND_KEY_PATTERN = /^[A-Za-z0-9+*\/.,;'\[\]\\`=\-]{0,32}$/;
const soundHistory = new Map(); // userId -> horários dos últimos sons (limite contra spam)

const cleanSoundName = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 24);
const cleanEmoji = (text) => Array.from(String(text || '').trim()).slice(0, 2).join('');
const soundUrl = (id) => `/api/files/${id}/${encodeURIComponent(db.files[id].name)}`;
const soundsOf = (userId) =>
  (db.sounds[userId] || [])
    .filter((sound) => db.files[sound.id])
    .map((sound) => ({ id: sound.id, name: sound.name, emoji: sound.emoji || '🔊', key: sound.key || '', url: soundUrl(sound.id) }));

const STICKER_TYPES = { 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif', 'image/jpeg': 'jpg' };
const MAX_STICKER_BYTES = 1.5 * 1024 * 1024;
const MAX_STICKERS_PER_USER = 80;
const stickersOf = (userId) => (db.stickers[userId] || []).filter((id) => db.files[id]).map((id) => ({ id, url: `/api/files/${id}/${encodeURIComponent(db.files[id].name)}` }));

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Arquivo grande demais.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'POST /api/signup') {
    const body = await readJson(req);
    const fullName = String(body.fullName || '').trim().slice(0, 80);
    const nickname = String(body.nickname || '').trim();
    const email = norm(body.email);
    const password = String(body.password || '');

    if (!fullName) return json(res, 400, { error: 'Informe seu nome completo.', field: 'fullName' });
    const nickError = validateNickname(nickname);
    if (nickError) return json(res, 400, { error: nickError, field: 'nickname' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      return json(res, 400, { error: 'Informe um e-mail válido.', field: 'email' });
    }
    if (password.length < 6 || password.length > 200) {
      return json(res, 400, { error: 'A senha precisa ter pelo menos 6 caracteres.', field: 'password' });
    }
    const avatarError = validateAvatar(body.avatarUrl);
    if (avatarError) return json(res, 400, { error: avatarError, field: 'avatar' });

    if (nicknameTaken(nickname)) {
      return json(res, 409, { error: 'Esse nickname já está em uso. Escolha outro.', field: 'nickname' });
    }
    if (db.users.some((u) => u.email === email)) {
      return json(res, 409, { error: 'Já existe uma conta com esse e-mail. Faça login.', field: 'email' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const data = { fullName, nickname, email, salt, passHash: hashPassword(password, salt), avatarUrl: body.avatarUrl || '' };

    // Sem envio de e-mail configurado, a conta é criada direto
    if (!mailer) {
      const user = createUser(data);
      const token = createSession(user.id);
      setAuthCookie(req, res, token);
      return json(res, 201, { token, user: privateUser(user) });
    }

    const code = newCode();
    pendingSignups.set(email, {
      data,
      codeHash: hashCode(email, code),
      expires: Date.now() + 15 * 60 * 1000,
      attempts: 0,
      lastSent: Date.now(),
    });
    try {
      await mailer.send(email, code, 'signup', data.fullName);
    } catch (err) {
      pendingSignups.delete(email);
      console.error('Falha ao enviar e-mail de confirmação:', err.message);
      return json(res, 502, { error: 'Não foi possível enviar o e-mail de confirmação. Confira o endereço e tente de novo.', field: 'email' });
    }
    return json(res, 202, { needsVerification: true, email });
  }

  if (route === 'POST /api/signup/verify') {
    const body = await readJson(req);
    const email = norm(body.email);
    const pending = pendingSignups.get(email);
    if (!pending || pending.expires < Date.now()) {
      pendingSignups.delete(email);
      return json(res, 410, { error: 'Esse código expirou. Volte e peça um novo.' });
    }
    pending.attempts += 1;
    if (pending.attempts > 6) {
      pendingSignups.delete(email);
      return json(res, 429, { error: 'Muitas tentativas erradas. Faça o cadastro de novo.' });
    }
    if (hashCode(email, String(body.code || '').trim()) !== pending.codeHash) {
      return json(res, 400, { error: 'Código incorreto. Confira o e-mail e tente de novo.' });
    }
    // Enquanto a pessoa abria o e-mail, alguém pode ter pegado o nickname
    if (nicknameTaken(pending.data.nickname)) {
      pendingSignups.delete(email);
      return json(res, 409, { error: 'Esse nickname foi usado por outra pessoa enquanto você confirmava. Escolha outro.', field: 'nickname' });
    }
    if (db.users.some((u) => u.email === email)) {
      pendingSignups.delete(email);
      return json(res, 409, { error: 'Já existe uma conta com esse e-mail. Faça login.', field: 'email' });
    }
    pendingSignups.delete(email);
    const user = createUser({ ...pending.data, emailVerified: true });
    const token = createSession(user.id);
    setAuthCookie(req, res, token);
    return json(res, 201, { token, user: privateUser(user) });
  }

  if (route === 'POST /api/signup/resend') {
    const body = await readJson(req);
    const email = norm(body.email);
    const pending = pendingSignups.get(email);
    if (!pending || !mailer) return json(res, 410, { error: 'Cadastro não encontrado. Volte e preencha de novo.' });
    if (Date.now() - pending.lastSent < 60 * 1000) {
      return json(res, 429, { error: 'Aguarde um minuto antes de pedir outro código.' });
    }
    const code = newCode();
    pending.codeHash = hashCode(email, code);
    pending.expires = Date.now() + 15 * 60 * 1000;
    pending.attempts = 0;
    pending.lastSent = Date.now();
    try {
      await mailer.send(email, code, 'signup', pending.data.fullName);
    } catch (err) {
      console.error('Falha ao reenviar e-mail de confirmação:', err.message);
      return json(res, 502, { error: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' });
    }
    return json(res, 200, { ok: true });
  }

  if (route === 'POST /api/login') {
    const body = await readJson(req);
    const identifier = norm(body.login);
    const password = String(body.password || '');
    if (!identifier || !password) return json(res, 400, { error: 'Informe e-mail ou nickname e a senha.' });
    if (tooManyFailures(identifier)) {
      return json(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    }
    const user = db.users.find((u) => u.email === identifier || u.nickLower === identifier);
    if (!user || !checkPassword(user, password)) {
      registerFailure(identifier);
      return json(res, 401, { error: 'E-mail/nickname ou senha incorretos.' });
    }
    loginFailures.delete(identifier);
    const token = createSession(user.id);
    setAuthCookie(req, res, token);
    return json(res, 200, { token, user: privateUser(user) });
  }

  // Esqueceu a senha: manda um código de 6 dígitos para o e-mail da conta
  if (route === 'POST /api/password/forgot') {
    const body = await readJson(req);
    const identifier = norm(body.login);
    if (!identifier) return json(res, 400, { error: 'Informe o e-mail da sua conta.' });
    if (!mailer) {
      return json(res, 501, {
        error: 'A recuperação de senha por e-mail ainda não foi ligada neste servidor. Peça para quem cuida do Mesa redefinir a sua senha.',
        field: 'unavailable',
      });
    }
    const user = db.users.find((u) => u.email === identifier || u.nickLower === identifier);
    // A resposta é a mesma exista a conta ou não: ninguém descobre quem tem conta
    if (user) {
      const pending = pendingResets.get(user.email) || { sent: [] };
      const now = Date.now();
      pending.sent = pending.sent.filter((t) => now - t < 60 * 60 * 1000);
      const tooSoon = pending.sent.length && now - pending.sent[pending.sent.length - 1] < 60 * 1000;
      if (!tooSoon && pending.sent.length < 5) {
        const code = newCode();
        pending.codeHash = hashCode(user.email, code);
        pending.expires = now + 15 * 60 * 1000;
        pending.attempts = 0;
        pending.sent.push(now);
        pendingResets.set(user.email, pending);
        try {
          await mailer.send(user.email, code, 'reset', user.fullName);
        } catch (err) {
          pendingResets.delete(user.email);
          console.error('Falha ao enviar e-mail de recuperação de senha:', err.message);
          return json(res, 502, { error: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' });
        }
      }
    }
    return json(res, 200, { ok: true });
  }

  // Confere o código e grava a senha nova (e já entra na conta)
  if (route === 'POST /api/password/reset') {
    const body = await readJson(req);
    const identifier = norm(body.login);
    const password = String(body.password || '');
    const user = db.users.find((u) => u.email === identifier || u.nickLower === identifier);
    const pending = user ? pendingResets.get(user.email) : null;
    if (!user || !pending || pending.expires < Date.now()) {
      if (user) pendingResets.delete(user.email);
      return json(res, 410, { error: 'Esse código expirou ou não existe. Peça um novo.' });
    }
    if (password.length < 6 || password.length > 200) {
      return json(res, 400, { error: 'A senha precisa ter pelo menos 6 caracteres.', field: 'password' });
    }
    pending.attempts += 1;
    if (pending.attempts > 6) {
      pendingResets.delete(user.email);
      return json(res, 429, { error: 'Muitas tentativas erradas. Peça um novo código.' });
    }
    if (hashCode(user.email, String(body.code || '').trim()) !== pending.codeHash) {
      return json(res, 400, { error: 'Código incorreto. Confira o e-mail e tente de novo.', field: 'code' });
    }
    pendingResets.delete(user.email);
    user.salt = crypto.randomBytes(16).toString('hex');
    user.passHash = hashPassword(password, user.salt);
    user.emailVerified = true; // o código chegou no e-mail, então ele é mesmo da pessoa
    // Sai de todos os aparelhos que estavam logados com a senha antiga
    for (const [key, session] of Object.entries(db.sessions)) if (session.userId === user.id) delete db.sessions[key];
    loginFailures.delete(user.email);
    loginFailures.delete(user.nickLower);
    save();
    const token = createSession(user.id);
    setAuthCookie(req, res, token);
    return json(res, 200, { token, user: privateUser(user) });
  }

  if (route === 'GET /api/me') {
    const token = bearer(req);
    const user = userFromToken(token);
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    setAuthCookie(req, res, token);
    return json(res, 200, { user: privateUser(user) });
  }

  if (route === 'POST /api/logout') {
    const token = bearer(req);
    if (token) {
      delete db.sessions[hashToken(token)];
      save();
    }
    setAuthCookie(req, res, null);
    return json(res, 200, { ok: true });
  }

  if (route === 'POST /api/profile') {
    const user = userFromToken(bearer(req));
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    const body = await readJson(req);

    if (body.name !== undefined) {
      const nickname = String(body.name).trim();
      const nickError = validateNickname(nickname);
      if (nickError) return json(res, 400, { error: nickError, field: 'nickname' });
      if (nicknameTaken(nickname, user.id)) {
        return json(res, 409, { error: 'Esse nickname já está em uso. Escolha outro.', field: 'nickname' });
      }
      user.nickname = nickname;
      user.nickLower = norm(nickname);
    }
    if (body.fullName !== undefined) user.fullName = String(body.fullName).trim().slice(0, 80) || user.fullName;
    if (body.statusText !== undefined) user.statusText = String(body.statusText).trim().slice(0, 80);
    if (body.avatarUrl !== undefined) {
      const avatarError = validateAvatar(body.avatarUrl);
      if (avatarError) return json(res, 400, { error: avatarError, field: 'avatar' });
      user.avatarUrl = body.avatarUrl || '';
    }
    if (body.bannerUrl !== undefined) {
      const bannerError = validateBanner(body.bannerUrl);
      if (bannerError) return json(res, 400, { error: bannerError, field: 'banner' });
      user.bannerUrl = body.bannerUrl || '';
    }
    if (body.joinSoundId !== undefined) {
      user.joinSoundId = String(body.joinSoundId || '').slice(0, 60);
    }
    save();
    const room = currentCallRoom(user.id);
    if (room) broadcastCall(room.id, { type: 'peer:joined', roomId: room.id, user: memberDto(user.id, room.id) }, user.id);
    pushStateAll();
    return json(res, 200, { user: privateUser(user) });
  }

  if (route === 'POST /api/upload') {
    const user = userFromToken(bearer(req));
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    const room = findRoom(String(req.headers['x-room-id'] || ''));
    if (!room || !room.memberIds.includes(user.id) || bannedUntil(room, user.id)) {
      return json(res, 403, { error: 'Você não participa dessa sala.' });
    }
    if (punishedUntil(room, user.id)) {
      return json(res, 403, { error: 'Você está de castigo nesta sala e não pode enviar arquivos agora.' });
    }

    let name = 'arquivo';
    try {
      name = decodeURIComponent(String(req.headers['x-file-name'] || 'arquivo'));
    } catch {}
    name = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 120) || 'arquivo';

    const declared = parseInt(req.headers['content-length'] || '0', 10);
    if (declared > MAX_UPLOAD_BYTES) return json(res, 413, { error: 'Arquivo grande demais (máximo de 100 MB).' });
    const budget = uploadBudget(room, user);
    const refused = budgetError(budget, declared);
    if (refused) return json(res, refused.status, { error: refused.error });

    const fileId = crypto.randomBytes(16).toString('hex');
    const fileIv = crypto.randomBytes(16);
    const fileCipher = crypto.createCipheriv('aes-256-ctr', fileKey(fileId), fileIv);
    const filePath = path.join(UPLOAD_DIR, fileId);
    const out = fs.createWriteStream(filePath);
    let size = 0;
    let failed = false;

    const fail = (status, error) => {
      if (failed) return;
      failed = true;
      fileCipher.destroy();
      out.destroy();
      fs.rm(filePath, { force: true }, () => {});
      if (!res.headersSent) json(res, status, { error });
      req.destroy();
    };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) return fail(413, 'Arquivo grande demais (máximo de 100 MB).');
      // Sem Content-Length (ou com um valor falso) o tamanho de verdade só aparece aqui
      const over = budgetError(budget, size);
      if (over) fail(over.status, over.error);
    });
    req.on('error', () => fail(400, 'O envio foi interrompido.'));
    out.on('error', () => fail(500, 'Não foi possível salvar o arquivo.'));
    out.on('finish', () => {
      if (failed) return;
      if (size === 0) return fail(400, 'Arquivo vazio.');
      const ext = path.extname(name).toLowerCase();
      // .webm pode ser áudio ou vídeo: vale o tipo que o navegador declarou, se for um vídeo conhecido
      const declared = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const mime = VIDEO_TYPES.has(declared) ? declared : EXT_TYPES[ext] || 'application/octet-stream';
      db.files[fileId] = { id: fileId, name, mime, size, roomId: room.id, uploaderId: user.id, iv: fileIv.toString('hex') };
      const dayRecord = uploadDays.get(user.id);
      uploadDays.set(user.id, { day: today(), bytes: (dayRecord && dayRecord.day === today() ? dayRecord.bytes : 0) + size });
      const url = `/api/files/${fileId}/${encodeURIComponent(name)}`;
      const isImage = mime.startsWith('image/');
      const asDocument = req.headers['x-as-document'] === '1';

      // Música para o bot: entra na fila (não vira mensagem nem material)
      if (req.headers['x-kind'] === 'music') {
        const dropFile = () => {
          delete db.files[fileId];
          fs.rm(filePath, { force: true }, () => {});
        };
        if (!mime.startsWith('audio/')) {
          dropFile();
          return json(res, 400, { error: 'Envie um arquivo de áudio (mp3, m4a, wav, ogg...).' });
        }
        const added = musicAddSong(room, user, {
          kind: 'file',
          ref: url,
          fileId,
          title: name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Música',
          author: '',
          thumb: '',
        });
        if (added.error) {
          dropFile();
          return json(res, 409, { error: added.error });
        }
        save();
        return json(res, 201, { ok: true });
      }

      // Mensagem de voz: vira um player no chat
      if (req.headers['x-kind'] === 'voice' && mime.startsWith('audio/')) {
        const duration = Math.max(0, Math.min(600, Math.round(Number(req.headers['x-duration']) || 0)));
        addMessage(room.id, user.id, '', { id: fileId, name: 'Mensagem de voz', type: 'audio', size: formatSize(size), url, duration, voice: true });
        return json(res, 201, { ok: true });
      }

      // Arquivo de áudio (mp3, m4a, wav...): aparece como player no chat, a menos que tenha sido enviado "como arquivo"
      if (mime.startsWith('audio/') && !asDocument) {
        addMessage(room.id, user.id, '', { id: fileId, name, type: 'audio', size: formatSize(size), url });
        return json(res, 201, { ok: true });
      }

      // Vídeo: aparece aberto no chat com player (como a foto), a menos que tenha sido enviado "como arquivo"
      if (mime.startsWith('video/') && !asDocument) {
        addMessage(room.id, user.id, '', { id: fileId, name, type: 'video', size: formatSize(size), url });
        return json(res, 201, { ok: true });
      }

      // Foto ou GIF: aparece aberto direto no chat e não entra na lista de materiais
      if (isImage && !asDocument) {
        addMessage(room.id, user.id, '', { id: fileId, name, type: 'image', size: formatSize(size), url });
        return json(res, 201, { ok: true });
      }

      const type = mime === 'application/pdf' ? 'pdf' : isImage ? 'image' : 'file';
      const material = addMaterial(room.id, user, { title: name, type, size: formatSize(size), url, fileId, asDocument: true });
      json(res, 201, { material });
    });
    req.pipe(fileCipher).pipe(out);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/files/')) {
    const viewer = userFromToken(bearer(req));
    if (!viewer) return json(res, 401, { error: 'Faça login para abrir este arquivo.' });

    const fileId = url.pathname.split('/')[3] || '';
    const file = /^[a-f0-9]{32}$/.test(fileId) ? db.files[fileId] : null;
    const filePath = file ? path.join(UPLOAD_DIR, file.id) : null;
    if (!file || !fs.existsSync(filePath)) return json(res, 404, { error: 'Arquivo não encontrado.' });

    if (file.roomId) {
      const room = findRoom(file.roomId);
      if (!room || !canSee(room, viewer.id)) {
        return json(res, 403, { error: 'Você não tem acesso a este arquivo.' });
      }
    }

    const inline = INLINE_TYPES.has(file.mime) && url.searchParams.get('download') !== '1';
    const headers = {
      'Content-Type': inline ? file.mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
    };

    // Pedido de um pedaço do arquivo: é o que deixa avançar e voltar no áudio
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (range && (range[1] || range[2])) {
      let start = range[1] ? parseInt(range[1], 10) : Math.max(0, file.size - parseInt(range[2], 10));
      let end = range[1] && range[2] ? parseInt(range[2], 10) : file.size - 1;
      end = Math.min(end, file.size - 1);
      if (start > end || start >= file.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${file.size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${file.size}`, 'Content-Length': end - start + 1 });
      streamFileRange(file, filePath, start, end, res);
      return;
    }

    res.writeHead(200, { ...headers, 'Content-Length': file.size });
    streamFileRange(file, filePath, 0, file.size - 1, res);
    return;
  }

  /* ----- Supressão de ruído: arquivos da biblioteca ----- */
  if (req.method === 'GET' && url.pathname.startsWith('/api/noise/')) {
    const asset = NOISE_FILES[url.pathname.slice('/api/noise/'.length)];
    if (!asset || !fs.existsSync(asset.file)) return json(res, 404, { error: 'Arquivo não encontrado.' });
    res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'public, max-age=86400' });
    fs.createReadStream(asset.file).pipe(res);
    return;
  }

  /* ----- Soundpad ----- */
  if (url.pathname === '/api/sounds' || url.pathname.startsWith('/api/sounds/')) {
    const user = userFromToken(bearer(req));
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    const mine = db.sounds[user.id] || (db.sounds[user.id] = []);

    if (route === 'GET /api/sounds') return json(res, 200, { sounds: soundsOf(user.id) });

    if (route === 'POST /api/sounds') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const mime = SOUND_TYPES[type];
      if (!mime) return json(res, 400, { error: 'Envie um arquivo de áudio (mp3, wav, ogg, m4a...).' });
      if (mine.length >= MAX_SOUNDS_PER_USER) {
        return json(res, 400, { error: `Você já tem ${MAX_SOUNDS_PER_USER} sons. Apague algum para adicionar outro.` });
      }
      const body = await readBody(req, MAX_SOUND_BYTES);
      if (!body.length) return json(res, 400, { error: 'Arquivo vazio.' });

      let rawName = '';
      let rawEmoji = '';
      try {
        rawName = decodeURIComponent(String(req.headers['x-name'] || ''));
        rawEmoji = decodeURIComponent(String(req.headers['x-emoji'] || ''));
      } catch {}
      const fileId = crypto.randomBytes(16).toString('hex');
      const soundIv = crypto.randomBytes(16);
      const soundCipher = crypto.createCipheriv('aes-256-ctr', fileKey(fileId), soundIv);
      fs.writeFileSync(path.join(UPLOAD_DIR, fileId), Buffer.concat([soundCipher.update(body), soundCipher.final()]));
      db.files[fileId] = { id: fileId, name: `som.${SOUND_EXTENSIONS[mime]}`, mime, size: body.length, roomId: null, uploaderId: user.id, sound: true, iv: soundIv.toString('hex') };
      mine.push({ id: fileId, name: cleanSoundName(rawName) || 'Som', emoji: cleanEmoji(rawEmoji) || '🔊', key: '' });
      save();
      return json(res, 201, { sounds: soundsOf(user.id) });
    }

    if (route === 'POST /api/sounds/update') {
      const body = await readJson(req);
      const sound = mine.find((item) => item.id === String(body.id || ''));
      if (!sound) return json(res, 404, { error: 'Som não encontrado.' });
      if (body.name !== undefined) sound.name = cleanSoundName(body.name) || sound.name;
      if (body.emoji !== undefined) sound.emoji = cleanEmoji(body.emoji) || '🔊';
      if (body.key !== undefined) {
        const key = String(body.key);
        if (!SOUND_KEY_PATTERN.test(key)) return json(res, 400, { error: 'Essa tecla não pode ser usada.' });
        // Cada tecla serve para um som só: quem tinha ela antes perde
        if (key) mine.forEach((item) => { if (item.id !== sound.id && item.key === key) item.key = ''; });
        sound.key = key;
      }
      save();
      return json(res, 200, { sounds: soundsOf(user.id) });
    }

    if (req.method === 'DELETE') {
      const id = url.pathname.split('/')[3] || '';
      if (mine.some((item) => item.id === id)) {
        db.sounds[user.id] = mine.filter((item) => item.id !== id);
        delete db.files[id];
        fs.rm(path.join(UPLOAD_DIR, id), { force: true }, () => {});
        save();
      }
      return json(res, 200, { sounds: soundsOf(user.id) });
    }
  }

  /* ----- Figurinhas ----- */
  if (url.pathname === '/api/stickers' || url.pathname.startsWith('/api/stickers/')) {
    const user = userFromToken(bearer(req));
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    const mine = db.stickers[user.id] || (db.stickers[user.id] = []);

    if (route === 'GET /api/stickers') return json(res, 200, { stickers: stickersOf(user.id) });

    if (route === 'POST /api/stickers') {
      const ext = STICKER_TYPES[String(req.headers['content-type'] || '').split(';')[0]];
      if (!ext) return json(res, 400, { error: 'A figurinha precisa ser uma imagem (PNG, WebP, JPG ou GIF).' });
      if (mine.length >= MAX_STICKERS_PER_USER) return json(res, 400, { error: `Você já tem ${MAX_STICKERS_PER_USER} figurinhas. Apague alguma para criar outra.` });
      const body = await readBody(req, MAX_STICKER_BYTES);
      if (!body.length) return json(res, 400, { error: 'Imagem vazia.' });
      const fileId = crypto.randomBytes(16).toString('hex');
      const stickerIv = crypto.randomBytes(16);
      const stickerCipher = crypto.createCipheriv('aes-256-ctr', fileKey(fileId), stickerIv);
      fs.writeFileSync(path.join(UPLOAD_DIR, fileId), Buffer.concat([stickerCipher.update(body), stickerCipher.final()]));
      const mime = Object.keys(STICKER_TYPES).find((type) => STICKER_TYPES[type] === ext);
      db.files[fileId] = { id: fileId, name: `figurinha.${ext}`, mime, size: body.length, roomId: null, uploaderId: user.id, sticker: true, iv: stickerIv.toString('hex') };
      mine.unshift(fileId);
      save();
      return json(res, 201, { stickers: stickersOf(user.id) });
    }

    if (route === 'POST /api/stickers/save') {
      const body = await readJson(req);
      const file = db.files[String(body.id || '')];
      if (!file || !file.sticker) return json(res, 404, { error: 'Figurinha não encontrada.' });
      if (mine.length >= MAX_STICKERS_PER_USER) return json(res, 400, { error: `Você já tem ${MAX_STICKERS_PER_USER} figurinhas.` });
      if (!mine.includes(file.id)) mine.unshift(file.id);
      save();
      return json(res, 200, { stickers: stickersOf(user.id) });
    }

    if (req.method === 'DELETE') {
      const id = url.pathname.split('/')[3] || '';
      db.stickers[user.id] = mine.filter((stickerId) => stickerId !== id);
      save();
      return json(res, 200, { stickers: stickersOf(user.id) });
    }
  }

  /* ----- Busca de músicas (YouTube) ----- */
  if (route === 'GET /api/music/search') {
    const user = userFromToken(bearer(req));
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    if (!youtubeKey) return json(res, 503, { needsKey: true, error: 'A busca por nome ainda não foi ligada neste servidor.' });
    const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
    if (!query) return json(res, 200, { items: [] });
    const cacheKey = query.toLowerCase();
    const cached = musicSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return json(res, 200, { items: cached.items });
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(query)}&key=${youtubeKey}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (response.status === 403) {
        return json(res, 502, { error: 'A cota gratuita de buscas do YouTube de hoje acabou. Cole o link da música ou tente amanhã.' });
      }
      if (!response.ok) throw new Error(`YouTube respondeu ${response.status}`);
      const payload = await response.json();
      const items = (payload.items || [])
        .filter((item) => item.id && /^[\w-]{11}$/.test(item.id.videoId || ''))
        .map((item) => ({
          id: item.id.videoId,
          title: decodeEntities(item.snippet.title).slice(0, 120),
          author: decodeEntities(item.snippet.channelTitle).slice(0, 80),
          thumb: `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
        }));
      musicSearchCache.set(cacheKey, { at: Date.now(), items });
      if (musicSearchCache.size > 200) musicSearchCache.delete(musicSearchCache.keys().next().value);
      return json(res, 200, { items });
    } catch (err) {
      console.error('Falha na busca de músicas:', err.message);
      return json(res, 502, { error: 'Não foi possível buscar músicas agora. Tente de novo em instantes.' });
    }
  }

  /* ----- Busca de GIFs (Giphy) ----- */
  if (route === 'GET /api/gifs') {
    const user = userFromToken(bearer(req));
    if (!user) return json(res, 401, { error: 'Sessão expirada.' });
    if (!giphyKey) {
      return json(res, 503, { needsKey: true, error: 'A busca de GIFs ainda não foi ligada neste servidor.' });
    }
    const query = String(url.searchParams.get('q') || '').trim().slice(0, 60);
    const cacheKey = query.toLowerCase();
    const cached = gifCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return json(res, 200, { gifs: cached.gifs });

    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13&lang=pt`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyKey}&limit=24&rating=pg-13`;
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Giphy respondeu ${response.status}`);
      const payload = await response.json();
      const gifs = (payload.data || [])
        .map((item) => {
          const images = item.images || {};
          const preview = (images.fixed_width_small || images.fixed_width || {}).url;
          const full = (images.downsized || images.fixed_height || images.original || {}).url;
          return { id: String(item.id), title: String(item.title || 'GIF').slice(0, 80), preview, url: full };
        })
        .filter((gif) => isGiphyMedia(gif.preview) && isGiphyMedia(gif.url));
      gifCache.set(cacheKey, { at: Date.now(), gifs });
      if (gifCache.size > 200) gifCache.delete(gifCache.keys().next().value);
      return json(res, 200, { gifs });
    } catch (err) {
      console.error('Falha na busca de GIFs:', err.message);
      return json(res, 502, { error: 'Não foi possível buscar GIFs agora. Tente de novo em instantes.' });
    }
  }

  return json(res, 404, { error: 'Rota não encontrada.' });
}

/* ------------------------------------------------------------------ */
/* WebSocket                                                           */
/* ------------------------------------------------------------------ */

function handleSocketMessage(ws, msg) {
  const user = findUser(ws.userId);
  if (!user) return;
  const reply = (payload) => send(ws, { type: 'reply', reqId: msg.reqId, ...payload });
  const fail = (error) => reply({ ok: false, error });

  switch (msg.type) {
    case 'room:create': {
      const name = String(msg.name || '').trim().slice(0, 60);
      if (!name) return fail('Dê um nome para a sala.');
      const createIcon = String(msg.iconUrl || '');
      const createIconError = validateRoomIcon(createIcon);
      if (createIconError) return fail(createIconError);
      const isPriv = msg.isPrivate !== false;
      const roomPass = isPriv && msg.password ? String(msg.password).trim().slice(0, 60) : '';
      const room = {
        id: newId('room'),
        name,
        // Texto livre: a pessoa escreve a matéria/assunto que quiser
        subject: String(msg.subject || '').replace(/\s+/g, ' ').trim().slice(0, 30) || 'Geral',
        code: generateRoomCode(),
        color: /^[#\w -]{1,40}$/.test(String(msg.color || '')) ? String(msg.color) : '#2563eb',
        gradient: /^[a-z0-9 -]{1,120}$/.test(String(msg.gradient || ''))
          ? String(msg.gradient)
          : 'from-blue-600 via-blue-700 to-indigo-900',
        isPrivate: isPriv,
        isHidden: isPriv ? msg.isHidden !== false : false,
        password: roomPass ? sealText(roomPass) : '',
        iconUrl: createIcon,
        ownerId: user.id,
        memberIds: [user.id],
        adminIds: [],
        bans: {},
        timeouts: {},
        e2eKey: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date().toISOString(),
      };
      db.rooms.push(room);
      db.messages[room.id] = [
        {
          id: newId('msg'),
          roomId: room.id,
          senderId: 'system',
          content: `Sala "${room.name}" criada. Compartilhe o código ${room.code} para estudar junto.`,
          ts: Date.now(),
        },
      ];
      save();
      reply({ ok: true, room: roomDto(room, user.id) });
      pushStateAll();
      return;
    }

    case 'presence:set': {
      if (['online', 'ausente', 'ocupado'].includes(msg.presence)) user.presence = msg.presence;
      if (['all', 'mentions', 'none'].includes(msg.notify)) user.notify = msg.notify;
      save();
      // Quem está na mesma chamada vê a bolinha mudar na hora
      const inCall = currentCallRoom(user.id);
      if (inCall) broadcastCall(inCall.id, { type: 'peer:joined', roomId: inCall.id, user: memberDto(user.id, inCall.id) }, user.id);
      reply({ ok: true, user: privateUser(user) });
      pushStateAll();
      return;
    }

    case 'room:icon': {
      const room = findRoom(msg.roomId);
      if (!room || !room.memberIds.includes(user.id)) return fail('Sala não encontrada.');
      if (RANK[roleOf(room, user.id)] < RANK.admin) return fail('Só o dono e os adm podem mudar a foto da sala.');
      const icon = String(msg.iconUrl || '');
      const iconError = validateRoomIcon(icon);
      if (iconError) return fail(iconError);
      room.iconUrl = icon;
      save();
      addMessage(room.id, 'system', icon ? `${user.nickname} mudou a foto da sala.` : `${user.nickname} tirou a foto da sala.`);
      reply({ ok: true });
      pushStateAll();
      return;
    }

    case 'room:update': {
      const room = findRoom(msg.roomId);
      if (!room || !room.memberIds.includes(user.id)) return fail('Sala não encontrada.');
      if (RANK[roleOf(room, user.id)] < RANK.admin) return fail('Só o dono e os adm podem mudar as configurações da sala.');
      const changes = [];
      if (msg.name !== undefined) {
        const name = String(msg.name).replace(/\s+/g, ' ').trim().slice(0, 60);
        if (!name) return fail('Dê um nome para a sala.');
        if (name !== room.name) {
          room.name = name;
          changes.push(`mudou o nome da sala para "${name}"`);
        }
      }
      if (msg.subject !== undefined) {
        const subject = String(msg.subject).replace(/\s+/g, ' ').trim().slice(0, 30) || 'Geral';
        if (subject !== room.subject) {
          room.subject = subject;
          changes.push(`mudou a matéria da sala para "${subject}"`);
        }
      }
      if (msg.isPrivate !== undefined) {
        const isPrivate = !!msg.isPrivate;
        if (isPrivate !== !!room.isPrivate) {
          room.isPrivate = isPrivate;
          if (!isPrivate) {
            room.isHidden = false;
            room.password = '';
          }
          changes.push(isPrivate ? 'deixou a sala privada (só entra com convite)' : 'deixou a sala aberta (entra quem tiver o link)');
        }
      }
      if (msg.isHidden !== undefined && room.isPrivate) {
        room.isHidden = !!msg.isHidden;
      }
      if (msg.password !== undefined && room.isPrivate) {
        const nextPass = String(msg.password || '').trim().slice(0, 60);
        room.password = nextPass ? sealText(nextPass) : '';
      }
      if (msg.color !== undefined) {
        const color = String(msg.color);
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) return fail('Cor inválida.');
        room.color = color;
      }
      if (msg.iconUrl !== undefined) {
        const icon = String(msg.iconUrl || '');
        const iconError = validateRoomIcon(icon);
        if (iconError) return fail(iconError);
        if (icon !== (room.iconUrl || '')) {
          room.iconUrl = icon;
          changes.push(icon ? 'mudou a foto da sala' : 'tirou a foto da sala');
        }
      }
      save();
      if (changes.length) addMessage(room.id, 'system', `${user.nickname} ${changes.join(' e ')}.`);
      reply({ ok: true, room: roomDto(room, user.id) });
      pushStateAll();
      return;
    }

    case 'room:join': {
      const code = normalizeCode(msg.code);
      const room = db.rooms.find((r) => normalizeCode(r.code) === code);
      if (!room) return fail('Código não encontrado. Confira com quem criou a sala.');
      if (bannedUntil(room, user.id)) return fail(`Você foi expulso dessa sala ${untilText(bannedUntil(room, user.id))}.`);
      if (!room.memberIds.includes(user.id)) {
        if (room.isPrivate && room.password) {
          const plainPass = openText(room.password);
          if (String(msg.password || '').trim() !== plainPass) {
            return reply({
              ok: false,
              needsPassword: true,
              roomId: room.id,
              roomName: room.name,
              error: msg.password ? 'Senha incorreta.' : 'Esta sala privada pede uma senha para entrar.',
            });
          }
        }
        room.memberIds.push(user.id);
        save();
      }
      reply({ ok: true, room: roomDto(room, user.id) });
      pushStateAll();
      return;
    }

    case 'room:enter': {
      const room = findRoom(msg.roomId);
      if (!room) return fail('Essa sala não existe mais.');
      if (bannedUntil(room, user.id)) return fail(`Você foi expulso dessa sala ${untilText(bannedUntil(room, user.id))}.`);
      if (!room.memberIds.includes(user.id)) {
        if (room.isPrivate) {
          if (room.password) {
            const plainPass = openText(room.password);
            if (!msg.password || String(msg.password).trim() !== plainPass) {
              return reply({
                ok: false,
                needsPassword: true,
                roomId: room.id,
                roomName: room.name,
                error: msg.password ? 'Senha incorreta.' : 'Sala privada: digite a senha da sala para entrar.',
              });
            }
          } else if (!msg.code || normalizeCode(msg.code) !== normalizeCode(room.code)) {
            return reply({
              ok: false,
              needsCode: true,
              roomId: room.id,
              roomName: room.name,
              error: 'Sala privada: entre usando o código de convite.',
            });
          }
        }
        room.memberIds.push(user.id);
        save();
      }
      const already = callOf(room.id).get(user.id);
      if (!already && callOf(room.id).size >= MAX_CALL_SIZE) {
        return fail(`A sala está cheia (máximo de ${MAX_CALL_SIZE} pessoas na chamada).`);
      }

      // Uma pessoa só fica em uma chamada por vez
      for (const [roomId, map] of [...calls]) {
        const entry = map.get(user.id);
        if (!entry) continue;
        if (entry.ws !== ws) send(entry.ws, { type: 'call:replaced' });
        removeFromCall(roomId, user.id);
      }

      if (!calls.has(room.id)) calls.set(room.id, new Map());
      calls.get(room.id).set(user.id, { ws, media: DEFAULT_MEDIA() });
      ws.roomId = room.id;

      const participants = [...callOf(room.id).keys()]
        .filter((id) => id !== user.id)
        .map((id) => memberDto(id, room.id))
        .filter(Boolean);

      let joinSound = null;
      if (!already && user.joinSoundId && !punishedUntil(room, user.id)) {
        const s = (db.sounds[user.id] || []).find((item) => item.id === user.joinSoundId);
        if (s && db.files[s.id]) {
          joinSound = { userId: user.id, name: s.name, emoji: s.emoji || '🔊', url: soundUrl(s.id) };
        }
      }

      reply({
        ok: true,
        room: roomDto(room, user.id, true),
        participants,
        messages: (db.messages[room.id] || []).slice(-200).map(messageDto),
        materials: db.materials[room.id] || [],
        notes: db.notes[room.id] || '',
        board: db.boards[room.id] || [],
        music: musicDto(room.id),
        pomodoro: pomodoroDto(room.id),
        ...(joinSound ? { joinSound } : {}),
      });
      broadcastCall(room.id, { type: 'peer:joined', roomId: room.id, user: memberDto(user.id, room.id) }, user.id);
      if (joinSound) {
        broadcastCall(room.id, { type: 'sound:play', roomId: room.id, ...joinSound }, user.id);
      }
      pushStateAll();
      return;
    }

    case 'room:leave': {
      if (ws.roomId) {
        removeFromCall(ws.roomId, user.id);
        pushStateAll();
      }
      return;
    }

    case 'room:delete': {
      const room = findRoom(msg.roomId);
      if (!room) return fail('Essa sala não existe mais.');
      if (room.ownerId !== user.id) return fail('Só quem criou a sala pode excluí-la.');
      for (const [, entry] of callOf(room.id)) {
        send(entry.ws, { type: 'room:deleted', roomId: room.id, name: room.name });
        entry.ws.roomId = null;
      }
      calls.delete(room.id);
      for (const file of Object.values(db.files)) {
        if (file.roomId !== room.id) continue;
        delete db.files[file.id];
        fs.rm(path.join(UPLOAD_DIR, file.id), { force: true }, () => {});
      }
      db.rooms = db.rooms.filter((r) => r.id !== room.id);
      delete db.messages[room.id];
      delete db.materials[room.id];
      delete db.notes[room.id];
      delete db.boards[room.id];
      musicStop(room.id);
      if (db.pomodoro) delete db.pomodoro[room.id];
      save();
      reply({ ok: true });
      pushStateAll();
      return;
    }

    case 'mod:role': {
      const room = findRoom(msg.roomId);
      const target = findUser(msg.userId);
      if (!room || !target) return fail('Pessoa ou sala não encontrada.');
      if (room.ownerId !== user.id) return fail('Só o dono da sala pode dar ou tirar o cargo de adm.');
      if (target.id === room.ownerId || !room.memberIds.includes(target.id)) return fail('Não é possível mudar o cargo dessa pessoa.');
      const makeAdmin = msg.role === 'admin';
      room.adminIds = (room.adminIds || []).filter((id) => id !== target.id);
      if (makeAdmin) room.adminIds.push(target.id);
      save();
      addMessage(
        room.id,
        'system',
        makeAdmin ? `${user.nickname} tornou ${target.nickname} adm da sala.` : `${user.nickname} tirou o cargo de adm de ${target.nickname}.`
      );
      if (callOf(room.id).has(target.id)) {
        broadcastCall(room.id, { type: 'peer:joined', roomId: room.id, user: memberDto(target.id, room.id) }, target.id);
      }
      sendToUser(target.id, { type: 'role', roomId: room.id, roomName: room.name, role: makeAdmin ? 'admin' : 'member', by: user.nickname });
      reply({ ok: true });
      pushStateAll();
      return;
    }

    case 'mod:punish':
    case 'mod:pardon': {
      const room = findRoom(msg.roomId);
      const target = findUser(msg.userId);
      if (!room || !target) return fail('Pessoa ou sala não encontrada.');
      if (!canModerate(room, user.id, target.id)) return fail('Você não tem cargo para fazer isso com essa pessoa.');
      const until = msg.type === 'mod:punish' ? parseUntil(msg.duration) : 0;
      if (msg.type === 'mod:punish' && !until) return fail('Escolha por quanto tempo vale o castigo.');

      if (until) room.timeouts[target.id] = until;
      else delete room.timeouts[target.id];
      save();

      const entry = callOf(room.id).get(target.id);
      if (entry && until) {
        entry.media = { ...entry.media, isMicOn: false, isCameraOn: false, isSharingScreen: false };
      }
      addMessage(
        room.id,
        'system',
        until
          ? `${target.nickname} foi castigado por ${user.nickname} ${durationText(msg.duration)}: sem microfone, câmera, tela e chat.`
          : `${user.nickname} tirou o castigo de ${target.nickname}.`
      );
      if (entry) broadcastCall(room.id, { type: 'peer:joined', roomId: room.id, user: memberDto(target.id, room.id) }, target.id);
      sendToUser(target.id, { type: 'punished', roomId: room.id, roomName: room.name, until, by: user.nickname });
      reply({ ok: true });
      pushStateAll();
      return;
    }

    case 'mod:kick': {
      const room = findRoom(msg.roomId);
      const target = findUser(msg.userId);
      if (!room || !target) return fail('Pessoa ou sala não encontrada.');
      if (!canModerate(room, user.id, target.id)) return fail('Você não tem cargo para expulsar essa pessoa.');
      const until = parseUntil(msg.duration);

      sendToUser(target.id, { type: 'kicked', roomId: room.id, roomName: room.name, until, by: user.nickname });
      removeFromCall(room.id, target.id);
      room.memberIds = room.memberIds.filter((id) => id !== target.id);
      room.adminIds = (room.adminIds || []).filter((id) => id !== target.id);
      if (until) room.bans[target.id] = until;
      save();
      addMessage(
        room.id,
        'system',
        until
          ? `${target.nickname} foi expulso por ${user.nickname} e não pode voltar ${durationText(msg.duration)}.`
          : `${target.nickname} foi tirado da sala por ${user.nickname}.`
      );
      reply({ ok: true });
      pushStateAll();
      return;
    }

    case 'mod:unban': {
      const room = findRoom(msg.roomId);
      const target = findUser(msg.userId);
      if (!room || !target) return fail('Pessoa ou sala não encontrada.');
      if (RANK[roleOf(room, user.id)] < RANK.admin) return fail('Só adm ou dono pode liberar quem foi expulso.');
      delete room.bans[target.id];
      save();
      reply({ ok: true });
      pushStateAll();
      return;
    }

    case 'invite': {
      const room = findRoom(msg.roomId);
      const target = findUser(msg.userId);
      if (!room || !target || !room.memberIds.includes(user.id)) return fail('Não foi possível convidar.');
      if (bannedUntil(room, target.id)) {
        if (RANK[roleOf(room, user.id)] < RANK.admin) return fail('Essa pessoa foi expulsa da sala. Só adm ou dono pode liberar.');
        delete room.bans[target.id];
      }
      if (!room.memberIds.includes(target.id)) {
        room.memberIds.push(target.id);
        save();
      }
      sendToUser(target.id, { type: 'invited', roomId: room.id, roomName: room.name, from: user.nickname });
      pushState(target.id);
      reply({ ok: true });
      return;
    }
  }

  // Daqui para baixo: só para quem está dentro de uma chamada
  const roomId = ws.roomId;
  const entry = roomId ? callOf(roomId).get(user.id) : null;
  if (!roomId || !entry || entry.ws !== ws) return;

  const callRoom = findRoom(roomId);
  if (!callRoom) return;
  const punished = !!punishedUntil(callRoom, user.id);
  const BLOCKED_WHEN_PUNISHED = ['sound:play', 'music:summon', 'music:dismiss', 'music:add', 'music:pause', 'music:resume', 'music:skip', 'music:remove', 'music:playnow', 'chat:sticker', 'chat:gif', 'chat:send', 'material:add', 'notes:update', 'pomodoro:set', 'board:draw', 'board:undo', 'board:clear'];
  if (punished && BLOCKED_WHEN_PUNISHED.includes(msg.type)) {
    const text = 'Você está de castigo nesta sala e não pode fazer isso agora.';
    if (msg.reqId) fail(text);
    else if (msg.type === 'chat:send') send(ws, { type: 'notice', text });
    return;
  }

  switch (msg.type) {
    case 'music:summon': {
      if (!musics.has(roomId)) {
        musics.set(roomId, { queue: [], playing: false, startedAt: 0, positionMs: 0, seq: 1 });
        addMessage(roomId, 'system', `${user.nickname} chamou o bot de música para a sala. 🎵`);
        musicBroadcast(roomId);
      }
      reply({ ok: true });
      return;
    }

    case 'music:dismiss': {
      if (RANK[roleOf(callRoom, user.id)] < RANK.admin) return fail('Só o dono e os adm podem mandar o bot embora.');
      musicStop(roomId);
      addMessage(roomId, 'system', `${user.nickname} mandou o bot de música embora.`);
      musicBroadcast(roomId);
      reply({ ok: true });
      return;
    }

    case 'music:add': {
      const id = parseYoutubeId(msg.url);
      if (!id) {
        const isList = /[?&]list=/.test(String(msg.url || ''));
        return fail(isList ? 'Playlists ainda não funcionam. Cole o link de uma música (um vídeo só).' : 'Esse link não parece ser de um vídeo do YouTube.');
      }
      if (!musics.has(roomId)) return fail('O bot de música não está na sala. Chame o bot primeiro.');
      (async () => {
        try {
          const info = await youtubeInfo(id);
          if (info.error) return reply({ ok: false, error: info.error });
          const added = musicAddSong(callRoom, user, info);
          reply(added.error ? { ok: false, error: added.error } : { ok: true });
        } catch (err) {
          console.error('Falha ao ler o vídeo:', err.message);
          reply({ ok: false, error: 'Não foi possível ler esse vídeo agora. Tente de novo em instantes.' });
        }
      })();
      return;
    }

    case 'music:pause':
    case 'music:resume':
    case 'music:skip':
    case 'music:remove':
    case 'music:playnow': {
      const m = musics.get(roomId);
      if (!m || !m.queue.length) return fail('Não há música na fila.');
      const index = msg.type === 'music:remove' || msg.type === 'music:playnow' ? m.queue.findIndex((song) => song.id === msg.id) : 0;
      if (index < 0) return fail('Essa música não está mais na fila.');
      const target = m.queue[index];
      const isAdmin = RANK[roleOf(callRoom, user.id)] >= RANK.admin;
      // Cada um pode tirar da fila a própria música; o resto é de quem controla
      const allowed = msg.type === 'music:remove' ? isAdmin || target.addedById === user.id : canControlMusic(callRoom, user.id, m);
      if (!allowed) return fail('Só o dono, os adm e quem pediu a música que está tocando podem fazer isso.');

      if (msg.type === 'music:pause') {
        if (m.playing) {
          m.positionMs = Date.now() - m.startedAt;
          m.playing = false;
          m.seq++;
        }
      } else if (msg.type === 'music:resume') {
        if (!m.playing) {
          m.startedAt = Date.now() - m.positionMs;
          m.playing = true;
          m.seq++;
        }
      } else if (msg.type === 'music:skip') {
        musicDrop(m.queue.shift());
        musicRestart(m);
      } else if (msg.type === 'music:remove') {
        musicDrop(m.queue.splice(index, 1)[0]);
        if (index === 0) musicRestart(m);
        else m.seq++;
      } else {
        // Tocar agora: leva a música escolhida para o começo da fila
        m.queue.unshift(m.queue.splice(index, 1)[0]);
        musicRestart(m);
      }
      save();
      musicBroadcast(roomId);
      reply({ ok: true });
      return;
    }

    // Todos os navegadores avisam quando a música acaba; só o primeiro aviso vale
    case 'music:ended': {
      const m = musics.get(roomId);
      if (m && m.queue[0] && m.queue[0].id === msg.id) musicAdvance(roomId);
      return;
    }

    case 'music:error': {
      const m = musics.get(roomId);
      if (m && m.queue[0] && m.queue[0].id === msg.id) {
        addMessage(roomId, 'system', `Não consegui tocar "${m.queue[0].title}" e pulei para a próxima.`);
        musicAdvance(roomId);
      }
      return;
    }

    case 'board:draw': {
      const info = msg.stroke || {};
      const id = typeof info.id === 'string' && /^[\w-]{6,40}$/.test(info.id) ? info.id : null;
      if (!id || !Array.isArray(msg.points)) return;
      const points = msg.points
        .slice(0, 2000)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.round(Math.max(-0.05, Math.min(1.05, n)) * 10000) / 10000);
      if (points.length % 2) points.pop();

      const list = db.boards[roomId] || (db.boards[roomId] = []);
      let stroke = null;
      for (let i = list.length - 1; i >= 0 && !stroke; i--) if (list[i].id === id) stroke = list[i];
      if (stroke && stroke.userId !== user.id) return;
      if (!stroke) {
        stroke = {
          id,
          userId: user.id,
          tool: BOARD_TOOLS.includes(info.tool) ? info.tool : 'pen',
          color: /^#[0-9a-fA-F]{6}$/.test(String(info.color)) ? info.color : '#111827',
          size: Math.max(1, Math.min(60, Number(info.size) || 4)),
          points: [],
        };
        list.push(stroke);
        if (list.length > 1500) list.splice(0, list.length - 1500);
      }
      if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
        if (stroke.points.length < 8000) stroke.points.push(...points);
      } else {
        stroke.points = points.slice(0, 4);
      }
      if (msg.done) save();
      broadcastCall(
        roomId,
        {
          type: 'board:draw',
          roomId,
          stroke: { id, userId: user.id, tool: stroke.tool, color: stroke.color, size: stroke.size },
          points,
          done: !!msg.done,
        },
        user.id
      );
      return;
    }

    case 'board:undo': {
      const list = db.boards[roomId] || [];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].userId === user.id) {
          const [removed] = list.splice(i, 1);
          save();
          broadcastCall(roomId, { type: 'board:remove', roomId, ids: [removed.id] });
          break;
        }
      }
      return;
    }

    case 'board:clear': {
      const list = db.boards[roomId] || [];
      if (msg.mine) {
        const ids = list.filter((st) => st.userId === user.id).map((st) => st.id);
        db.boards[roomId] = list.filter((st) => st.userId !== user.id);
        save();
        if (ids.length) broadcastCall(roomId, { type: 'board:remove', roomId, ids });
        return;
      }
      if (RANK[roleOf(callRoom, user.id)] < RANK.admin) {
        return send(ws, { type: 'notice', text: 'Só adm ou dono pode limpar a lousa inteira. Você pode apagar os seus traços.' });
      }
      db.boards[roomId] = [];
      save();
      broadcastCall(roomId, { type: 'board:reset', roomId, strokes: [] });
      return;
    }

    case 'sound:play': {
      const sound = (db.sounds[user.id] || []).find((item) => item.id === msg.id);
      if (!sound || !db.files[sound.id]) return fail('Som não encontrado.');
      // Limite contra spam: um som a cada 0,6 s e no máximo 8 a cada 10 s por pessoa
      const now = Date.now();
      const recent = (soundHistory.get(user.id) || []).filter((t) => now - t < 10000);
      if (recent.length && now - recent[recent.length - 1] < 600) return fail('Calma! Espere um instante entre um som e outro.');
      if (recent.length >= 8) return fail('Muitos sons seguidos. Espere alguns segundos.');
      recent.push(now);
      soundHistory.set(user.id, recent);
      broadcastCall(
        roomId,
        { type: 'sound:play', roomId, userId: user.id, name: sound.name, emoji: sound.emoji || '🔊', url: soundUrl(sound.id) },
        user.id
      );
      reply({ ok: true });
      return;
    }

    case 'chat:sticker': {
      const file = db.files[String(msg.id || '')];
      if (!file || !file.sticker) return;
      addMessage(roomId, user.id, '', {
        id: file.id,
        name: 'Figurinha',
        type: 'sticker',
        size: '',
        url: `/api/files/${file.id}/${encodeURIComponent(file.name)}`,
      });
      return;
    }

    case 'chat:gif': {
      if (!isGiphyMedia(msg.url)) return;
      addMessage(roomId, user.id, '', { id: newId('gif'), name: 'GIF', type: 'image', size: '', url: String(msg.url) });
      return;
    }

    case 'chat:send': {
      const content = String(msg.content || '').trim().slice(0, 6000);
      if (!content) return;
      const isEncrypted = content.startsWith('e2ee:v1:');
      let mentions = [];
      let mentionAll = false;
      if (isEncrypted) {
        if (Array.isArray(msg.mentions)) {
          const allowed = new Set(callRoom.memberIds.filter((id) => id !== user.id));
          mentions = msg.mentions.filter((id) => typeof id === 'string' && allowed.has(id)).slice(0, 20);
        }
        if (msg.mentionAll && RANK[roleOf(callRoom, user.id)] >= RANK.admin) {
          mentionAll = true;
        }
      } else {
        const parsed = parseMentions(callRoom, user, content);
        mentions = parsed.mentions;
        mentionAll = parsed.mentionAll;
      }
      addMessage(roomId, user.id, content, undefined, mentions.length || mentionAll ? { mentions, mentionAll } : undefined);

      // Quem foi marcado mas não está nesta chamada (outra sala, tela inicial) recebe o aviso mesmo assim
      const targets = mentionAll ? callRoom.memberIds.filter((id) => id !== user.id) : mentions;
      const preview = isEncrypted ? '🔒 Nova mensagem criptografada' : content.length > 80 ? `${content.slice(0, 77)}...` : content;
      for (const userId of targets) {
        if (callOf(roomId).has(userId)) continue;
        sendToUser(userId, { type: 'mention', roomId, roomName: callRoom.name, from: user.nickname, preview });
      }
      return;
    }

    // Histórico antigo, em páginas, para a busca do chat: tudo que veio antes da mensagem "beforeId"
    // (se ela foi apagada, vale o horário "beforeTs"). A resposta vem na ordem da conversa.
    case 'chat:history': {
      const list = db.messages[roomId] || [];
      let end = list.findIndex((m) => m.id === msg.beforeId);
      if (end < 0) {
        // A mensagem de referência foi apagada: vale o horário dela (o navegador descarta repetidas)
        const beforeTs = Number(msg.beforeTs);
        end = Number.isFinite(beforeTs) ? list.findIndex((m) => (m.ts || 0) > beforeTs) : 0;
        if (end < 0) end = list.length;
      }
      const start = Math.max(0, end - HISTORY_PAGE);
      reply({ ok: true, messages: list.slice(start, end).map(messageDto), hasMore: start > 0 });
      return;
    }

    case 'chat:delete': {
      const list = db.messages[roomId] || [];
      const index = list.findIndex((m) => m.id === msg.id);
      if (index < 0) return fail('Essa mensagem não existe mais.');
      const target = list[index];
      const isAdmin = RANK[roleOf(callRoom, user.id)] >= RANK.admin;
      if (target.senderId !== user.id && !isAdmin) return fail('Só quem mandou, os adm e o dono podem apagar a mensagem.');
      list.splice(index, 1);

      // Foto/áudio enviado só pelo chat some do disco junto; figurinha e material da sala não são tocados
      const att = target.attachment;
      const file = att && db.files[att.id];
      if (file && !file.sticker && file.roomId === roomId && !(db.materials[roomId] || []).some((m) => m.fileId === file.id)) {
        delete db.files[file.id];
        fs.rm(path.join(UPLOAD_DIR, file.id), { force: true }, () => {});
      }
      save();
      broadcastCall(roomId, { type: 'chat:deleted', roomId, id: target.id });
      reply({ ok: true });
      return;
    }

    case 'material:add': {
      const title = String(msg.title || '').trim().slice(0, 120);
      const link = String(msg.url || '').trim().slice(0, 2000);
      if (!title || !/^https?:\/\/\S+$/i.test(link)) return fail('Informe um título e um link começando com http:// ou https://.');
      addMaterial(roomId, user, { title, type: 'link', url: link });
      reply({ ok: true });
      return;
    }

    case 'media': {
      const m = msg.media || {};
      const id = (v) => (typeof v === 'string' && v.length <= 100 ? v : null);
      entry.media = {
        // Quem está de castigo não liga microfone, câmera nem tela
        isMicOn: !punished && !!m.isMicOn,
        isCameraOn: !punished && !!m.isCameraOn,
        isSharingScreen: !punished && !!m.isSharingScreen,
        micStreamId: id(m.micStreamId),
        camStreamId: id(m.camStreamId),
        screenStreamId: id(m.screenStreamId),
      };
      // Parou de compartilhar: ninguém mais está assistindo
      if (!entry.media.isSharingScreen) {
        let had = false;
        for (const other of callOf(roomId).values()) {
          if (other.watching === user.id) {
            other.watching = null;
            had = true;
          }
        }
        if (had) sendScreenViewers(roomId, user.id);
      }
      broadcastCall(roomId, { type: 'peer:media', roomId, userId: user.id, media: entry.media }, user.id);
      pushStateAll();
      return;
    }

    // Quem clica em "Assistir à tela" (ou em "Parar de assistir") avisa quem está compartilhando
    case 'screen:watch': {
      const targetId = typeof msg.userId === 'string' ? msg.userId : null;
      const before = entry.watching || null;
      const target = targetId && targetId !== user.id ? callOf(roomId).get(targetId) : null;
      entry.watching = target && target.media && target.media.isSharingScreen ? targetId : null;
      if (before && before !== entry.watching) sendScreenViewers(roomId, before);
      if (entry.watching) sendScreenViewers(roomId, entry.watching);
      return;
    }

    case 'speaking': {
      broadcastCall(roomId, { type: 'peer:speaking', roomId, userId: user.id, isSpeaking: !!msg.isSpeaking }, user.id);
      return;
    }

    case 'signal': {
      const target = callOf(roomId).get(String(msg.to || ''));
      if (target) send(target.ws, { type: 'signal', from: user.id, data: msg.data });
      return;
    }

    case 'notes:update': {
      db.notes[roomId] = String(msg.text || '').slice(0, 20000);
      save();
      broadcastCall(roomId, { type: 'notes', roomId, text: db.notes[roomId] }, user.id);
      return;
    }

    case 'pomodoro:set': {
      if (!db.pomodoro) db.pomodoro = {};
      const remainingMs = Math.max(0, Math.min(Number(msg.remainingMs) || 0, 60 * 60 * 1000));
      db.pomodoro[roomId] = {
        mode: msg.mode === 'break' ? 'break' : 'focus',
        running: !!msg.running && remainingMs > 0,
        remainingMs,
        updatedAt: Date.now(),
      };
      save();
      broadcastCall(roomId, { type: 'pomodoro', roomId, pomodoro: pomodoroDto(roomId) }, user.id);
      return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

const app = next({ dev: !isProd, dir: __dirname, hostname: 'localhost', port: PORT });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();

  const server = http.createServer((req, res) => {
    setSecurityHeaders(req, res);
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url).catch((err) => {
        if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'Erro interno do servidor.' });
        if (!err.status) console.error(err);
      });
      return;
    }
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') return upgradeHandler(req, socket, head);
    if (!sameOrigin(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = null;
      ws.roomId = null;
      ws.isAlive = true;

      let authTimeout = null;
      const authenticateSocket = (token) => {
        if (ws.userId) return true;
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        const user = userFromToken(token);
        if (!user) {
          ws.close(4001, 'sessao invalida');
          return false;
        }
        ws.userId = user.id;
        if (!sockets.has(user.id)) sockets.set(user.id, new Set());
        sockets.get(user.id).add(ws);
        send(ws, { type: 'hello', user: privateUser(user) });
        pushStateAll();
        return true;
      };

      authTimeout = setTimeout(() => {
        if (!ws.userId && !authenticateSocket(cookieToken(req))) ws.close(4001, 'sessao invalida');
      }, 5000);

      ws.on('pong', () => (ws.isAlive = true));
      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg && msg.type === 'auth') {
          authenticateSocket(msg.token || cookieToken(req));
          return;
        }
        if (!ws.userId && !authenticateSocket(cookieToken(req))) return;
        try {
          handleSocketMessage(ws, msg);
        } catch (err) {
          console.error('Erro ao tratar mensagem', msg && msg.type, err);
          if (msg && msg.reqId) send(ws, { type: 'reply', reqId: msg.reqId, ok: false, error: 'Erro interno do servidor.' });
        }
      });
      ws.on('close', () => {
        if (authTimeout) clearTimeout(authTimeout);
        if (!ws.userId) return;
        if (ws.roomId) removeFromCall(ws.roomId, ws.userId);
        const set = sockets.get(ws.userId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) sockets.delete(ws.userId);
        }
        pushStateAll();
      });
    });
  });

  // Derruba conexões mortas e mantém o túnel acordado
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 25000);

  // Castigos e expulsões com prazo: quando vencem, avisa a sala e a pessoa
  setInterval(() => {
    let changed = false;
    for (const room of db.rooms) {
      for (const [userId, until] of Object.entries(room.timeouts || {})) {
        if (activeUntil(until)) continue;
        delete room.timeouts[userId];
        changed = true;
        if (callOf(room.id).has(userId)) {
          broadcastCall(room.id, { type: 'peer:joined', roomId: room.id, user: memberDto(userId, room.id) }, userId);
        }
        sendToUser(userId, { type: 'punished', roomId: room.id, roomName: room.name, until: 0, expired: true });
      }
      for (const [userId, until] of Object.entries(room.bans || {})) {
        if (activeUntil(until)) continue;
        delete room.bans[userId];
        changed = true;
      }
    }
    if (changed) {
      save();
      pushStateAll();
    }
  }, 5000);

  server.listen(PORT, () => {
    console.log(`Mesa rodando em http://localhost:${PORT} (${isProd ? 'produção' : 'desenvolvimento'})`);
    console.log(`Dados em ${DATA_DIR}`);
    console.log(
      mailer
        ? `Confirmação de e-mail no cadastro: ATIVA (${mailer.kind})`
        : 'Confirmação de e-mail no cadastro: DESATIVADA (crie email.config.json para ativar)'
    );
    console.log(giphyKey ? 'Busca de GIFs: ATIVA' : 'Busca de GIFs: DESATIVADA (crie giphy.config.json para ativar)');
    console.log(youtubeKey ? 'Busca de músicas: ATIVA' : 'Busca de músicas: DESATIVADA (crie youtube.config.json para ativar; colar link funciona sem isso)');
  });
});
