'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import {
  FileText,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Send,
  Download,
  ExternalLink,
  Plus,
  Eye,
  Sparkles,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Smile,
  X,
  Mic,
  Trash2,
  Copy,
  Music2,
  Play,
  Search,
  Lock,
} from 'lucide-react';
import { MusicPanel, MusicStrip } from './MusicPanel';
import { User } from '@/types';
import { copyImage, copyImageLink } from '@/utils/clipboardImage';
import { ChatPicker } from './ChatPicker';
import { EMPTY_FILTER, ChatFilter, MEDIA_KINDS, MediaKind, highlightRanges, isFilterActive, messageMatches, searchTerms } from '@/utils/chatSearch';
import {
  EMPTY_MATERIAL_FILTER,
  MATERIAL_KINDS,
  MaterialFilter,
  MaterialKind,
  isMaterialFilterActive,
  materialMatches,
} from '@/utils/materialSearch';
import { LANGUAGES, usePrefs } from '@/lib/preferences';
import { SearchBar } from './SearchBar';

// Endereços que servem a imagem direto (sem ser a página do site)
const IMAGE_HOSTS = ['media.tenor.com', 'c.tenor.com', 'i.giphy.com', 'i.imgur.com', 'static.klipy.com'];

/** Acha no texto um link que aponta direto para uma imagem ou GIF. */
const formatSeconds = (total: number) => `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}`;

