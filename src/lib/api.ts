'use client';

const TOKEN_KEY = 'mesa_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } else {
      localStorage.removeItem(TOKEN_KEY);
      document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    }
  } catch {}
}

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  field?: string;
}

/** Chamada JSON para a API do Mesa. Nunca lança: erros de rede voltam como ok=false. */
export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, error: data?.error, field: data?.field };
  } catch {
    return { ok: false, status: 0, data: {} as T, error: 'Não foi possível falar com o servidor. Verifique sua conexão.' };
  }
}

/** Reduz a foto de perfil para um quadrado pequeno antes de enviar ao servidor. */
export function shrinkAvatar(dataUrl: string, size = 160): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return resolve('');
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

/** Reduz a imagem de capa (banner) para proporção panorâmica leve antes de enviar ao servidor. */
export function shrinkBanner(dataUrl: string, width = 640, height = 220): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return resolve('');
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');
      const targetRatio = width / height;
      const imgRatio = img.width / img.height;
      let sw = img.width;
      let sh = img.height;
      let sx = 0;
      let sy = 0;
      if (imgRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}
