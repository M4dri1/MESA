/**
 * Visual dos e-mails do Mesa (código de confirmação do cadastro e de nova senha).
 *
 * E-mail não entende CSS moderno: o layout é feito com tabelas e estilos escritos em cada elemento,
 * que é o que funciona no Gmail, Outlook, iPhone etc. O logo é só CSS (círculo amarelo com o "M"),
 * então não depende de imagem hospedada em lugar nenhum.
 */

const COLORS = {
  page: '#eef1f7',
  card: '#ffffff',
  navy: '#0b1020',
  navySoft: '#97a3c2',
  yellow: '#ffd027',
  amber: '#f59e0b',
  ink: '#0b1020',
  text: '#46506a',
  muted: '#8a93aa',
  codeBg: '#f4f6fc',
  codeBorder: '#dbe2f1',
  footerBg: '#f7f9fd',
  line: '#e6eaf4',
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono','Roboto Mono',Menlo,Consolas,'Courier New',monospace";

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Primeiro nome, já seguro para entrar no HTML ("" se não houver nome) */
const firstName = (fullName) => {
  const first = String(fullName || '').trim().split(/\s+/)[0] || '';
  return escapeHtml(first.slice(0, 30));
};

const COPY = {
  signup: {
    subject: (code) => `${code} é o seu código do Mesa`,
    title: 'Confirme seu e-mail',
    intro: 'Falta só um passo para criar a sua conta no Mesa. Digite o código abaixo na tela de cadastro.',
    safety: 'Se você não tentou criar uma conta, pode ignorar este e-mail: nada será criado.',
    footer: 'Você recebeu este e-mail porque este endereço foi usado para criar uma conta no Mesa.',
  },
  reset: {
    subject: (code) => `${code} é o código para criar uma nova senha no Mesa`,
    title: 'Crie uma nova senha',
    intro: 'Recebemos um pedido para redefinir a senha da sua conta no Mesa. Digite o código abaixo na tela de recuperação de senha.',
    safety: 'Se você não pediu isso, pode ignorar este e-mail: a sua senha continua a mesma e ninguém entra na sua conta sem ela.',
    footer: 'Você recebeu este e-mail porque alguém pediu para redefinir a senha da conta que usa este endereço no Mesa.',
  },
};

/** { subject, text, html } do e-mail de código. kind: "signup" (cadastro) ou "reset" (nova senha) */
function renderCodeEmail({ kind = 'signup', code, name = '' }) {
  const copy = COPY[kind] || COPY.signup;
  const who = firstName(name);
  const greeting = who ? `Olá, ${who}!` : 'Olá!';
  const preheader = `Seu código é ${code}. Ele vale por 15 minutos.`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(copy.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader)}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${COLORS.card};border-radius:20px;overflow:hidden;border:1px solid ${COLORS.line};">

        <!-- Cabeçalho com a marca -->
        <tr>
          <td style="background:${COLORS.navy};padding:26px 32px 24px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;background:${COLORS.yellow};border-radius:22px;font-family:${FONT};font-size:24px;line-height:44px;font-weight:800;color:${COLORS.navy};">M</td>
                <td style="padding-left:14px;font-family:${FONT};">
                  <div style="font-size:22px;line-height:26px;font-weight:800;color:#ffffff;letter-spacing:0.2px;">Mesa</div>
                  <div style="font-size:13px;line-height:18px;color:${COLORS.navySoft};">Sua sala de estudo online</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td height="4" style="height:4px;line-height:4px;font-size:0;background:${COLORS.yellow};background-image:linear-gradient(90deg,${COLORS.yellow},${COLORS.amber});">&nbsp;</td>
        </tr>

        <!-- Conteúdo -->
        <tr>
          <td style="padding:36px 32px 8px 32px;font-family:${FONT};">
            <h1 style="margin:0 0 14px 0;font-size:26px;line-height:32px;font-weight:800;color:${COLORS.ink};">${escapeHtml(copy.title)}</h1>
            <p style="margin:0 0 6px 0;font-size:16px;line-height:24px;font-weight:600;color:${COLORS.ink};">${greeting}</p>
            <p style="margin:0;font-size:16px;line-height:24px;color:${COLORS.text};">${escapeHtml(copy.intro)}</p>
          </td>
        </tr>

        <!-- O código -->
        <tr>
          <td align="center" style="padding:24px 32px 8px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
              <tr>
                <td align="center" style="background:${COLORS.codeBg};border:1px solid ${COLORS.codeBorder};border-radius:16px;padding:22px 12px;">
                  <div style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLORS.muted};padding-bottom:10px;">Seu código</div>
                  <div style="font-family:${MONO};font-size:42px;line-height:48px;font-weight:800;letter-spacing:12px;color:${COLORS.ink};padding-left:12px;">${escapeHtml(code)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:14px 32px 4px 32px;font-family:${FONT};font-size:14px;line-height:20px;color:${COLORS.text};">
            &#9201;&#65039; Este código vale por <strong style="color:${COLORS.ink};">15 minutos</strong> e só pode ser usado por você.
          </td>
        </tr>

        <!-- Segurança -->
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-top:1px solid ${COLORS.line};padding-top:20px;font-family:${FONT};font-size:14px;line-height:21px;color:${COLORS.text};">
                  <strong style="color:${COLORS.ink};">Não foi você?</strong> ${escapeHtml(copy.safety)}
                  <br><br>
                  <strong style="color:${COLORS.ink};">Por segurança,</strong> nunca passe este código para ninguém. A equipe do Mesa nunca pede esse número.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="background:${COLORS.footerBg};border-top:1px solid ${COLORS.line};padding:22px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.muted};">
            ${escapeHtml(copy.footer)}<br>
            Precisa de ajuda? É só responder este e-mail.
            <div style="padding-top:12px;font-weight:700;color:${COLORS.navySoft};">Mesa &middot; estude junto, de qualquer lugar</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const plain = String(name || '').trim().split(/\s+/)[0];
  const text = [
    `Mesa - ${copy.title}`,
    '',
    plain ? `Olá, ${plain.slice(0, 30)}!` : 'Olá!',
    copy.intro,
    '',
    `   SEU CÓDIGO: ${code}`,
    '',
    'Este código vale por 15 minutos e só pode ser usado por você.',
    '',
    `Não foi você? ${copy.safety}`,
    'Por segurança, nunca passe este código para ninguém. A equipe do Mesa nunca pede esse número.',
    '',
    '--',
    copy.footer,
    'Precisa de ajuda? É só responder este e-mail.',
    'Mesa - estude junto, de qualquer lugar',
  ].join('\n');

  return { subject: copy.subject(code), text, html };
}

module.exports = { renderCodeEmail };