// Arquivo escolhido que ainda espera a confirmação para ir para a sala
type StagedFile = { id: string; file: File; asDocument: boolean; kind: 'image' | 'video' | 'audio' | 'file'; url: string | null };
const MAX_STAGED = 10; // arquivos por envio
const MEDIA_LABELS: Record<MediaKind, string> = {
  photo: 'Fotos e GIFs',
  video: 'Vídeos',
  audio: 'Áudios',
  file: 'Arquivos',
  link: 'Links',
};
/** Site do link ("youtube.com"), para mostrar de onde é e achar na busca */
const materialHost = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const MATERIAL_LABELS: Record<MaterialKind, string> = {
  pdf: 'PDFs',
  image: 'Imagens',
  link: 'Links',
  file: 'Outros',
};
const MAX_FILE_BYTES = 100 * 1024 * 1024; // mesmo limite do servidor

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function findImageUrl(text: string): string | null {
  const links = text.match(/https:\/\/[^\s<>"']+/gi) || [];
  for (const link of links) {
    try {
      const url = new URL(link);
      const isImageFile = /\.(gif|png|jpe?g|webp)$/i.test(url.pathname);
      const isImageHost = IMAGE_HOSTS.includes(url.hostname) || /^media\d*\.giphy\.com$/.test(url.hostname);
      if (isImageFile || isImageHost) return link;
    } catch {}
  }
  return null;
}

export function ChatAndMaterialsPanel() {
  const {
    messages,
    olderMessages,
    historyStatus,
    loadHistory,
    sendMessage,
    materials,
    addMaterial,
    uploadRealFile,
    isUploading,
    uploadProgress,
    downloadStudyMaterial,
    currentUser,
    currentRoom,
    setActiveDocument,
    saveSticker,
    notify,
    music,
    friends,
    myRole,
    deleteMessage,
    unread,
    setChatVisible,
    isChatPanelOpen,
    toggleChatPanel,
  } = useMesa();

  const [activeTab, setActiveTab] = useState<'chat' | 'materials' | 'music'>('chat');
  const [inputText, setInputText] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  // Música: o player fica sempre montado; aqui só guardamos se o navegador barrou o som
  const [musicBlocked, setMusicBlocked] = useState(false);
  const musicResumeRef = useRef<(() => void) | null>(null);

  const copyChatImage = async (src: string) => {
    const result = await copyImage(src);
    if (!result.ok) return notify(result.error);
    notify(result.method === 'image' ? 'Imagem copiada. Cole com Ctrl+V onde quiser.' : 'O navegador não deixou copiar a imagem, então copiei o link dela.');
  };
  const copyChatLink = async (src: string) => {
    notify((await copyImageLink(src)) ? 'Link da imagem copiado.' : 'Não foi possível copiar o link.');
  };

  // Mensagem de voz
  const [recordSeconds, setRecordSeconds] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorderRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; send: boolean; startedAt: number } | null>(null);

  useEffect(() => {
    if (recordSeconds === null) return;
    const timer = window.setInterval(() => {
      const active = recorderRef.current;
      if (!active) return;
      const seconds = (Date.now() - active.startedAt) / 1000;
      setRecordSeconds(seconds);
      if (seconds >= 300) stopRecording(true); // limite de 5 minutos
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordSeconds === null]);

  // Se a pessoa sair da sala gravando, solta o microfone
  useEffect(
    () => () => {
      const active = recorderRef.current;
      if (!active) return;
      active.send = false;
      try {
        active.recorder.stop();
      } catch {}
      active.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const startRecording = async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Este navegador não consegue gravar áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const active = { recorder, stream, chunks: [] as Blob[], send: false, startedAt: Date.now() };
      recorderRef.current = active;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) active.chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = (Date.now() - active.startedAt) / 1000;
        if (!active.send || active.chunks.length === 0 || duration < 0.5) return;
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([new Blob(active.chunks, { type })], `audio-${Date.now()}.${ext}`, { type });
        uploadRealFile(file, { voice: { duration } });
      };
      recorder.start(250);
      setRecordSeconds(0);
      setShowEmojis(false);
      setShowAttachMenu(false);
    } catch {
      setVoiceError('Não foi possível usar o microfone. Libere a permissão no navegador.');
    }
  };

  const stopRecording = (send: boolean) => {
    const active = recorderRef.current;
    recorderRef.current = null;
    setRecordSeconds(null);
    if (!active) return;
    active.send = send;
    try {
      active.recorder.stop();
    } catch {
      active.stream.getTracks().forEach((t) => t.stop());
    }
  };
  const materialsFileInputRef = useRef<HTMLInputElement>(null);

  // Rolagem do chat: abre direto embaixo (sem animar do topo) e acompanha as mensagens novas,
  // mas não puxa a tela de quem subiu para ler mensagens antigas.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  const handleChatScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Abriu o chat (primeira vez, voltou de outra aba ou trocou de sala): começa embaixo, antes de pintar a tela
  useLayoutEffect(() => {
    if (activeTab !== 'chat') return;
    stickRef.current = true;
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentRoom?.id]);

  /* ---------- Busca nas mensagens: palavra, data e tipo de mídia ---------- */
  const prefs = usePrefs();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>(EMPTY_FILTER);
  const [flashId, setFlashId] = useState<string | null>(null);
  const jumpRef = useRef<string | null>(null);
  // O chat mostra só as últimas 200 mensagens; a busca olha o histórico inteiro (olderMessages vem do servidor)
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const filtering = searchOpen && isFilterActive(filter);
  const terms = filtering ? searchTerms(filter.text) : [];
  const pool = useMemo(() => {
    if (!olderMessages.length) return messages;
    const recent = new Set(messages.map((m) => m.id));
    return [...olderMessages.filter((m) => !recent.has(m.id)), ...messages];
  }, [olderMessages, messages]);
  const shownMessages = useMemo(
    () => (filtering ? pool.filter((m) => messageMatches(m, filter)) : historyExpanded ? pool : messages),
    [filtering, filter, pool, historyExpanded, messages]
  );
  const filterKey = `${filtering}|${filter.text}|${filter.from}|${filter.to}|${filter.kinds.join(',')}`;
  const locale = LANGUAGES.find((l) => l.code === prefs.lang)?.htmlLang || 'pt-BR';
  // O ano só aparece quando não é o ano atual (a data fica curta e cabe no celular)
  // Aba Materiais: mesma ideia (nome, quem enviou, dia e tipo)
  const [matSearchOpen, setMatSearchOpen] = useState(false);
  const [matFilter, setMatFilter] = useState<MaterialFilter>(EMPTY_MATERIAL_FILTER);
  const matFiltering = matSearchOpen && isMaterialFilterActive(matFilter);
  const matTerms = matFiltering ? searchTerms(matFilter.text) : [];
  const shownMaterials = useMemo(
    () => (matFiltering ? materials.filter((m) => materialMatches(m, matFilter)) : materials),
    [matFiltering, matFilter, materials]
  );
  const closeMatSearch = () => {
    setMatSearchOpen(false);
    setMatFilter(EMPTY_MATERIAL_FILTER);
  };
  const toggleMatKind = (kind: MaterialKind) =>
    setMatFilter((f) => ({ ...f, kinds: f.kinds.includes(kind) ? f.kinds.filter((k) => k !== kind) : [...f.kinds, kind] }));

  const dayLabel = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(locale, sameYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setFilter(EMPTY_FILTER);
  };
  const toggleKind = (kind: MediaKind) =>
    setFilter((f) => ({ ...f, kinds: f.kinds.includes(kind) ? f.kinds.filter((k) => k !== kind) : [...f.kinds, kind] }));

  // Outra sala: a busca começa do zero
  useEffect(() => {
    closeSearch();
    closeMatSearch();
    setHistoryExpanded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.id]);

  // Abriu a busca: traz o histórico completo da sala (uma vez por sala)
  useEffect(() => {
    if (searchOpen && historyStatus === 'idle') void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, historyStatus, currentRoom?.id]);

  // Voltou às mensagens recentes: começa embaixo, na conversa de agora
  useLayoutEffect(() => {
    if (historyExpanded) return;
    stickRef.current = true;
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyExpanded]);

  // Resultado novo: mostra o mais recente embaixo (a não ser que a pessoa pediu para ir até uma mensagem)
  useLayoutEffect(() => {
    if (jumpRef.current) return;
    stickRef.current = true;
    scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // "Ver no chat": tira o filtro e leva até a mensagem, destacando ela por um instante
  useEffect(() => {
    const id = jumpRef.current;
    if (!id || filtering) return;
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    jumpRef.current = null;
    if (!el) return;
    stickRef.current = false;
    el.scrollIntoView({ block: 'center' });
    setFlashId(id);
    const timer = window.setTimeout(() => setFlashId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [filtering]);

  const jumpToMessage = (id: string) => {
    jumpRef.current = id;
    // Mensagem que não está entre as últimas 200: a conversa passa a mostrar o histórico inteiro
    if (!messages.some((m) => m.id === id)) setHistoryExpanded(true);
    setFilter(EMPTY_FILTER);
  };

  // Mensagem nova: desce junto se a pessoa já estava embaixo (ou se foi ela que mandou)
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (stickRef.current || last.isMe) scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  /* ---------- Confirmar antes de enviar foto, vídeo ou arquivo ---------- */
  // Escolher, colar ou soltar um arquivo só o coloca aqui, com pré-visualização.
  // Ele vai para a sala quando a pessoa clica em Enviar (ou aperta Enter).
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const stagedRef = useRef<StagedFile[]>([]);
  stagedRef.current = staged;

  const releasePreviews = (items: StagedFile[]) => items.forEach((item) => item.url && URL.revokeObjectURL(item.url));

  const cancelStaged = () => {
    if (stagedRef.current.length === 0) return;
    releasePreviews(stagedRef.current);
    stagedRef.current = [];
    setStaged([]);
  };

  // Outra sala ou saída da tela: o que estava esperando para ser enviado não vai para o lugar errado
  useEffect(() => {
    cancelStaged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.id]);
  useEffect(() => () => releasePreviews(stagedRef.current), []);

  const stageFiles = (files: File[], asDocument: boolean) => {
    if (files.length === 0) return;
    const free = MAX_STAGED - stagedRef.current.length;
    const accepted: StagedFile[] = [];
    let tooBig = 0;
    let overflow = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        tooBig += 1;
      } else if (accepted.length >= free) {
        overflow += 1;
      } else {
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|oga|opus|aac|flac|weba)$/i.test(file.name);
        const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : isAudio ? 'audio' : 'file';
        accepted.push({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          asDocument,
          kind,
          url: kind === 'file' ? null : URL.createObjectURL(file),
        });
      }
    }
    if (tooBig) notify(tooBig === 1 ? 'Um arquivo passa do limite de 100 MB e não foi adicionado.' : `${tooBig} arquivos passam do limite de 100 MB e não foram adicionados.`);
    if (overflow) notify(`Dá para enviar até ${MAX_STAGED} arquivos de uma vez.`);
    if (accepted.length === 0) return;
    const next = [...stagedRef.current, ...accepted];
    stagedRef.current = next;
    setStaged(next);
    setActiveTab('chat');
    setShowAttachMenu(false);
    setShowEmojis(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeStaged = (id: string) => {
    const item = stagedRef.current.find((s) => s.id === id);
    if (item) releasePreviews([item]);
    const next = stagedRef.current.filter((s) => s.id !== id);
    stagedRef.current = next;
    setStaged(next);
  };

  /** Manda o que está na pré-visualização, um arquivo depois do outro */
  const sendStaged = async () => {
    const items = stagedRef.current;
    if (items.length === 0 || isUploading) return;
    cancelStaged();
    for (const item of items) {
      await uploadRealFile(item.file, item.asDocument ? { asDocument: true } : {});
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text && staged.length === 0) return;
    if (text) {
      sendMessage(text);
      setInputText('');
      setMention(null);
    }
    // O texto vai primeiro e aparece em cima da foto, como uma legenda
    if (staged.length > 0) void sendStaged();
  };

  const handleChatFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    stageFiles(Array.from(e.target.files || []), true);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
  };

  const handleChatImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    stageFiles(Array.from(e.target.files || []), false);
    if (chatImageInputRef.current) chatImageInputRef.current.value = '';
  };

  // Ctrl+V com uma imagem copiada (print, GIF) também pede confirmação antes de mandar
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const files = Array.from(e.clipboardData.items)
      .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length === 0) return;
    e.preventDefault();
    stageFiles(files, false);
  };

  const handleMaterialsFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadRealFile(file, { asDocument: true });
      if (materialsFileInputRef.current) materialsFileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Soltar arquivos também só os coloca na pré-visualização do chat
    stageFiles(Array.from(e.dataTransfer.files || []), false);
  };

  const handleAddMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialTitle.trim() || !newMaterialUrl.trim()) return;
    const typed = newMaterialUrl.trim();
    const url = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`;
    const added = await addMaterial({ title: newMaterialTitle.trim(), url });
    if (!added) return;
    setNewMaterialTitle('');
    setNewMaterialUrl('');
    setShowUploadModal(false);
  };

  /* ---------- Marcações (@), copiar e apagar ---------- */
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setVisibleRef = useRef(setChatVisible);
  setVisibleRef.current = setChatVisible;
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const isAdmin = myRole !== 'member';

  // O chat está à vista? (painel aberto, aba do chat ativa, janela em primeiro plano)
  useEffect(() => {
    let wasShown = false;
    const update = () => {
      const el = rootRef.current;
      const shown = !!el && el.offsetParent !== null && activeTab === 'chat';
      // O painel estava escondido (ex.: no celular) e acabou de aparecer: começa embaixo
      if (shown && !wasShown) {
        stickRef.current = true;
        scrollToBottom(false);
      }
      wasShown = shown;
      setVisibleRef.current(shown && !document.hidden);
    };
    update();
    const timer = window.setInterval(update, 800);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      setVisibleRef.current(false);
    };
  }, [activeTab, isChatPanelOpen]);

  // Pessoas da sala que dá para marcar (menos eu)
  const roomPeople: User[] = (() => {
    const ids = new Set(currentRoom?.memberIds || []);
    const byId = new Map<string, User>();
    Object.values(friends).forEach((person) => {
      if (ids.has(person.id)) byId.set(person.id, person);
    });
    (currentRoom?.members || []).forEach((person) => byId.set(person.id, person));
    byId.delete(currentUser.id);
    return Array.from(byId.values());
  })();
  const knownNames = new Map<string, boolean>();
  roomPeople.forEach((person) => knownNames.set(person.name.toLowerCase(), false));
  knownNames.set(currentUser.name.toLowerCase(), true);

  /** Texto da mensagem com os @nomes destacados (âmbar quando é você) */
  const highlight = (part: string, key: number, words: string[] = terms): React.ReactNode => {
    const ranges = highlightRanges(part, words);
    if (!ranges.length) return part;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    ranges.forEach(([from, to], i) => {
      if (from > last) nodes.push(part.slice(last, from));
      nodes.push(
        <mark key={i} data-testid="search-mark" className="rounded px-0.5 bg-[#ffd027]/60 text-slate-900">
          {part.slice(from, to)}
        </mark>
      );
      last = to;
    });
    if (last < part.length) nodes.push(part.slice(last));
    return <React.Fragment key={key}>{nodes}</React.Fragment>;
  };

  const renderContent = (text: string, mentionAll?: boolean) =>
    text.split(/(@[A-Za-zÀ-ÿ0-9_.-]+)/g).map((part, index) => {
      if (!part.startsWith('@')) return highlight(part, index);
      let token = part.slice(1).toLowerCase();
      let trailing = '';
      while (token.length > 1 && !knownNames.has(token) && /[._-]$/.test(token)) {
        trailing = token.slice(-1) + trailing;
        token = token.slice(0, -1);
      }
      const isAll = (token === 'todos' || token === 'everyone') && !!mentionAll;
      if (!isAll && !knownNames.has(token)) return highlight(part, index);
      const me = isAll || !!knownNames.get(token);
      return (
        <React.Fragment key={index}>
          <span
            data-testid="mention-token"
            data-me={me ? 'true' : 'false'}
            className={`px-1 rounded font-semibold ${me ? 'bg-[#ffd027]/50 text-slate-900' : 'bg-[#3044f0]/10 text-[#3044f0]'}`}
          >
            {part.slice(0, part.length - trailing.length)}
          </span>
          {trailing}
        </React.Fragment>
      );
    });

  const mentionQuery = mention ? mention.query.toLowerCase() : '';
  const mentionOptions: { key: string; name: string; hint: string }[] = mention
    ? [
        ...(isAdmin && 'todos'.startsWith(mentionQuery) ? [{ key: '__all__', name: 'todos', hint: 'Avisar todo mundo da sala' }] : []),
        ...roomPeople
          .filter((person) => person.name.toLowerCase().startsWith(mentionQuery))
          .slice(0, 6)
          .map((person) => ({ key: person.id, name: person.name, hint: '' })),
      ]
    : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = /(^|\s)@([A-Za-zÀ-ÿ0-9_.-]*)$/.exec(before);
    if (match) {
      setMention({ start: before.length - match[2].length - 1, query: match[2] });
      setMentionIndex(0);
    } else {
      setMention(null);
    }
  };

  const pickMention = (name: string) => {
    if (!mention) return;
    const end = mention.start + 1 + mention.query.length;
    const next = `${inputText.slice(0, mention.start)}@${name} ${inputText.slice(end)}`;
    setInputText(next);
    setMention(null);
    const caret = mention.start + name.length + 2;
    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      // Se a pessoa já continuou digitando, o cursor está no lugar certo: não puxa de volta
      if (input.value === next) input.setSelectionRange(caret, caret);
    }, 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Esc fecha a pré-visualização sem enviar nada (a lista de @ tem prioridade)
    if (e.key === 'Escape' && staged.length > 0 && !(mention && mentionOptions.length > 0)) {
      e.preventDefault();
      cancelStaged();
      return;
    }
    if (!mention || mentionOptions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pickMention(mentionOptions[Math.min(mentionIndex, mentionOptions.length - 1)].name);
    } else if (e.key === 'Escape') {
      setMention(null);
    }
  };

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Mensagem copiada.');
    } catch {
      notify('Não foi possível copiar. Selecione o texto e use Ctrl+C.');
    }
  };
  const removeMessage = (id: string) => {
    if (confirm('Apagar esta mensagem para todo mundo?')) deleteMessage(id);
  };

  const triggerDownload = (mat: any) => {
    downloadStudyMaterial(mat);
    setDownloadNotice(
      mat.type === 'link' ? `Link aberto: ${mat.title || mat.name}` : `Baixando: ${mat.title || mat.name}`
    );
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div
      ref={rootRef}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`mesa-paper mesa-chat-panel w-80 md:w-[380px] lg:w-[400px] bg-[#f6f5f0] text-slate-900 flex flex-col h-full select-none relative transition-all ${
        isDragging ? 'ring-2 ring-[#3044f0] bg-[#3044f0]/10' : ''
      }`}
    >
      {/* Drag overlay notice */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#3044f0] border-4 border-dashed border-white/60 flex flex-col items-center justify-center p-6 text-center">
          <Upload className="w-12 h-12 text-[#ffd027] animate-bounce mb-3" />
          <h4 className="landing-display text-xl text-white">Solte os arquivos aqui</h4>
          <p className="text-sm text-white/85 mt-2">
            Você confere antes de enviar. Fotos, GIFs e vídeos abrem no chat; outros arquivos ficam nos materiais (até 100 MB).
          </p>
        </div>
      )}

      {/* Download Toast Notification */}
      {downloadNotice && (
        <div className="absolute top-14 inset-x-3 z-40 p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-semibold shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="truncate">{downloadNotice}</span>
        </div>
      )}

      {/* Panel Top Tabs (Discord / SaaS style) */}
      <div className="flex items-center gap-2 border-b border-slate-900/10 px-3 md:px-4 pt-3 pb-2">
        <div className="flex flex-1 items-center gap-3 md:gap-4 min-w-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('chat')}
            className={`relative flex-shrink-0 pb-2 text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'chat' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chat da Sala
            {unread.count > 0 && (
              <span
                data-testid="chat-unread"
                data-mention={unread.mentions > 0 ? 'true' : 'false'}
                className={`ml-1.5 px-1.5 rounded-full text-[10px] font-bold ${
                  unread.mentions > 0 ? 'bg-rose-600 text-white' : 'bg-slate-400 text-slate-900'
                }`}
              >
                {unread.mentions > 0 ? `@${unread.mentions}` : unread.count}
              </span>
            )}
            {activeTab === 'chat' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3044f0] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`relative flex-shrink-0 pb-2 text-xs md:text-sm font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'materials' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Materiais</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#3044f0]/10 text-[#3044f0] border border-[#3044f0]/30">
              {materials.length}
            </span>
            {activeTab === 'materials' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3044f0] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('music')}
            data-testid="tab-music"
            className={`relative flex-shrink-0 pb-2 text-xs md:text-sm font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'music' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            <span>Música</span>
            {music.on && music.queue.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Tocando agora" />
            )}
            {activeTab === 'music' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3044f0] rounded-full" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0 pl-2 ml-1 border-l border-slate-900/10 mb-2">
          <button
            type="button"
            data-testid="chat-search-toggle"
            aria-pressed={activeTab === 'materials' ? matSearchOpen : searchOpen}
            onClick={() => {
              if (activeTab === 'materials') {
                if (matSearchOpen) closeMatSearch();
                else setMatSearchOpen(true);
                return;
              }
              setActiveTab('chat');
              if (searchOpen) closeSearch();
              else setSearchOpen(true);
            }}
            title={activeTab === 'materials' ? 'Procurar nos materiais' : 'Procurar nas mensagens'}
            className={`p-1.5 rounded-lg transition-colors ${
              (activeTab === 'materials' ? matSearchOpen : searchOpen) ? 'text-[#3044f0] bg-slate-900/10' : 'text-slate-500 hover:text-[#3044f0] hover:bg-slate-900/5'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
          {/* Quick upload icon in header */}
          <button
            onClick={() => materialsFileInputRef.current?.click()}
            title="Enviar arquivo do computador"
            className="p-1.5 text-slate-500 hover:text-[#3044f0] rounded-lg hover:bg-slate-900/5 transition-colors"
          >
            <Upload className="w-4 h-4" />
          </button>
          {/* Minimize chat panel on desktop */}
          <button
            type="button"
            onClick={toggleChatPanel}
            title="Ocultar chat e materiais"
            className="hidden md:inline-flex p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-900/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden file input for materials tab */}
      <input
        type="file"
        ref={materialsFileInputRef}
        onChange={handleMaterialsFileSelected}
        className="hidden"
      />

      {/* TAB 1: CHAT */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {searchOpen && (
            <SearchBar
              testPrefix="chat-search"
              placeholder="Procurar por palavra, nome ou arquivo..."
              inputLabel="Procurar nas mensagens"
              text={filter.text}
              from={filter.from}
              to={filter.to}
              kinds={filter.kinds}
              kindOptions={MEDIA_KINDS.map((kind) => ({ kind, label: MEDIA_LABELS[kind] }))}
              onText={(text) => setFilter((f) => ({ ...f, text }))}
              onFrom={(day) => setFilter((f) => ({ ...f, from: day }))}
              onTo={(day) => setFilter((f) => ({ ...f, to: day }))}
              onToggleKind={toggleKind}
              onClose={closeSearch}
              onClear={() => setFilter(EMPTY_FILTER)}
              filtering={filtering}
              countText={
                filtering
                  ? shownMessages.length === 0
                    ? 'Nenhuma mensagem encontrada com esses filtros.'
                    : shownMessages.length === 1
                    ? '1 mensagem encontrada'
                    : `${shownMessages.length} mensagens encontradas`
                  : 'Procura em todo o histórico da sala.'
              }
            >
              {historyStatus === 'loading' && (
                <p data-testid="chat-search-loading" role="status" className="text-[11px] text-[#3044f0]">
                  Carregando o histórico completo...
                </p>
              )}
              {historyStatus === 'error' && (
                <p data-testid="chat-search-history-error" role="alert" className="text-[11px] text-rose-700">
                  Não foi possível carregar as mensagens antigas.{' '}
                  <button type="button" data-testid="chat-search-retry" onClick={() => void loadHistory()} className="font-semibold text-[#3044f0] hover:text-[#2334c9] underline">
                    Tentar de novo
                  </button>
                </p>
              )}
            </SearchBar>
          )}

          {/* Messages Scroll Area */}
          <div ref={scrollRef} onScroll={handleChatScroll} data-testid="chat-scroll" className="flex-1 overflow-y-auto p-4 space-y-4">
            {historyExpanded && !filtering && (
              <div
                data-testid="chat-history-banner"
                className="sticky -top-4 z-10 -mx-4 -mt-4 flex items-center justify-between gap-2 border-b border-[#3044f0]/30 bg-[#3044f0] px-4 py-2 text-[11px] text-white backdrop-blur"
              >
                <span>Mostrando o histórico completo da sala</span>
                <button
                  type="button"
                  data-testid="chat-history-collapse"
                  onClick={() => setHistoryExpanded(false)}
                  className="flex-shrink-0 font-semibold text-[#3044f0] hover:text-slate-950"
                >
                  Voltar às mais recentes
                </button>
              </div>
            )}
            {!filtering && (
              <div
                data-testid="e2ee-badge"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-600"
              >
                <Lock className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                <span>Mensagens e chamadas protegidas com criptografia ponta a ponta</span>
              </div>
            )}
            {shownMessages.map((msg) => {
              const isMine = msg.isMe || msg.senderId === currentUser.id;
              // Foto/GIF enviado (ou link direto de imagem) aparece aberto; o resto vira cartão de documento
              const uploadedImage = msg.attachment && msg.attachment.type === 'image' && !msg.attachment.asDocument ? msg.attachment : null;
              const linkedImage = !msg.attachment && msg.senderId !== 'system' ? findImageUrl(msg.content) : null;
              const inlineSrc = uploadedImage?.url || linkedImage;
              const hideText = !msg.content.trim() || (!!linkedImage && msg.content.trim() === linkedImage);
              const voice = msg.attachment?.type === 'audio' ? msg.attachment : null;
              const sticker = msg.attachment?.type === 'sticker' ? msg.attachment : null;
              const video = msg.attachment?.type === 'video' ? msg.attachment : null;
              const mentionsMe = !isMine && !!(msg.mentions?.includes(currentUser.id) || msg.mentionAll);
              const canDelete = isMine || isAdmin;

              return (
                <div
                  key={msg.id}
                  data-testid="chat-message"
                  data-msg-id={msg.id}
                  data-mention-me={mentionsMe ? 'true' : 'false'}
                  className={`group relative flex items-start gap-3 text-left rounded-lg -mx-2 px-2 py-1 transition-colors ${
                    mentionsMe ? 'bg-[#ffd027]/25 border-l-2 border-[#3044f0]' : 'hover:bg-white/[0.03]'
                  } ${flashId === msg.id ? 'ring-2 ring-[#ffd027] bg-[#ffd027]/35' : ''}`}
                >
                  {/* Copiar e apagar: aparecem ao passar o mouse (sempre visíveis no celular) */}
                  <div className="absolute right-1 top-0 z-10 flex gap-0.5 rounded-lg bg-white border border-slate-900/10 p-0.5 shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {msg.content.trim() && (
                      <button
                        type="button"
                        data-testid="copy-message"
                        title="Copiar mensagem"
                        onClick={() => copyMessage(msg.content)}
                        className="p-1 rounded-md text-slate-700 hover:text-slate-950 hover:bg-slate-900/10"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        data-testid="delete-message"
                        title={isMine ? 'Apagar minha mensagem' : 'Apagar mensagem (adm)'}
                        onClick={() => removeMessage(msg.id)}
                        className="p-1 rounded-md text-rose-700 hover:text-white hover:bg-rose-600/70"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Avatar
                    letter={msg.senderAvatar}
                    avatarUrl={msg.senderAvatarUrl || (isMine ? currentUser.avatarUrl : undefined)}
                    color={msg.senderColor}
                    size="sm"
                    className="mt-0.5"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 text-[13px] font-extrabold text-slate-950 truncate" translate="no">
                        {msg.senderName}
                      </span>
                      <span className="flex-shrink-0 whitespace-nowrap text-[10px] text-slate-500 font-mono">
                        {filtering ? `${dayLabel(msg.ts)} · ${msg.timestamp}` : msg.timestamp}
                      </span>
                    </div>

                    {!hideText && (
                      <p
                        className="text-[13px] text-slate-800 mt-0.5 leading-relaxed break-words select-text"
                        // O que as pessoas escrevem não é traduzido; os avisos do sistema e de arquivo compartilhado são
                        translate={
                          msg.senderId === 'system' || /^Compartilhou o (arquivo|link) "/.test(msg.content)
                            ? undefined
                            : 'no'
                        }
                      >
                        {renderContent(msg.content, msg.mentionAll)}
                      </p>
                    )}

                    {inlineSrc && (
                      <div className="group relative mt-1.5 inline-block max-w-full align-top">
                        <button
                          type="button"
                          data-testid="chat-image"
                          title="Abrir imagem (Ctrl+C copia)"
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                              e.preventDefault();
                              void copyChatImage(inlineSrc);
                            }
                          }}
                          onClick={() =>
                            setActiveDocument({
                              id: `img-${msg.id}`,
                              roomId: currentRoom?.id || '',
                              title: uploadedImage?.name || 'Imagem',
                              type: 'image',
                              size: uploadedImage?.size,
                              url: inlineSrc,
                              uploadedBy: msg.senderName,
                              uploadedAt: 'Hoje',
                              isCustomFile: true,
                            })
                          }
                          className="block max-w-full rounded-xl overflow-hidden border border-slate-900/10 bg-black/30 cursor-zoom-in"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={inlineSrc}
                            alt={uploadedImage?.name || 'Imagem enviada no chat'}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onLoad={() => stickRef.current && scrollToBottom(false)}
                            className="block max-w-full max-h-64 object-contain"
                          />
                        </button>
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            data-testid="copy-image"
                            title="Copiar imagem"
                            onClick={() => copyChatImage(inlineSrc)}
                            className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-testid="copy-image-link"
                            title="Copiar o link da imagem (mantém o GIF animado)"
                            onClick={() => copyChatLink(inlineSrc)}
                            className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    {voice && voice.url && (voice.voice === true || voice.name === 'Mensagem de voz' ? (
                      <div data-testid="chat-voice" className="mt-1.5 flex items-center gap-2 p-2 rounded-2xl bg-white border border-slate-900/10 max-w-full">
                        <Mic className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <audio controls preload="metadata" src={voice.url} className="h-8 flex-1 min-w-0 [color-scheme:dark]" />
                        {!!voice.duration && (
                          <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">{formatSeconds(voice.duration)}</span>
                        )}
                      </div>
                    ) : (
                      <div data-testid="chat-audio-file" className="mt-1.5 p-2.5 rounded-2xl bg-white border border-slate-900/10 max-w-full">
                        <div className="flex items-center gap-2 mb-1.5 min-w-0">
                          <Music2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span translate="no" className="text-xs font-semibold text-slate-800 truncate" title={voice.name}>
                            {voice.name}
                          </span>
                          <span translate="no" className="text-[10px] text-slate-500 flex-shrink-0">
                            {voice.size}
                          </span>
                        </div>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <audio controls preload="metadata" src={voice.url} className="h-8 w-full [color-scheme:dark]" />
                      </div>
                    ))}

                    {video && video.url && (
                      <video
                        data-testid="chat-video"
                        src={video.url}
                        controls
                        playsInline
                        preload="metadata"
                        title={video.name}
                        onLoadedMetadata={() => stickRef.current && scrollToBottom(false)}
                        className="mt-1.5 block max-w-full max-h-64 rounded-xl border border-slate-900/10 bg-black"
                      />
                    )}

                    {sticker && sticker.url && (
                      <button
                        type="button"
                        data-testid="chat-sticker"
                        title="Clique para salvar esta figurinha na sua coleção"
                        onClick={() => saveSticker(sticker.id)}
                        className="mt-1.5 block w-28 h-28 rounded-xl hover:bg-slate-900/5 transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sticker.url} alt="Figurinha" loading="lazy" className="w-full h-full object-contain" />
                      </button>
                    )}

                    {msg.attachment && !uploadedImage && !voice && !sticker && !video && (
                      <div className="mt-2.5 p-2.5 rounded-2xl bg-white hover:bg-slate-900/10 border border-slate-900/10 flex items-center justify-between gap-3 group transition-all shadow-sm">
                        <div
                          onClick={() => {
                            const mat =
                              materials.find((m) => m.title === msg.attachment?.name) ||
                              (msg.attachment?.url
                                ? {
                                    id: `att-${Date.now()}`,
                                    roomId: currentRoom?.id || '',
                                    title: msg.attachment.name,
                                    type: msg.attachment.type as any,
                                    size: msg.attachment.size,
                                    url: msg.attachment.url,
                                    uploadedBy: msg.senderName,
                                    uploadedAt: 'Hoje',
                                    isCustomFile: true,
                                  }
                                : null);
                            if (mat) setActiveDocument(mat);
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span translate="no" className="text-xs font-bold text-slate-900 group-hover:text-[#3044f0] transition-colors block truncate">
                              {msg.attachment.name}
                            </span>
                            <span translate="no" className="text-[10px] text-slate-500 font-mono">
                              {msg.attachment.size}
                            </span>
                          </div>
                        </div>

                        {/* Actions: View and Download */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const mat =
                                materials.find((m) => m.title === msg.attachment?.name) ||
                                (msg.attachment?.url
                                  ? {
                                      id: `att-${Date.now()}`,
                                      roomId: currentRoom?.id || '',
                                      title: msg.attachment.name,
                                      type: msg.attachment.type as any,
                                      size: msg.attachment.size,
                                      url: msg.attachment.url,
                                      uploadedBy: msg.senderName,
                                      uploadedAt: 'Hoje',
                                      isCustomFile: true,
                                    }
                                  : null);
                              if (mat) setActiveDocument(mat);
                            }}
                            title="Visualizar documento"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-900/10 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerDownload(msg.attachment);
                            }}
                            title={`Baixar ${msg.attachment.name}`}
                            className="px-2 py-1 rounded-lg bg-[#3044f0]/10 hover:bg-[#2334c9] text-[#3044f0] hover:text-white border border-[#3044f0]/40 transition-all flex items-center gap-1 text-[11px] font-bold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {filtering && (
                      <button
                        type="button"
                        data-testid="chat-search-jump"
                        onClick={() => jumpToMessage(msg.id)}
                        className="block mt-1.5 text-[11px] font-semibold text-[#3044f0] hover:text-[#2334c9] hover:underline"
                      >
                        Ver no chat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {isUploading && (
            <div className="px-4 py-2 border-t border-slate-900/10 bg-[#f6f5f0]" role="status">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#3044f0] mb-1">
                <span className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 animate-pulse" /> Enviando para a sala...
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900/10 overflow-hidden">
                <div className="h-full bg-[#ffd027] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <MusicStrip blocked={musicBlocked} onResume={() => musicResumeRef.current?.()} onOpen={() => setActiveTab('music')} />

          {(recordSeconds !== null || voiceError) && (
            <div className="px-4 py-2 border-t border-slate-900/10 bg-[#f6f5f0] flex items-center justify-between gap-2" role="status">
              {recordSeconds !== null ? (
                <>
                  <span className="flex items-center gap-2 text-xs font-bold text-rose-700" data-testid="voice-recording">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    Gravando {formatSeconds(recordSeconds)}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="voice-cancel"
                      onClick={() => stopRecording(false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-800 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Descartar
                    </button>
                    <button
                      type="button"
                      data-testid="voice-send"
                      onClick={() => stopRecording(true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar áudio
                    </button>
                  </span>
                </>
              ) : (
                <span className="text-xs text-rose-700">{voiceError}</span>
              )}
            </div>
          )}

          {/* Pré-visualização: nada é enviado até clicar em Enviar */}
          {staged.length > 0 && (
            <div data-testid="chat-attach-preview" role="group" aria-label="Conferir antes de enviar" className="px-3 pt-3 pb-2.5 border-t border-slate-900/10 bg-[#f6f5f0]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-slate-900">
                  {staged.length === 1 ? 'Enviar este arquivo?' : `Enviar estes ${staged.length} arquivos?`}
                </span>
                <span className="hidden md:inline text-[10px] text-slate-500">Enter envia · Esc cancela</span>
              </div>
              <div className={staged.length === 1 ? '' : 'flex gap-2 overflow-x-auto pb-1'}>
                {staged.map((item) => {
                  const single = staged.length === 1;
                  return (
                    <div
                      key={item.id}
                      data-testid="attach-preview-item"
                      data-kind={item.kind}
                      data-document={item.asDocument ? 'true' : 'false'}
                      className={`relative ${single ? 'w-full' : 'w-28 flex-shrink-0'}`}
                    >
                      <div className={`relative ${single ? 'h-40' : 'h-20'} rounded-lg overflow-hidden bg-[#f6f5f0] border border-slate-900/10 flex items-center justify-center`}>
                        {item.kind !== 'audio' && <FileText className="absolute w-7 h-7 text-slate-400" />}
                        {item.kind === 'image' && item.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.url}
                            alt={item.file.name}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                            className={`relative w-full h-full ${single ? 'object-contain' : 'object-cover'}`}
                          />
                        )}
                        {item.kind === 'video' && item.url && (
                          <>
                            <video
                              src={`${item.url}#t=0.1`}
                              muted
                              playsInline
                              preload="metadata"
                              className={`relative w-full h-full ${single ? 'object-contain' : 'object-cover'}`}
                            />
                            <span className="absolute w-8 h-8 rounded-full bg-black/60 flex items-center justify-center pointer-events-none">
                              <Play className="w-4 h-4 text-slate-900" />
                            </span>
                          </>
                        )}
                        {item.kind === 'audio' && item.url && (
                          <div className="relative flex flex-col items-center gap-2 w-full px-3">
                            <Music2 className="w-7 h-7 text-emerald-600" />
                            {single && (
                              // eslint-disable-next-line jsx-a11y/media-has-caption
                              <audio controls preload="metadata" src={item.url} className="h-8 w-full [color-scheme:dark]" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-800 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatSize(item.file.size)}
                        {item.asDocument ? ' · vai como documento' : ''}
                      </p>
                      <button
                        type="button"
                        data-testid="attach-preview-remove"
                        onClick={() => removeStaged(item.id)}
                        title="Tirar este arquivo"
                        aria-label={`Tirar ${item.file.name}`}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 mt-2.5">
                <button
                  type="button"
                  data-testid="attach-preview-cancel"
                  onClick={cancelStaged}
                  className="px-3 py-1.5 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 text-slate-800 text-[11px] font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="attach-preview-send"
                  disabled={isUploading}
                  onClick={() => void sendStaged()}
                  className="px-3 py-1.5 rounded-lg bg-[#3044f0] hover:bg-[#2334c9] disabled:opacity-50 disabled:hover:bg-[#3044f0] text-white text-[11px] font-bold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {isUploading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="relative p-3 bg-[#f6f5f0] border-t border-slate-900/10">
            {mentionOptions.length > 0 && (
              <div
                data-testid="mention-list"
                className="absolute bottom-full left-3 right-3 mb-1 z-30 rounded-xl bg-white border border-slate-900/10 shadow-2xl overflow-hidden"
              >
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Marcar alguém</p>
                {mentionOptions.map((option, index) => (
                  <button
                    key={option.key}
                    type="button"
                    data-testid="mention-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickMention(option.name)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                      index === mentionIndex ? 'bg-[#3044f0]/10 text-slate-900' : 'text-slate-800 hover:bg-slate-900/5'
                    }`}
                  >
                    <span className="font-semibold">@{option.name}</span>
                    {option.hint && <span className="text-[10px] text-slate-500">{option.hint}</span>}
                  </button>
                ))}
              </div>
            )}
            {showEmojis && (
              <ChatPicker onEmoji={(emoji) => setInputText((text) => text + emoji)} onClose={() => setShowEmojis(false)} />
            )}
            <input
              type="file"
              multiple
              ref={chatFileInputRef}
              onChange={handleChatFileSelected}
              className="hidden"
            />
            <input
              type="file"
              multiple
              ref={chatImageInputRef}
              onChange={handleChatImageSelected}
              accept="image/*,video/*,audio/*"
              data-testid="chat-media-input"
              className="hidden"
            />
            <div className="relative flex items-center rounded-2xl bg-white border border-slate-900/10 focus-within:border-[#3044f0] transition-colors p-1.5">
              {/* Anexar: foto/GIF abre no chat; arquivo aparece como documento */}
              <div className="relative">
                <button
                  type="button"
                  data-testid="attach-button"
                  aria-expanded={showAttachMenu}
                  onClick={() => {
                    setShowAttachMenu((v) => !v);
                    setShowEmojis(false);
                  }}
                  title="Anexar foto, GIF, vídeo ou arquivo (até 100 MB)"
                  className="p-2 text-slate-500 hover:text-[#3044f0] rounded-xl hover:bg-slate-900/5 transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                {showAttachMenu && (
                  <div className="absolute bottom-11 left-0 z-30 w-60 p-1.5 rounded-xl bg-white border border-slate-900/10 shadow-2xl">
                    <button
                      type="button"
                      data-testid="attach-image"
                      onClick={() => {
                        setShowAttachMenu(false);
                        chatImageInputRef.current?.click();
                      }}
                      className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-900/5 text-left"
                    >
                      <ImageIcon className="w-4 h-4 text-[#3044f0] mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="block text-xs font-bold text-slate-900">Foto, GIF, vídeo ou áudio</span>
                        <span className="block text-[11px] text-slate-500">Você confere antes de enviar</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      data-testid="attach-document"
                      onClick={() => {
                        setShowAttachMenu(false);
                        chatFileInputRef.current?.click();
                      }}
                      className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-900/5 text-left"
                    >
                      <FileText className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="block text-xs font-bold text-slate-900">Arquivo</span>
                        <span className="block text-[11px] text-slate-500">Aparece como documento e vai para Materiais</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <input
                type="text"
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onPaste={handlePaste}
                placeholder="Escreva uma mensagem..."
                className="flex-1 min-w-0 bg-transparent px-2 text-xs md:text-sm text-slate-900 placeholder-slate-500 focus:outline-none"
              />

              {/* Emojis, GIFs e figurinhas */}
              <button
                type="button"
                data-testid="emoji-button"
                aria-expanded={showEmojis}
                onClick={() => {
                  setShowEmojis((v) => !v);
                  setShowAttachMenu(false);
                }}
                title="Emojis, GIFs e figurinhas"
                className={`p-2 rounded-xl transition-colors ${showEmojis ? 'text-[#3044f0] bg-slate-900/10' : 'text-slate-500 hover:text-[#3044f0] hover:bg-slate-900/5'}`}
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Mensagem de voz */}
              <button
                type="button"
                data-testid="voice-button"
                onClick={() => (recordSeconds === null ? startRecording() : stopRecording(true))}
                title={recordSeconds === null ? 'Gravar mensagem de voz' : 'Parar e enviar o áudio'}
                className={`p-2 mr-1 rounded-xl transition-colors ${
                  recordSeconds === null ? 'text-slate-500 hover:text-[#3044f0] hover:bg-slate-900/5' : 'bg-rose-600 text-white'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() && staged.length === 0}
                title={staged.length > 0 ? 'Enviar o que está na pré-visualização' : 'Enviar mensagem'}
                className="p-2 rounded-xl bg-[#3044f0] hover:bg-[#2334c9] text-white disabled:opacity-40 disabled:hover:bg-[#3044f0] transition-all shadow-sm active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MATERIAIS */}
      {activeTab === 'materials' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {matSearchOpen && (
            <SearchBar
              testPrefix="materials-search"
              placeholder="Procurar por nome ou quem enviou..."
              inputLabel="Procurar nos materiais"
              text={matFilter.text}
              from={matFilter.from}
              to={matFilter.to}
              kinds={matFilter.kinds}
              kindOptions={MATERIAL_KINDS.map((kind) => ({ kind, label: MATERIAL_LABELS[kind] }))}
              onText={(text) => setMatFilter((f) => ({ ...f, text }))}
              onFrom={(day) => setMatFilter((f) => ({ ...f, from: day }))}
              onTo={(day) => setMatFilter((f) => ({ ...f, to: day }))}
              onToggleKind={toggleMatKind}
              onClose={closeMatSearch}
              onClear={() => setMatFilter(EMPTY_MATERIAL_FILTER)}
              filtering={matFiltering}
              countText={
                matFiltering
                  ? shownMaterials.length === 0
                    ? 'Nenhum material encontrado com esses filtros.'
                    : shownMaterials.length === 1
                    ? '1 material encontrado'
                    : `${shownMaterials.length} materiais encontrados`
                  : 'Procura pelo nome, por quem enviou, pelo dia e pelo tipo.'
              }
            />
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Top Materials Actions */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/10">
              <div>
                <span className="text-xs font-bold text-slate-900 tracking-wide block">
                  Arquivos da sala
                </span>
                <span className="text-[10px] text-slate-500">
                  {materials.length === 1 ? `${materials.length} item compartilhado` : `${materials.length} itens compartilhados`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => materialsFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#3044f0] hover:bg-[#2334c9] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30"
                  title="Enviar arquivo do computador"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Anexar Arquivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-1.5 rounded-xl bg-white hover:bg-slate-900/10 text-slate-700 border border-slate-900/10 text-xs transition-all"
                  title="Adicionar um link"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {materials.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8 leading-relaxed">
                Nenhum material ainda. Envie um PDF, uma imagem ou um link para a turma.
              </p>
            )}

            {/* Lista de materiais */}
            {shownMaterials.map((mat) => {
              const isPdf = mat.type === 'pdf';
              const isImg = mat.type === 'image';
              const isLnk = mat.type === 'link';

              return (
                <div
                  key={mat.id}
                  className="p-3 rounded-2xl bg-white hover:bg-slate-900/5 border border-slate-900/10 transition-all group flex items-center justify-between gap-3"
                >
                  <div
                    onClick={() => setActiveDocument(mat)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isPdf
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                          : isImg
                          ? 'bg-[#3044f0]/10 text-[#3044f0] border border-[#3044f0]/30'
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                      }`}
                    >
                      {isPdf && <FileText className="w-5 h-5" />}
                      {isImg && <ImageIcon className="w-5 h-5" />}
                      {isLnk && <Link2 className="w-5 h-5" />}
                      {!isPdf && !isImg && !isLnk && <FileText className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 data-testid="material-title" translate="no" className="text-xs font-bold text-slate-800 group-hover:text-[#3044f0] transition-colors truncate">
                        {highlight(mat.title, 0, matTerms)}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 mt-0.5 font-mono">
                        {mat.size && <span>{mat.size}</span>}
                        {mat.pages && <span>• {mat.pages} pág.</span>}
                        <span translate="no">• {highlight(mat.uploadedBy, 0, matTerms)}</span>
                        {mat.ts && <span data-testid="material-date">• {dayLabel(mat.ts)}</span>}
                        {isLnk && materialHost(mat.url) && <span translate="no">• {highlight(materialHost(mat.url), 0, matTerms)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions: View and Download */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveDocument(mat)}
                      title="Visualizar documento"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-900/10 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerDownload(mat)}
                      title="Baixar arquivo para seu computador"
                      className="px-2.5 py-1.5 rounded-xl bg-[#3044f0]/10 hover:bg-[#2334c9] text-[#3044f0] hover:text-white border border-[#3044f0]/30 transition-all flex items-center gap-1 text-[11px] font-bold shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isLnk ? 'Abrir' : 'Baixar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick upload modal for manual links / notes */}
          {showUploadModal && (
            <div className="p-4 bg-white border-t border-slate-900/10 animate-fadeIn">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900">Compartilhar um link</span>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-950"
                >
                  Fechar
                </button>
              </div>

              <form onSubmit={handleAddMaterialSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={newMaterialTitle}
                  onChange={(e) => setNewMaterialTitle(e.target.value)}
                  placeholder="Nome do link (Ex: Videoaula de integrais)"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-900/10 text-xs text-slate-900 placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  value={newMaterialUrl}
                  onChange={(e) => setNewMaterialUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-900/10 text-xs text-slate-900 placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-[#3044f0] hover:bg-[#2334c9] text-white font-bold text-xs shadow-md"
                >
                  Adicionar link à sala
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Bot de música: fica montado em qualquer aba, porque é ele que toca */}
      <MusicPanel active={activeTab === 'music'} onBlocked={setMusicBlocked} resumeRef={musicResumeRef} />
    </div>
  );
}
