'use client';

export type CopyResult = { ok: true; method: 'image' | 'link' } | { ok: false; error: string };

/** O navegador só aceita PNG na área de transferência: reencoda qualquer imagem (JPG, WebP, GIF) para PNG. */
async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('não deu para converter a imagem');
  return png;
}

/**
 * Copia a imagem para a área de transferência, pronta para colar em outro app.
 * GIF animado vira imagem parada (o navegador não copia animação); para mandar animado, copie o link.
 * Se a imagem não puder ser copiada (site que bloqueia, navegador antigo), copia o endereço dela.
 */
export async function copyImage(url: string): Promise<CopyResult> {
  const absolute = new URL(url, window.location.href).toString();
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('sem suporte');
    const response = await fetch(absolute, { mode: 'cors', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const png = await toPngBlob(await response.blob());
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return { ok: true, method: 'image' };
  } catch {
    try {
      await navigator.clipboard.writeText(absolute);
      return { ok: true, method: 'link' };
    } catch {
      return { ok: false, error: 'O navegador não deixou copiar. Clique com o botão direito na imagem e escolha "Copiar imagem".' };
    }
  }
}

/** Copia só o endereço da imagem (serve para GIF animado) */
export async function copyImageLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(new URL(url, window.location.href).toString());
    return true;
  } catch {
    return false;
  }
}
