'use client';

/**
 * Baixa um arquivo da sala para o computador do usuário.
 * Arquivos enviados ao Mesa ficam em /api/files/...; `?download=1` força o download.
 */
export function downloadFile(url: string | undefined, filename: string) {
  if (!url || url === '#') return false;

  const isServerFile = url.startsWith('/api/files/');
  const href = isServerFile ? `${url}${url.includes('?') ? '&' : '?'}download=1` : url;

  const a = document.createElement('a');
  a.href = href;
  a.download = filename || 'arquivo';
  if (!isServerFile) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
