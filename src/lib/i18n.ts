/**
 * Idioma do site. O Mesa é escrito em português; ao escolher outro idioma, este módulo troca os
 * textos da tela pelos do dicionário (src/lib/i18n-dict). Funciona para tudo que aparece:
 * textos, dicas (title), placeholders, avisos do servidor e janelas de confirmação.
 *
 * - Em português ele nem liga: nada muda e não custa nada.
 * - Textos escritos por pessoas (mensagens do chat, nomes) ficam com translate="no" e não são traduzidos.
 * - Textos com valores no meio usam "{0}", "{1}"... (ex.: "Perfil de {0}").
 */
import { Lang, getPrefs, subscribePrefs } from './preferences';

type Pattern = { re: RegExp; template: string; groupOf: number[] };

const TEXT_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);
const PLACEHOLDER = /\{(\d+)\}/g;
const HAS_LETTER = /[A-Za-zÀ-ÿ]/;
const DURATION = /^\s*(para sempre|até )/i;

// Cada idioma tem o seu arquivo em ./i18n-dict e só é baixado quando alguém escolhe aquele idioma
const loadDictionary = (lang: Lang): Promise<{ default: Record<string, string> }> => import(`./i18n-dict/${lang}`);

let words = new Map<string, string>();
let patterns: Pattern[] = [];
let observer: MutationObserver | null = null;
let current: Lang = 'pt';
let token = 0;

// O que cada pedaço de texto dizia antes de traduzir, e o que escrevemos no lugar
const originalText = new WeakMap<Text, string>();
const writtenText = new WeakMap<Text, string>();
const originalAttr = new WeakMap<Element, Map<string, string>>();
const writtenAttr = new WeakMap<Element, Map<string, string>>();

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function build(raw: Record<string, string>) {
  words = new Map();
  const list: { key: string; pattern: Pattern }[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!PLACEHOLDER.test(key)) {
      words.set(key, value);
      PLACEHOLDER.lastIndex = 0;
      continue;
    }
    PLACEHOLDER.lastIndex = 0;
    const ids: number[] = [];
    let source = '';
    let last = 0;
    const finder = new RegExp(PLACEHOLDER.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = finder.exec(key))) {
      source += escapeRe(key.slice(last, match.index)) + '(.+?)';
      ids.push(Number(match[1]));
      last = match.index + match[0].length;
    }
    source += escapeRe(key.slice(last));
    const groupOf: number[] = [];
    ids.forEach((id, i) => (groupOf[id] = i + 1));
    list.push({ key, pattern: { re: new RegExp(`^${source}$`), template: value, groupOf } });
  }
  // Os mais específicos (mais texto fixo) primeiro
  patterns = list.sort((a, b) => b.key.length - a.key.length).map((item) => item.pattern);
}

function lookup(core: string): string | null {
  const direct = words.get(core);
  if (direct !== undefined) return direct;
  for (const pattern of patterns) {
    const match = pattern.re.exec(core);
    if (!match) continue;
    return pattern.template.replace(PLACEHOLDER, (_, id) => {
      const captured = match[pattern.groupOf[Number(id)]];
      if (captured === undefined) return '';
      // Só os prazos que o próprio site monta ("para sempre", "até 14:30") são traduzidos.
      // Nomes de pessoas e de salas, que também entram no meio das frases, ficam como estão.
      if (!DURATION.test(captured)) return captured;
      const inner = lookup(captured.trim());
      return inner === null ? captured : inner;
    });
  }
  return null;
}

/** Traduz um texto inteiro, mantendo os espaços do começo e do fim */
export function translateString(raw: string | undefined | null): string {
  const text = raw ?? '';
  if (current === 'pt' || !HAS_LETTER.test(text)) return text;
  const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) as RegExpExecArray;
  const core = parts[2].replace(/\s+/g, ' ');
  const translated = lookup(core);
  return translated === null ? text : parts[1] + translated + parts[3];
}

const isUserContent = (el: Element | null) => {
  for (let node = el; node; node = node.parentElement) {
    if (node.getAttribute('translate') === 'no') return true;
  }
  return false;
};

