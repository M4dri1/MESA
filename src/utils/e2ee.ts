'use client';

/**
 * Criptografia ponta a ponta (E2EE) das salas de estudo do Mesa.
 *
 * Cada sala possui uma chave secreta de 256 bits (`e2eKey`) gerada com CSPRNG no servidor e entregue
 * apenas a membros autenticados ao entrarem na sala.
 *
 * As mensagens e anotações saem do navegador cifradas no formato:
 *   `e2ee:v1:<nonce_hex>:<tag_hex>:<cipher_base64>`
 * usando derivação de subchaves via SHA-256/HMAC-SHA256, fluxo autenticado (Encrypt-then-MAC)
 * e nonce aleatório de 128 bits (`crypto.getRandomValues`), funcionando tanto em HTTPS quanto em rede local.
 */

const PREFIX = 'e2ee:v1:';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** SHA-256 síncrono (FIPS 180-4) para derivação de chave e autenticação Encrypt-then-MAC */
function sha256(data: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = data.length * 8;
  const padLen = ((data.length + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  const k = key.length > blockSize ? sha256(key) : key;
  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize + message.length);
  for (let i = 0; i < blockSize; i++) {
    const byte = i < k.length ? k[i] : 0;
    oKeyPad[i] = byte ^ 0x5c;
    iKeyPad[i] = byte ^ 0x36;
  }
  iKeyPad.set(message, blockSize);
  const inner = sha256(iKeyPad);
  const outer = new Uint8Array(blockSize + 32);
  outer.set(oKeyPad);
  outer.set(inner, blockSize);
  return sha256(outer);
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function deriveKeys(roomId: string, secret: string): { encKey: Uint8Array; macKey: Uint8Array } {
  const enc = new TextEncoder();
  const master = hmacSha256(enc.encode(`mesa:e2ee:v1:${roomId}`), enc.encode(secret));
  const encKey = hmacSha256(master, enc.encode('encryption-subkey'));
  const macKey = hmacSha256(master, enc.encode('authentication-subkey'));
  return { encKey, macKey };
}

function xorStream(data: Uint8Array, encKey: Uint8Array, nonce: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const blockInput = new Uint8Array(nonce.length + 4);
  blockInput.set(nonce, 0);
  const view = new DataView(blockInput.buffer);

  let counter = 0;
  for (let offset = 0; offset < data.length; offset += 32) {
    view.setUint32(nonce.length, counter++, false);
    const keystream = hmacSha256(encKey, blockInput);
    const end = Math.min(32, data.length - offset);
    for (let i = 0; i < end; i++) {
      out[offset + i] = data[offset + i] ^ keystream[i];
    }
  }
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Cifra um texto com a chave da sala antes de enviar pelo WebSocket */
export function encryptRoomText(roomId: string, roomSecret: string | undefined, plaintext: string): string {
  if (!plaintext || !roomSecret) return plaintext;
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);

  const { encKey, macKey } = deriveKeys(roomId, roomSecret);
  const plainBytes = new TextEncoder().encode(plaintext);
  const cipherBytes = xorStream(plainBytes, encKey, nonce);

  const macInput = new Uint8Array(nonce.length + cipherBytes.length);
  macInput.set(nonce, 0);
  macInput.set(cipherBytes, nonce.length);
  const tag = hmacSha256(macKey, macInput).slice(0, 16);

  return `${PREFIX}${toHex(nonce)}:${toHex(tag)}:${toBase64(cipherBytes)}`;
}

/** Decifra um texto recebido na sala (valida a assinatura HMAC antes de abrir) */
export function decryptRoomText(roomId: string, roomSecret: string | undefined, payload: string): string {
  if (!payload || !payload.startsWith(PREFIX)) return payload;
  if (!roomSecret) return '🔒 Mensagem criptografada';

  const rest = payload.slice(PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) return '🔒 Mensagem criptografada';

  const nonce = fromHex(parts[0]);
  const tag = fromHex(parts[1]);
  const cipherBytes = fromBase64(parts[2]);
  if (!nonce || !tag || !cipherBytes || nonce.length !== 16 || tag.length !== 16) {
    return '🔒 Mensagem criptografada';
  }

  const { encKey, macKey } = deriveKeys(roomId, roomSecret);
  const macInput = new Uint8Array(nonce.length + cipherBytes.length);
  macInput.set(nonce, 0);
  macInput.set(cipherBytes, nonce.length);
  const expectedTag = hmacSha256(macKey, macInput).slice(0, 16);

  if (!constantTimeEqual(tag, expectedTag)) {
    return '🔒 Mensagem criptografada';
  }

  const plainBytes = xorStream(cipherBytes, encKey, nonce);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plainBytes);
  } catch {
    return new TextDecoder().decode(plainBytes);
  }
}

export function isEncryptedPayload(text: string | undefined): boolean {
  return typeof text === 'string' && text.startsWith(PREFIX);
}