function translateTextNode(node: Text) {
  const value = node.nodeValue || '';
  if (writtenText.get(node) === value) return; // já está traduzido por nós
  const parent = node.parentElement;
  if (!parent || SKIP_TEXT_TAGS.has(parent.tagName) || !HAS_LETTER.test(value) || isUserContent(parent)) return;
  originalText.set(node, value);
  const next = translateString(value);
  if (next !== value) {
    writtenText.set(node, next);
    node.nodeValue = next;
  } else {
    writtenText.delete(node);
  }
}

function translateAttr(el: Element, name: string) {
  const value = el.getAttribute(name);
  if (value === null) return;
  if (writtenAttr.get(el)?.get(name) === value) return;
  if (!HAS_LETTER.test(value) || isUserContent(el)) return;
  if (!originalAttr.has(el)) originalAttr.set(el, new Map());
  originalAttr.get(el)!.set(name, value);
  const next = translateString(value);
  if (next !== value) {
    if (!writtenAttr.has(el)) writtenAttr.set(el, new Map());
    writtenAttr.get(el)!.set(name, next);
    el.setAttribute(name, next);
  } else {
    writtenAttr.get(el)?.delete(name);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = root;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      for (const name of TEXT_ATTRS) if (el.hasAttribute(name)) translateAttr(el, name);
    } else {
      translateTextNode(node as Text);
    }
    node = walker.nextNode();
  }
}

function restoreAll() {
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const written = writtenAttr.get(el);
      if (written) {
        written.forEach((text, name) => {
          if (el.getAttribute(name) === text) el.setAttribute(name, originalAttr.get(el)?.get(name) ?? text);
        });
        writtenAttr.delete(el);
      }
    } else {
      const text = node as Text;
      const written = writtenText.get(text);
      if (written !== undefined && text.nodeValue === written) text.nodeValue = originalText.get(text) ?? written;
      writtenText.delete(text);
    }
    node = walker.nextNode();
  }
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(translateTree);
      else if (record.type === 'characterData') translateTextNode(record.target as Text);
      else if (record.type === 'attributes' && record.attributeName) translateAttr(record.target as Element, record.attributeName);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TEXT_ATTRS,
  });
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
}

/* Janelas de confirmação do navegador (confirm, alert, prompt) também saem no idioma escolhido */
let nativeDialogs: { confirm: typeof window.confirm; alert: typeof window.alert; prompt: typeof window.prompt } | null = null;

function patchDialogs() {
  if (nativeDialogs) return;
  const native = { confirm: window.confirm, alert: window.alert, prompt: window.prompt };
  nativeDialogs = native;
  window.confirm = (message?: string) => native.confirm.call(window, translateString(message));
  window.alert = (message?: unknown) => native.alert.call(window, translateString(message === undefined ? '' : String(message)));
  window.prompt = (message?: string, fallback?: string) => native.prompt.call(window, translateString(message), fallback);
}

function unpatchDialogs() {
  if (!nativeDialogs) return;
  window.confirm = nativeDialogs.confirm;
  window.alert = nativeDialogs.alert;
  window.prompt = nativeDialogs.prompt;
  nativeDialogs = null;
}

async function setLanguage(lang: Lang) {
  const mine = ++token;
  if (lang === 'pt') {
    stopObserver();
    restoreAll();
    unpatchDialogs();
    words = new Map();
    patterns = [];
    current = 'pt';
    document.documentElement.removeAttribute('data-mesa-lang');
    return;
  }
  try {
    const loaded = await loadDictionary(lang);
    if (mine !== token) return; // a pessoa trocou de idioma enquanto carregava
    stopObserver();
    restoreAll();
    build(loaded.default);
    current = lang;
    patchDialogs();
    translateTree(document.documentElement);
    startObserver();
  } catch {
    // sem o dicionário o site continua em português
  } finally {
    // libera a tela (ela fica escondida no primeiro carregamento até o texto estar traduzido)
    if (mine === token) document.documentElement.setAttribute('data-mesa-ready', '1');
  }
}

/** Liga o idioma escolhido e acompanha as mudanças feitas em Configurações. Devolve a função que desliga. */
export function startI18n(): () => void {
  let last: Lang | null = null;
  const sync = () => {
    const lang = getPrefs().lang;
    if (lang === last) return;
    last = lang;
    void setLanguage(lang);
  };
  const unsubscribe = subscribePrefs(sync);
  sync();
  return () => {
    unsubscribe();
    token += 1;
    stopObserver();
    restoreAll();
    unpatchDialogs();
  };
}
