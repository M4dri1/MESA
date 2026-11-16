'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { Room, User, ChatMessage, StudyMaterial, SubjectType, ChatAttachment, BoardStroke, RoomRole, Sticker, GifResult, MusicState, MusicSearchItem, Presence, NotifyLevel, Sound } from '@/types';
import {
  playJoinRoomSound,
  playLeaveRoomSound,
  playMuteSound,
  playUnmuteSound,
  playDeafenSound,
  playUndeafenSound,
  playCameraSound,
  playScreenShareSound,
  playMessageSentSound,
  playMessageReceivedSound,
  playSuccessSound,
  playPomodoroChime,
  playPeerJoinSound,
  playViewerJoinSound,
  playViewerLeaveSound,
  playPeerLeaveSound,
  playNotificationSound,
  playErrorSound,
  playKickSound,
  playPunishSound,
  playPardonSound,
  playPromoteSound,
  playDemoteSound,
  playBoardClearSound,
  setSoundEnabled,
} from '@/utils/soundEffects';
import { downloadFile } from '@/utils/fileDownload';
import { api, getStoredToken, storeToken, shrinkAvatar, shrinkBanner } from '@/lib/api';
import { StreamAudio } from '@/components/common/StreamVideo';
import { playClip, preloadClip } from '@/utils/soundpadPlayer';
import { comboFromEvent } from '@/utils/hotkeys';
import { translateString } from '@/lib/i18n';
import { encryptRoomText, decryptRoomText } from '@/utils/e2ee';

export interface AuthResult {
  success: boolean;
  error?: string;
  field?: string;
  /** O servidor mandou um código para o e-mail e espera a confirmação */
  needsVerification?: boolean;
  email?: string;
}

export type ModerationAction = 'kick' | 'punish' | 'pardon' | 'unban' | 'promote' | 'demote';
export type ModerationDuration = number | 'forever';
export type SettingsSection = 'account' | 'appearance' | 'notifications' | 'accessibility' | 'language';

/** Castigo/expulsão ainda vale? (-1 = para sempre) */
export const isActiveUntil = (until?: number | null) =>
  until === -1 || (typeof until === 'number' && until > Date.now());

export function untilLabel(until: number) {
  if (until === -1) return 'para sempre';
  const date = new Date(until);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `até ${time}` : `até ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
}

/** Lousa compartilhada: fica fora do estado do React para o desenho não redesenhar o app inteiro */
export interface BoardApi {
  getStrokes: () => BoardStroke[];
  subscribe: (listener: () => void) => () => void;
  draw: (stroke: Omit<BoardStroke, 'points' | 'userId'>, points: number[], done: boolean) => void;
  undo: () => void;
  clear: (onlyMine: boolean) => void;
}

export interface ScreenShare {
  user: User;
  stream: MediaStream | null;
  isLocal: boolean;
}

/** Quem está em foco na chamada (estilo Discord): a câmera ou a tela de alguém ocupa o palco */
export interface CallFocus {
  id: string;
  kind: 'camera' | 'screen';
}

interface MesaContextType {
  // Navigation & View
  currentRoom: Room | null;
  setCurrentRoomId: (id: string | null) => void;
  previewDevice: 'desktop' | 'mobile';
  setPreviewDevice: (device: 'desktop' | 'mobile') => void;

  callViewMode: 'stage' | 'grid' | 'notes';
  setCallViewMode: (mode: 'stage' | 'grid' | 'notes') => void;
  callFocus: CallFocus | null;
  setCallFocus: (focus: CallFocus | null) => void;
  isChatPanelOpen: boolean;
  setIsChatPanelOpen: (open: boolean) => void;
  toggleChatPanel: () => void;

  // Presence
  activeCallUsers: Record<string, User[]>;
  isConnected: boolean;

  // Authentication & User Profile
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: User;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  signup: (data: {
    fullName: string;
    nickname: string;
    email: string;
    password: string;
    avatarUrl?: string;
  }) => Promise<AuthResult>;
  verifySignup: (email: string, code: string) => Promise<AuthResult>;
  resendSignupCode: (email: string) => Promise<AuthResult>;
  forgotPassword: (identifier: string) => Promise<AuthResult>;
  resetPassword: (identifier: string, code: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updateUserProfile: (data: {
    fullName?: string;
    name: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bannerColor?: string;
    borderColor?: string;
    joinSoundId?: string;
    statusText?: string;
  }) => Promise<AuthResult>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'signup';
  openAuthModal: (mode?: 'login' | 'signup') => void;

  // Study Center Stage Mode
  studyCenterMode: 'screen' | 'notepad' | 'board' | 'pomodoro';
  setStudyCenterMode: (mode: 'screen' | 'notepad' | 'board' | 'pomodoro') => void;

  // Shared Notes
  roomNotes: Record<string, string>;
  updateRoomNotes: (roomId: string, notes: string) => void;

  // Pomodoro (compartilhado com a sala)
  pomodoroSeconds: number;
  isPomodoroRunning: boolean;
  pomodoroMode: 'focus' | 'break';
  togglePomodoro: () => void;
  resetPomodoro: (mode?: 'focus' | 'break') => void;

  // Rooms
  rooms: Room[];
  createRoom: (roomData: {
    name: string;
    subject: SubjectType;
    color: string;
    isPrivate: boolean;
    isHidden?: boolean;
    password?: string;
    iconUrl?: string;
  }) => Promise<Room | null>;
  joinRoomByCode: (code: string, password?: string) => Promise<boolean>;
  deleteRoom: (roomId: string) => void;
  /** Volta para "Minhas salas" perguntando antes se estiver numa chamada */
  requestLeaveRoom: () => void;

  // Call controls
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  audioVolumeLevel: number;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleDeafen: () => void;
  localCameraStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  getPeerStreams: (member: User) => { camera?: MediaStream; screen?: MediaStream };
  screenShare: ScreenShare | null;
  /** Todas as pessoas que estão compartilhando a tela agora (sem você) */
  screenSharers: User[];

  // Chat & Materials
  messages: ChatMessage[];
  /** Mensagens mais antigas que as de `messages` (a sala só entrega as últimas 200 ao entrar); chegam com `loadHistory` */
  olderMessages: ChatMessage[];
  historyStatus: 'idle' | 'loading' | 'done' | 'error';
  /** Busca no servidor todo o histórico da sala (para a busca do chat) */
  loadHistory: () => Promise<void>;
  sendMessage: (content: string) => void;
  materials: StudyMaterial[];
  addMaterial: (material: { title: string; url: string }) => Promise<boolean>;
  /** Imagens abrem direto no chat; com `asDocument` (ou outros tipos) viram cartão de documento */
  uploadRealFile: (file: File, options?: { asDocument?: boolean; voice?: { duration: number }; music?: boolean }) => Promise<void>;
  isUploading: boolean;
  /** 0 a 100 enquanto um envio está em andamento */
  uploadProgress: number;
  downloadStudyMaterial: (mat: StudyMaterial | ChatAttachment | any) => void;

  // Active Document Viewer
  activeDocument: StudyMaterial | null;
  setActiveDocument: (doc: StudyMaterial | null) => void;

  // People & Invites
  friends: Record<string, User>;
  invitedFriends: Record<string, boolean>;
  inviteFriend: (friendId: string) => void;

  // Modals
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  isInviteModalOpen: boolean;
  setIsInviteModalOpen: (open: boolean) => void;
  isJoinCodeModalOpen: boolean;
  setIsJoinCodeModalOpen: (open: boolean) => void;

  // Mobile Tab Navigation inside room
  mobileActiveTab: 'study' | 'chat' | 'materials';
  setMobileActiveTab: (tab: 'study' | 'chat' | 'materials') => void;

  // Sound Effects
  soundEnabled: boolean;
  toggleSoundEffects: () => void;
  testSound: (type: string) => void;

  // Lousa compartilhada
  board: BoardApi;

  // Supressão de ruído do seu microfone
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => Promise<void>;

  // Tela compartilhada: só assiste (e ouve) quem quiser
  watchedScreenId: string | null;
  watchScreen: (userId: string | null) => void;
  /** Quem está assistindo a SUA tela agora (só tem gente enquanto você compartilha) */
  screenViewers: User[];
  /** Configurações da sala: nome, matéria, quem pode entrar, cor e foto (dono e adm) */
  updateRoom: (roomId: string, patch: RoomPatch) => Promise<{ ok: boolean; error?: string }>;
  roomSettingsId: string | null;
  openRoomSettings: (roomId: string) => void;
  closeRoomSettings: () => void;

  // Mensagens: apagar
  deleteMessage: (id: string) => void;

  // Status e notificações
  presence: Presence;
  setPresence: (presence: Presence) => void;
  notifyLevel: NotifyLevel;
  setNotifyLevel: (level: NotifyLevel) => void;
  browserNotify: boolean;
  toggleBrowserNotify: () => Promise<void>;
  /** Mensagens que chegaram enquanto o chat não estava à vista */
  unread: { count: number; mentions: number };
  setChatVisible: (visible: boolean) => void;

  // Volume da música (só meu)
  musicVolume: number;
  setMusicVolume: (volume: number) => void;
  musicMuted: boolean;
  setMusicMuted: (muted: boolean) => void;

  // Soundpad: sons curtos que tocam para a chamada toda
  sounds: Sound[];
  addSound: (file: File, options?: { name?: string; emoji?: string }) => Promise<{ ok: boolean; error?: string; soundId?: string }>;
  updateSound: (id: string, patch: { name?: string; emoji?: string; key?: string }) => Promise<{ ok: boolean; error?: string }>;
  deleteSound: (id: string) => void;
  playSound: (id: string) => void;
  /** Quem acabou de tocar um som (some sozinho em poucos segundos) */
  soundFlash: Record<string, { name: string; emoji: string }>;
  padVolume: number;
  setPadVolume: (volume: number) => void;
  padListen: boolean;
  setPadListen: (listen: boolean) => void;
  padHotkeys: boolean;
  setPadHotkeys: (enabled: boolean) => void;

  // Janela de configurações (seção aberta; null = fechada)
  settingsSection: SettingsSection | null;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;

  // Foto da sala (só dono e adm)
  setRoomIcon: (dataUrl: string) => Promise<boolean>;

  // Bot de música
  music: MusicState;
  musicSummon: () => void;
  musicDismiss: () => void;
  musicAdd: (url: string) => Promise<{ ok: boolean; error?: string }>;
  musicSearch: (query: string) => Promise<{ ok: boolean; items: MusicSearchItem[]; error?: string; needsKey?: boolean }>;
  musicControl: (action: 'pause' | 'resume' | 'skip' | 'remove' | 'playnow', id?: string) => void;
  musicEnded: (songId: string) => void;
  musicFailed: (songId: string) => void;
  /** Mostra um aviso no topo da tela */
  notify: (text: string) => void;

  // GIFs e figurinhas
  searchGifs: (query: string) => Promise<{ ok: boolean; gifs: GifResult[]; error?: string; needsKey?: boolean }>;
  sendGif: (url: string) => void;
  stickers: Sticker[];
  createSticker: (file: File) => Promise<boolean>;
  deleteSticker: (id: string) => void;
  saveSticker: (id: string) => void;
  sendSticker: (id: string) => void;

  // Volume de cada pessoa (só para você) e menu do participante
  peerVolumes: Record<string, number>;
  setPeerVolume: (userId: string, volume: number) => void;
  participantMenuId: string | null;
  participantMenuPos: { x: number; y: number } | null;
  setParticipantMenuId: (userId: string | null) => void;
  /** Abre o cartão de perfil de alguém perto do ponto clicado */
  openParticipantMenu: (userId: string, position?: { x: number; y: number }) => void;

  // Moderação: dono > adm > membro
  myRole: RoomRole;
  myPunishedUntil: number;
  isPunished: boolean;
  moderate: (action: ModerationAction, userId: string, duration?: ModerationDuration) => Promise<boolean>;

  // Avisos (permissão de mídia, erros, convites)
  mediaNotice: string | null;
  clearMediaNotice: () => void;
}

const MesaContext = createContext<MesaContextType | undefined>(undefined);

/** Identificador do cartão do bot de música (ele não é uma pessoa da chamada) */
export const MUSIC_BOT_ID = 'music-bot';

const EMPTY_MUSIC: MusicState = { on: false, queue: [], playing: false, positionMs: 0, seq: 0, receivedAt: 0 };

const GUEST: User = {
  id: '',
  name: '',
  fullName: '',
  avatarLetter: '?',
  avatarColor: '#2563eb',
  status: 'online',
};

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

// Servidores STUN públicos e gratuitos: ajudam dois navegadores a se encontrarem.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** O que dá para mudar numa sala já criada (só dono e adm) */
export interface RoomPatch {
  name?: string;
  subject?: string;
  isPrivate?: boolean;
  isHidden?: boolean;
  password?: string;
  color?: string;
  /** Foto em data URL; "" tira a foto */
  iconUrl?: string;
}

interface PeerState {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  senders: Map<string, RTCRtpSender>;
  queue: Promise<void>;
}

interface PomodoroState {
  mode: 'focus' | 'break';
  running: boolean;
  remainingMs: number;
  endsAt: number | null;
}

function gradientForColor(color: string) {
  if (color.includes('emerald') || color.includes('10b981') || color === '#059669') {
    return 'from-emerald-600 via-teal-700 to-emerald-950';
  }
  if (color.includes('pink') || color === '#db2777' || color === '#ec4899') {
    return 'from-pink-600 via-rose-700 to-rose-950';
  }
  if (color.includes('purple') || color === '#7c3aed' || color === '#8b5cf6') {
    return 'from-purple-600 via-indigo-700 to-purple-950';
  }
  if (color.includes('amber') || color === '#d97706' || color === '#f59e0b') {
    return 'from-amber-600 via-yellow-700 to-amber-950';
  }
  if (color.includes('cyan') || color === '#0891b2' || color === '#06b6d4') {
    return 'from-cyan-600 via-teal-700 to-slate-900';
  }
  return 'from-blue-600 via-blue-700 to-indigo-900';
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function MesaProvider({ children }: { children: ReactNode }) {
  /* ---------------- Estado ---------------- */
  const [authStatus, setAuthStatus] = useState<'loading' | 'in' | 'out'>('loading');
  const [currentUser, setCurrentUser] = useState<User>(GUEST);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

  const [isConnected, setIsConnected] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Record<string, User>>({});
  const [currentRoomId, setCurrentRoomIdState] = useState<string | null>(null);
  const [enteredRoom, setEnteredRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [accessPrompt, setAccessPrompt] = useState<{
    roomId?: string;
    roomName: string;
    code?: string;
    needsPassword?: boolean;
    needsCode?: boolean;
    error?: string;
  } | null>(null);
  const [accessInput, setAccessInput] = useState('');
  const [accessBusy, setAccessBusy] = useState(false);
  const [switchPrompt, setSwitchPrompt] = useState<{ roomId: string | null; roomName: string; fromName: string } | null>(null);

  const [allMessages, setAllMessages] = useState<Record<string, ChatMessage[]>>({});
  const [olderMessages, setOlderMessages] = useState<Record<string, ChatMessage[]>>({});
  const [historyStatus, setHistoryStatus] = useState<Record<string, 'loading' | 'done' | 'error'>>({});
  const historyBusyRef = useRef(false);
  const deletedWhileLoadingRef = useRef<Set<string>>(new Set());
  const [allMaterials, setAllMaterials] = useState<Record<string, StudyMaterial[]>>({});
  const [roomNotes, setRoomNotes] = useState<Record<string, string>>({});
  const [activeDocument, setActiveDocument] = useState<StudyMaterial | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [invitedFriends, setInvitedFriends] = useState<Record<string, boolean>>({});

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [callViewMode, setCallViewMode] = useState<'stage' | 'grid' | 'notes'>('stage');
  const [callFocus, setCallFocus] = useState<CallFocus | null>(null);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  const [studyCenterMode, setStudyCenterMode] = useState<'screen' | 'notepad' | 'board' | 'pomodoro'>('screen');
  const [mobileActiveTab, setMobileActiveTab] = useState<'study' | 'chat' | 'materials'>('study');

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioVolumeLevel, setAudioVolumeLevel] = useState(0);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream[]>>({});
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [myPunishedUntil, setMyPunishedUntil] = useState(0);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [music, setMusic] = useState<MusicState>(EMPTY_MUSIC);
  const [unread, setUnread] = useState({ count: 0, mentions: 0 });
  const chatVisibleRef = useRef(false);
  const [browserNotify, setBrowserNotify] = useState(() => {
    try {
      return localStorage.getItem('mesa_browser_notify') === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    } catch {
      return false;
    }
  });
  const [musicVolume, setMusicVolumeState] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem('mesa_music_volume') || '');
      return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.7;
    } catch {
      return 0.7;
    }
  });
  const [musicMuted, setMusicMuted] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const openSettings = (section: SettingsSection = 'appearance') => setSettingsSection(section);
  const closeSettings = () => setSettingsSection(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [soundFlash, setSoundFlash] = useState<Record<string, { name: string; emoji: string }>>({});
  const flashTimersRef = useRef(new Map<string, number>());
  const [padVolume, setPadVolumeState] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem('mesa_pad_volume') || '');
      return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [padListen, setPadListenState] = useState(() => {
    try {
      return localStorage.getItem('mesa_pad_listen') !== '0';
    } catch {
      return true;
    }
  });
  const [padHotkeys, setPadHotkeysState] = useState(() => {
    try {
      return localStorage.getItem('mesa_pad_hotkeys') !== '0';
    } catch {
      return true;
    }
  });
  // Valores mais recentes para o atalho de teclado, que é registrado uma vez só
  const padRef = useRef<{ sounds: Sound[]; hotkeys: boolean; inRoom: boolean; play: (id: string) => void }>({
    sounds: [],
    hotkeys: true,
    inRoom: false,
    play: () => {},
  });
  const [watchedScreenId, setWatchedScreenId] = useState<string | null>(null);
  const [screenViewers, setScreenViewers] = useState<User[]>([]);
  const screenViewersRef = useRef<User[]>([]);
  const [roomSettingsId, setRoomSettingsId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [participantMenuId, setParticipantMenuId] = useState<string | null>(null);
  const [participantMenuPos, setParticipantMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mesa_volumes') || '{}');
    } catch {
      return {};
    }
  });

  const [pomo, setPomo] = useState<PomodoroState>({ mode: 'focus', running: false, remainingMs: FOCUS_MS, endsAt: null });
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [soundActive, setSoundActive] = useState(true);

  /* ---------------- Referências (valores usados dentro de callbacks) ---------------- */
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<User>(GUEST);
  const roomIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<{ timer: number | null; attempts: number }>({ timer: null, attempts: 0 });
  const pendingRef = useRef(new Map<number, (reply: any) => void>());
  const reqIdRef = useRef(1);
  const handlerRef = useRef<(msg: any) => void>(() => {});
  const pendingCodeRef = useRef<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const notesTimerRef = useRef<number | null>(null);

  const peersRef = useRef(new Map<string, PeerState>());
  const localRef = useRef<{ mic: MediaStream | null; cam: MediaStream | null; screen: MediaStream | null }>({
    mic: null,
    cam: null,
    screen: null,
  });
  const mediaRef = useRef({ isMicOn: false, isCameraOn: false, isSharingScreen: false });
  const analyserRef = useRef<{ ctx: AudioContext; timer: number } | null>(null);
  const punishedRef = useRef(false);
  // Microfone "cru" do aparelho; localRef.mic guarda o que realmente é enviado (já sem ruído)
  const rawMicRef = useRef<MediaStream | null>(null);
  const noiseRef = useRef<{ ctx: AudioContext; node: AudioWorkletNode & { destroy?: () => void } } | null>(null);
  const noiseWantedRef = useRef(true);
  const micStartingRef = useRef(false);
  const boardRef = useRef<{ strokes: BoardStroke[]; listeners: Set<() => void> }>({ strokes: [], listeners: new Set() });

  userRef.current = currentUser;

  /* ---------------- Avisos ---------------- */
  const showNotice = (text: string) => {
    setMediaNotice(text);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setMediaNotice(null), 7000);
  };
  const clearMediaNotice = () => setMediaNotice(null);

  /* ---------------- WebSocket ---------------- */
  const wsSend = (payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  /** Logo depois de abrir a página (ou numa internet lenta) a conexão ainda pode estar abrindo: espera um pouco em vez de desistir */
  const waitForSocket = (timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      const started = Date.now();
      const check = () => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) return resolve(true);
        if (Date.now() - started >= timeoutMs) return resolve(false);
        window.setTimeout(check, 100);
      };
      check();
    });

  const request = async (type: string, payload: Record<string, unknown> = {}): Promise<any> => {
    const reqId = reqIdRef.current++;
    const offline = { ok: false, error: 'Sem conexão com o servidor. Tente de novo em instantes.' };
    if (!(await waitForSocket(6000))) return offline;
    return new Promise((resolve) => {
      if (!wsSend({ type, reqId, ...payload })) return resolve(offline);
      const timer = window.setTimeout(() => {
        pendingRef.current.delete(reqId);
        resolve(offline);
      }, 10000);
      pendingRef.current.set(reqId, (reply) => {
        window.clearTimeout(timer);
        resolve(reply);
      });
    });
  };

  /* ---------------- Lousa ---------------- */
  const notifyBoard = () => boardRef.current.listeners.forEach((listener) => listener());

  const applyBoardDraw = (info: Omit<BoardStroke, 'points'>, points: number[]) => {
    const list = boardRef.current.strokes;
    let stroke: BoardStroke | undefined;
    for (let i = list.length - 1; i >= 0 && !stroke; i--) if (list[i].id === info.id) stroke = list[i];
    if (!stroke) {
      stroke = { ...info, points: [] };
      list.push(stroke);
    }
    if (stroke.tool === 'pen' || stroke.tool === 'eraser') stroke.points.push(...points);
    else stroke.points = points.slice(0, 4);
    notifyBoard();
  };

  const setBoardStrokes = (strokes: BoardStroke[]) => {
    boardRef.current.strokes = strokes;
    notifyBoard();
  };

  const board = useMemo<BoardApi>(
    () => ({
      getStrokes: () => boardRef.current.strokes,
      subscribe: (listener) => {
        boardRef.current.listeners.add(listener);
        return () => {
          boardRef.current.listeners.delete(listener);
        };
      },
      draw: (stroke, points, done) => {
        applyBoardDraw({ ...stroke, userId: userRef.current.id }, points);
        wsSend({ type: 'board:draw', stroke, points, done });
      },
      undo: () => wsSend({ type: 'board:undo' }),
      clear: (onlyMine) => {
        wsSend({ type: 'board:clear', mine: onlyMine });
        playBoardClearSound();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ---------------- Chamada: conexões entre participantes (WebRTC) ---------------- */
  const localTracks = () => {
    const list: { key: string; track: MediaStreamTrack; stream: MediaStream }[] = [];
    const { mic, cam, screen } = localRef.current;
    if (mic?.getAudioTracks()[0]) list.push({ key: 'mic', track: mic.getAudioTracks()[0], stream: mic });
    if (cam?.getVideoTracks()[0]) list.push({ key: 'cam', track: cam.getVideoTracks()[0], stream: cam });
    if (screen?.getVideoTracks()[0]) list.push({ key: 'screen', track: screen.getVideoTracks()[0], stream: screen });
    if (screen?.getAudioTracks()[0]) list.push({ key: 'screenAudio', track: screen.getAudioTracks()[0], stream: screen });
    return list;
  };

  const registerRemoteStream = (peerId: string, stream: MediaStream) => {
    const refresh = () =>
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: (prev[peerId] || []).filter((s) => s.getTracks().length > 0),
      }));
    stream.onremovetrack = refresh;
    stream.onaddtrack = refresh;
    setRemoteStreams((prev) => {
      const list = prev[peerId] || [];
      return { ...prev, [peerId]: list.includes(stream) ? [...list] : [...list, stream] };
    });
  };

  const ensurePeer = (peerId: string): PeerState => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const state: PeerState = {
      pc,
      polite: userRef.current.id < peerId,
      makingOffer: false,
      ignoreOffer: false,
      senders: new Map(),
      queue: Promise.resolve(),
    };
    peersRef.current.set(peerId, state);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) wsSend({ type: 'signal', to: peerId, data: { candidate } });
    };
    pc.onnegotiationneeded = async () => {
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        wsSend({ type: 'signal', to: peerId, data: { description: pc.localDescription } });
      } catch (err) {
        console.warn('Falha ao negociar a chamada', err);
      } finally {
        state.makingOffer = false;
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) registerRemoteStream(peerId, stream);
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce();
    };

    for (const { key, track, stream } of localTracks()) {
      state.senders.set(key, pc.addTrack(track, stream));
    }
    return state;
  };

  const closePeer = (peerId: string) => {
    const state = peersRef.current.get(peerId);
    if (state) {
      state.pc.onicecandidate = null;
      state.pc.onnegotiationneeded = null;
      state.pc.ontrack = null;
      state.pc.close();
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const teardownPeers = () => {
    for (const peerId of Array.from(peersRef.current.keys())) closePeer(peerId);
    setRemoteStreams({});
  };

  const handleSignal = (from: string, data: any) => {
    if (!roomIdRef.current || !data) return;
    const state = ensurePeer(from);
    const { pc } = state;
    state.queue = state.queue
      .then(async () => {
        if (data.description) {
          const description = data.description as RTCSessionDescriptionInit;
          const collision = description.type === 'offer' && (state.makingOffer || pc.signalingState !== 'stable');
          state.ignoreOffer = !state.polite && collision;
          if (state.ignoreOffer) return;
          await pc.setRemoteDescription(description);
          if (description.type === 'offer') {
            await pc.setLocalDescription();
            wsSend({ type: 'signal', to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!state.ignoreOffer) throw err;
          }
        }
      })
      .catch((err) => console.warn('Falha na sinalização da chamada', err));
  };

  const addTrackToPeers = (key: string, track: MediaStreamTrack, stream: MediaStream) => {
    peersRef.current.forEach((state) => {
      state.senders.set(key, state.pc.addTrack(track, stream));
    });
  };

  const removeTrackFromPeers = (key: string) => {
    peersRef.current.forEach((state) => {
      const sender = state.senders.get(key);
      if (sender) {
        try {
          state.pc.removeTrack(sender);
        } catch {}
        state.senders.delete(key);
      }
    });
  };

  /* ---------------- Chamada: microfone, câmera e tela ---------------- */
  const sendMedia = () => {
    const { mic, cam, screen } = localRef.current;
    wsSend({
      type: 'media',
      media: {
        ...mediaRef.current,
        micStreamId: mic?.id || null,
        camStreamId: cam?.id || null,
        screenStreamId: screen?.id || null,
      },
    });
  };

  const setMedia = (patch: Partial<typeof mediaRef.current>) => {
    mediaRef.current = { ...mediaRef.current, ...patch };
    setIsMicOn(mediaRef.current.isMicOn);
    setIsCameraOn(mediaRef.current.isCameraOn);
    setIsScreenSharing(mediaRef.current.isSharingScreen);
    sendMedia();
  };

  const stopAnalyser = () => {
    if (analyserRef.current) {
      window.clearInterval(analyserRef.current.timer);
      analyserRef.current.ctx.close().catch(() => {});
      analyserRef.current = null;
    }
    setAudioVolumeLevel(0);
  };

  const startAnalyser = (stream: MediaStream) => {
    stopAnalyser();
    const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;
    let lastLoud = 0;
    let lastLevel = 0;

    const timer = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = mediaRef.current.isMicOn ? Math.min(100, Math.round((sum / data.length / 128) * 100)) : 0;
      if (Math.abs(level - lastLevel) >= 4 || (level === 0 && lastLevel !== 0)) {
        lastLevel = level;
        setAudioVolumeLevel(level);
      }
      const now = Date.now();
      if (level > 15) lastLoud = now;
      const nowSpeaking = lastLoud > 0 && now - lastLoud < 500 && mediaRef.current.isMicOn;
      if (nowSpeaking !== speaking) {
        speaking = nowSpeaking;
        wsSend({ type: 'speaking', isSpeaking: speaking });
      }
    }, 100);
    analyserRef.current = { ctx, timer };
  };

  const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

  const stopLocalMedia = () => {
    stopAnalyser();
    stopStream(rawMicRef.current);
    rawMicRef.current = null;
    teardownNoise();
    stopStream(localRef.current.mic);
    stopStream(localRef.current.cam);
    stopStream(localRef.current.screen);
    localRef.current = { mic: null, cam: null, screen: null };
    mediaRef.current = { isMicOn: false, isCameraOn: false, isSharingScreen: false };
    setIsMicOn(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setLocalCameraStream(null);
    setLocalScreenStream(null);
  };

  const punishedNotice = () => {
    showNotice('Você está de castigo nesta sala: microfone, câmera, tela e chat ficam bloqueados até acabar.');
    playErrorSound();
  };

  /** Desliga na hora o que a pessoa castigada estava transmitindo */
  const enforcePunishment = () => {
    localRef.current.mic?.getAudioTracks().forEach((t) => (t.enabled = false));
    rawMicRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    if (localRef.current.cam) {
      removeTrackFromPeers('cam');
      stopStream(localRef.current.cam);
      localRef.current.cam = null;
      setLocalCameraStream(null);
    }
    if (localRef.current.screen) {
      removeTrackFromPeers('screen');
      removeTrackFromPeers('screenAudio');
      stopStream(localRef.current.screen);
      localRef.current.screen = null;
      setLocalScreenStream(null);
    }
    setMedia({ isMicOn: false, isCameraOn: false, isSharingScreen: false });
  };

  const teardownNoise = () => {
    const noise = noiseRef.current;
    noiseRef.current = null;
    if (!noise) return;
    try {
      noise.node.destroy?.();
    } catch {}
    noise.ctx.close().catch(() => {});
  };

  /**
   * Passa o microfone pelo RNNoise (rede neural que separa voz de ruído: teclado, ventilador, fundo).
   * Se o navegador não suportar ou algo falhar, devolve o áudio original para a chamada não ficar muda.
   */
  const processMicTrack = async (raw: MediaStream): Promise<MediaStreamTrack> => {
    teardownNoise();
    const rawTrack = raw.getAudioTracks()[0];
    if (!noiseWantedRef.current) return rawTrack;
    try {
      const { RnnoiseWorkletNode, loadRnnoise } = await import('@sapphi-red/web-noise-suppressor');
      const ctx = new AudioContext({ sampleRate: 48000 }); // o RNNoise só trabalha em 48 kHz
      const [wasmBinary] = await Promise.all([
        loadRnnoise({ url: '/api/noise/rnnoise.wasm', simdUrl: '/api/noise/rnnoise_simd.wasm' }),
        ctx.audioWorklet.addModule('/api/noise/rnnoiseWorklet.js'),
      ]);
      const node = new RnnoiseWorkletNode(ctx, { wasmBinary, maxChannels: 1 });
      const destination = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(raw).connect(node);
      node.connect(destination);
      await ctx.resume().catch(() => {});
      noiseRef.current = { ctx, node };
      return destination.stream.getAudioTracks()[0];
    } catch (err) {
      console.warn('Supressão de ruído indisponível; usando o microfone direto', err);
      teardownNoise();
      return rawTrack;
    }
  };

  const startMic = async (silent = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showNotice('Este navegador não liberou o microfone. Abra o Mesa por um endereço https.');
      return;
    }
    if (micStartingRef.current || localRef.current.mic) return;
    micStartingRef.current = true;
    try {
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const track = await processMicTrack(raw);
      if (!roomIdRef.current || localRef.current.mic || punishedRef.current) {
        stopStream(raw);
        teardownNoise();
        return;
      }
      rawMicRef.current = raw;
      const stream = new MediaStream([track]);
      localRef.current.mic = stream;
      addTrackToPeers('mic', track, stream);
      startAnalyser(stream);
      setMedia({ isMicOn: true });
      if (!silent) playUnmuteSound();
    } catch {
      showNotice('Não foi possível usar o microfone. Libere a permissão no navegador e clique em Microfone.');
    } finally {
      micStartingRef.current = false;
    }
  };

  /** Liga/desliga a supressão de ruído trocando a faixa de áudio sem derrubar a chamada */
  const toggleNoiseSuppression = async () => {
    const next = !noiseWantedRef.current;
    noiseWantedRef.current = next;
    setNoiseSuppression(next);
    try {
      localStorage.setItem('mesa_noise', next ? '1' : '0');
    } catch {}

    const raw = rawMicRef.current;
    const stream = localRef.current.mic;
    if (raw && stream) {
      const oldTrack = stream.getAudioTracks()[0];
      const newTrack = await processMicTrack(raw);
      newTrack.enabled = mediaRef.current.isMicOn;
      if (oldTrack && oldTrack !== newTrack) {
        stream.removeTrack(oldTrack);
        stream.addTrack(newTrack);
        peersRef.current.forEach((state) => {
          state.senders.get('mic')?.replaceTrack(newTrack).catch(() => {});
        });
        if (oldTrack !== raw.getAudioTracks()[0]) oldTrack.stop();
        startAnalyser(stream);
      }
    }
    if (next) playUnmuteSound();
    else playMuteSound();
    showNotice(next ? 'Supressão de ruído ligada: teclado, ventilador e barulho de fundo são filtrados.' : 'Supressão de ruído desligada: seu microfone vai sem filtro extra.');
  };

  const toggleMic = async () => {
    if (!roomIdRef.current) return;
    if (punishedRef.current) return punishedNotice();
    const mic = localRef.current.mic;
    if (!mic) return startMic();
    const enable = !mediaRef.current.isMicOn;
    mic.getAudioTracks().forEach((t) => (t.enabled = enable));
    rawMicRef.current?.getAudioTracks().forEach((t) => (t.enabled = enable));
    setMedia({ isMicOn: enable });
    if (enable) playUnmuteSound();
    else playMuteSound();
  };

  const toggleCamera = async () => {
    if (!roomIdRef.current) return;
    if (punishedRef.current) return punishedNotice();
    if (localRef.current.cam) {
      removeTrackFromPeers('cam');
      stopStream(localRef.current.cam);
      localRef.current.cam = null;
      setLocalCameraStream(null);
      setMedia({ isCameraOn: false });
      playCameraSound(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showNotice('Este navegador não liberou a câmera. Abra o Mesa por um endereço https.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Resolução baixa de propósito: numa sala cheia cada pessoa envia o vídeo para todas as outras
        video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 }, facingMode: 'user' },
        audio: false,
      });
      if (!roomIdRef.current || localRef.current.cam) {
        stopStream(stream);
        return;
      }
      localRef.current.cam = stream;
      addTrackToPeers('cam', stream.getVideoTracks()[0], stream);
      setLocalCameraStream(stream);
      setMedia({ isCameraOn: true });
      playCameraSound(true);
    } catch {
      showNotice('Não foi possível usar a câmera. Libere a permissão no navegador e tente de novo.');
    }
  };

  const stopScreenShare = () => {
    if (!localRef.current.screen) return;
    removeTrackFromPeers('screen');
    removeTrackFromPeers('screenAudio');
    stopStream(localRef.current.screen);
    localRef.current.screen = null;
    setLocalScreenStream(null);
    setMedia({ isSharingScreen: false });
    playScreenShareSound(false);
  };

  const toggleScreenShare = async () => {
    if (!roomIdRef.current) return;
    if (punishedRef.current) return punishedNotice();
    if (localRef.current.screen) return stopScreenShare();
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showNotice('Este navegador não permite compartilhar a tela (no celular isso é comum).');
      return;
    }
    try {
      // Pede também o som da guia/tela. Sem filtros de voz, senão música e vídeo saem abafados.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        systemAudio: 'include',
      } as DisplayMediaStreamOptions);
      if (!roomIdRef.current || localRef.current.screen) {
        stopStream(stream);
        return;
      }
      localRef.current.screen = stream;
      const track = stream.getVideoTracks()[0];
      track.onended = () => stopScreenShare();
      addTrackToPeers('screen', track, stream);
      const screenAudio = stream.getAudioTracks()[0];
      if (screenAudio) addTrackToPeers('screenAudio', screenAudio, stream);
      else showNotice('Tela compartilhada SEM som. Para enviar o som, compartilhe uma guia ou a tela inteira e marque "Compartilhar áudio".');
      setLocalScreenStream(stream);
      setStudyCenterMode('screen');
      setMedia({ isSharingScreen: true });
      playScreenShareSound(true);
    } catch {
      // A pessoa fechou a janela de escolha da tela: nada a fazer.
    }
  };

  const toggleDeafen = () => {
    setIsDeafened((prev) => {
      if (prev) playUndeafenSound();
      else playDeafenSound();
      return !prev;
    });
  };

  /* ---------------- Salas ---------------- */
  const roomKeysRef = useRef<Map<string, string>>(new Map());

  const mapMessage = (m: any): ChatMessage => {
    const secret = roomKeysRef.current.get(m.roomId);
    const content = m.senderId === 'system' ? m.content : decryptRoomText(m.roomId, secret, m.content || '');
    return {
      ...m,
      content,
      timestamp: formatTime(m.ts || Date.now()),
      isMe: m.senderId === userRef.current.id,
    };
  };
  const mapMaterial = (m: any): StudyMaterial => ({
    ...m,
    uploadedAt: new Date(m.ts || Date.now()).toLocaleDateString('pt-BR'),
  });

  const applyPomodoro = (p: { mode: 'focus' | 'break'; running: boolean; remainingMs: number }) => {
    setNowTick(Date.now());
    setPomo({
      mode: p.mode,
      running: p.running,
      remainingMs: p.remainingMs,
      endsAt: p.running ? Date.now() + p.remainingMs : null,
    });
  };

  const setRoomUrl = (code: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (code) url.searchParams.set('room', code);
      else url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  /** Limpa tudo o que é da sala atual neste navegador (sem avisar o servidor). */
  const resetRoomLocally = () => {
    teardownPeers();
    stopLocalMedia();
    roomIdRef.current = null;
    setCurrentRoomIdState(null);
    setEnteredRoom(null);
    setParticipants([]);
    setActiveDocument(null);
    setRoomUrl(null);
    setParticipantMenuId(null);
    setWatchedScreenId(null);
    setCallFocus(null);
    screenViewersRef.current = [];
    setScreenViewers([]);
    setRoomSettingsId(null);
    setMyPunishedUntil(0);
    punishedRef.current = false;
    setBoardStrokes([]);
    setMusic(EMPTY_MUSIC);
    setUnread({ count: 0, mentions: 0 });
  };

  const enterRoom = async (roomId: string, rejoin = false, access?: { password?: string; code?: string }): Promise<boolean> => {
    if (!rejoin && roomIdRef.current && roomIdRef.current !== roomId) {
      teardownPeers();
      stopLocalMedia();
    }
    const res = await request('room:enter', { roomId, ...(access || {}) });
    if (!res.ok) {
      if (rejoin) resetRoomLocally();
      if (!rejoin && (res.needsPassword || res.needsCode)) {
        setAccessPrompt({
          roomId,
          roomName: res.roomName || 'Sala privada',
          needsPassword: !!res.needsPassword,
          needsCode: !!res.needsCode,
          error: access?.password || access?.code ? res.error : undefined,
        });
        return false;
      }
      showNotice(res.error || 'Não foi possível entrar na sala.');
      return false;
    }
    setAccessPrompt(null);
    setAccessInput('');

    teardownPeers();
    roomIdRef.current = roomId;
    if (res.room?.e2eKey) roomKeysRef.current.set(roomId, res.room.e2eKey);
    setCurrentRoomIdState(roomId);
    setEnteredRoom(res.room);
    setParticipants(res.participants || []);
    setWatchedScreenId(null);
    setCallFocus(null);
    screenViewersRef.current = [];
    setScreenViewers([]);
    setAllMessages((prev) => ({ ...prev, [roomId]: (res.messages || []).map(mapMessage) }));
    setOlderMessages((prev) => ({ ...prev, [roomId]: [] }));
    setHistoryStatus((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setAllMaterials((prev) => ({ ...prev, [roomId]: (res.materials || []).map(mapMaterial) }));
    setRoomNotes((prev) => ({ ...prev, [roomId]: decryptRoomText(roomId, res.room?.e2eKey, res.notes || '') }));
    setBoardStrokes(res.board || []);
    setMyPunishedUntil(res.room.myPunishedUntil || 0);
    punishedRef.current = isActiveUntil(res.room.myPunishedUntil);
    applyPomodoro(res.pomodoro);
    applyMusic(res.music);
    setRoomUrl(res.room.code);

    for (const peer of res.participants || []) ensurePeer(peer.id);
    sendMedia();

    if (!rejoin) {
      playJoinRoomSound();
      if (res.joinSound && res.joinSound.url) {
        const jid = userRef.current.id;
        setSoundFlash((prev) => ({ ...prev, [jid]: { name: res.joinSound.name, emoji: res.joinSound.emoji } }));
        window.setTimeout(() => {
          setSoundFlash((prev) => {
            const next = { ...prev };
            delete next[jid];
            return next;
          });
        }, 2500);
        if (padListen && !isDeafened) {
          void playClip(res.joinSound.url, padVolume, 5);
        }
      }
      setStudyCenterMode('screen');
      if (!punishedRef.current) void startMic(true);
    }
    return true;
  };

  const leaveRoom = () => {
    if (!roomIdRef.current) return;
    wsSend({ type: 'room:leave' });
    resetRoomLocally();
    playLeaveRoomSound();
  };

  /** Volta para "Minhas salas": se estiver numa chamada, pergunta antes de sair */
  const requestLeaveRoom = () => {
    if (!roomIdRef.current) return;
    setSwitchPrompt({ roomId: null, roomName: '', fromName: enteredRoom?.name || 'a sala atual' });
  };

  const setCurrentRoomId = (id: string | null) => {
    if (id === roomIdRef.current) return;
    if (!id) {
      leaveRoom();
      return;
    }
    if (roomIdRef.current && id !== roomIdRef.current) {
      const target = rooms.find((r) => r.id === id);
      setSwitchPrompt({
        roomId: id,
        roomName: target?.name || 'outra sala',
        fromName: enteredRoom?.name || 'a sala atual',
      });
      return;
    }
    void enterRoom(id);
  };

  const createRoom = async (data: {
    name: string;
    subject: SubjectType;
    color: string;
    isPrivate: boolean;
    isHidden?: boolean;
    password?: string;
    iconUrl?: string;
  }) => {
    const res = await request('room:create', { ...data, gradient: gradientForColor(data.color) });
    if (!res.ok) {
      showNotice(res.error || 'Não foi possível criar a sala.');
      return null;
    }
    playSuccessSound();
    return res.room as Room;
  };

  const joinRoomByCode = async (code: string, password?: string): Promise<boolean> => {
    const res = await request('room:join', { code, ...(password ? { password } : {}) });
    if (!res.ok) {
      if (res.needsPassword) {
        setAccessPrompt({
          roomId: res.roomId,
          roomName: res.roomName || 'Sala privada',
          code,
          needsPassword: true,
          error: password ? res.error : undefined,
        });
      }
      return false;
    }
    setAccessPrompt(null);
    setAccessInput('');
    return enterRoom(res.room.id, false, password ? { password } : undefined);
  };

  const deleteRoom = (roomId: string) => {
    void request('room:delete', { roomId }).then((res) => {
      if (res.ok) playSuccessSound();
      else showNotice(res.error || 'Não foi possível excluir a sala.');
    });
  };

  /* ---------------- Chat, materiais, anotações ---------------- */
  const sendMessage = (content: string) => {
    const roomId = roomIdRef.current;
    if (!roomId || !content.trim()) return;
    if (punishedRef.current) return punishedNotice();
    const trimmed = content.trim();
    const byNick = new Map<string, string>();
    participants.forEach((p) => byNick.set(p.name.trim().normalize('NFKC').toLowerCase(), p.id));
    Object.values(friends).forEach((f) => byNick.set(f.name.trim().normalize('NFKC').toLowerCase(), f.id));
    const mentions = new Set<string>();
    let mentionAll = false;
    const re = /@([^\s@]{2,20})/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(trimmed))) {
      let candidate = match[1].trim().normalize('NFKC').toLowerCase();
      if (candidate === 'todos' || candidate === 'everyone') {
        mentionAll = true;
        continue;
      }
      while (candidate.length >= 3) {
        if (byNick.has(candidate)) {
          mentions.add(byNick.get(candidate)!);
          break;
        }
        const stripped = candidate.replace(/[._-]+$/, '');
        if (stripped === candidate) break;
        candidate = stripped;
      }
    }
    mentions.delete(userRef.current.id);
    const encrypted = encryptRoomText(roomId, roomKeysRef.current.get(roomId), trimmed);
    if (wsSend({ type: 'chat:send', content: encrypted, mentions: Array.from(mentions), mentionAll })) playMessageSentSound();
    else showNotice('Sem conexão com o servidor. A mensagem não foi enviada.');
  };

  const addMaterial = async (material: { title: string; url: string }) => {
    const res = await request('material:add', material);
    if (!res.ok) showNotice(res.error || 'Não foi possível adicionar o link.');
    return !!res.ok;
  };

  const uploadRealFile = (file: File, options: { asDocument?: boolean; voice?: { duration: number }; music?: boolean } = {}) =>
    new Promise<void>((resolve) => {
      const roomId = roomIdRef.current;
      if (!roomId) return resolve();
      if (punishedRef.current) {
        punishedNotice();
        return resolve();
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        showNotice('Arquivo grande demais: o limite é de 100 MB.');
        playErrorSound();
        return resolve();
      }

      // XMLHttpRequest em vez de fetch para conseguir mostrar o progresso do envio
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${tokenRef.current}`);
      xhr.setRequestHeader('x-room-id', roomId);
      xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name || 'imagem.png'));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      if (options.asDocument) xhr.setRequestHeader('x-as-document', '1');
      if (options.music) xhr.setRequestHeader('x-kind', 'music');
      if (options.voice) {
        xhr.setRequestHeader('x-kind', 'voice');
        xhr.setRequestHeader('x-duration', String(Math.round(options.voice.duration)));
      }

      const finish = (error?: string) => {
        setIsUploading(false);
        setUploadProgress(0);
        if (error) {
          showNotice(error);
          playErrorSound();
        } else {
          playSuccessSound();
        }
        resolve();
      };

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return finish();
        let message = xhr.status === 413 ? 'Arquivo grande demais: o limite é de 100 MB.' : 'Não foi possível enviar o arquivo.';
        try {
          message = JSON.parse(xhr.responseText).error || message;
        } catch {}
        finish(message);
      };
      xhr.onerror = () => finish('Não foi possível enviar o arquivo. Verifique sua conexão.');

      setUploadProgress(0);
      setIsUploading(true);
      xhr.send(file);
    });

  const downloadStudyMaterial = (mat: any) => {
    if (!mat?.url) return;
    if (mat.type === 'link') {
      window.open(mat.url, '_blank', 'noopener,noreferrer');
      return;
    }
    downloadFile(mat.url, mat.title || mat.name || 'arquivo');
  };

  const updateRoomNotes = (roomId: string, notes: string) => {
    setRoomNotes((prev) => ({ ...prev, [roomId]: notes }));
    if (roomId !== roomIdRef.current) return;
    if (notesTimerRef.current) window.clearTimeout(notesTimerRef.current);
    const encrypted = encryptRoomText(roomId, roomKeysRef.current.get(roomId), notes);
    notesTimerRef.current = window.setTimeout(() => wsSend({ type: 'notes:update', text: encrypted }), 300);
  };

  const inviteFriend = (friendId: string) => {
    const roomId = roomIdRef.current;
    if (!roomId) return;
    void request('invite', { roomId, userId: friendId }).then((res) => {
      if (!res.ok) return showNotice(res.error || 'Não foi possível convidar.');
      playSuccessSound();
      setInvitedFriends((prev) => ({ ...prev, [`${roomId}:${friendId}`]: true }));
    });
  };

  /* ---------------- Notificações, status e mensagens ---------------- */
  const setMusicVolume = (volume: number) => {
    const clamped = Math.min(1, Math.max(0, volume));
    setMusicVolumeState(clamped);
    try {
      localStorage.setItem('mesa_music_volume', String(clamped));
    } catch {}
  };

  /** Este aviso deve tocar/aparecer para mim? Depende do status e do nível de notificação. */
  const shouldAlert = (mentioned: boolean) => {
    const me = userRef.current;
    if ((me.presence || 'online') === 'ocupado') return false;
    const level = me.notify || 'all';
    return level === 'all' || (level === 'mentions' && mentioned);
  };

  /** Aviso do navegador (canto da tela): só quando a aba está em segundo plano */
  const browserAlert = (title: string, body: string) => {
    if (!browserNotify || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    try {
      new Notification(title, { body: body.slice(0, 140), tag: 'mesa-chat' });
    } catch {}
  };

  const saveSettings = (patch: { presence?: Presence; notify?: NotifyLevel }) => {
    setCurrentUser((prev) => ({ ...prev, ...patch }));
    void request('presence:set', patch).then((res) => {
      if (!res.ok) showNotice(res.error || 'Não foi possível salvar essa configuração.');
    });
  };
  const setPresence = (presence: Presence) => saveSettings({ presence });
  const setNotifyLevel = (notify: NotifyLevel) => saveSettings({ notify });

  const toggleBrowserNotify = async () => {
    if (browserNotify) {
      setBrowserNotify(false);
      try {
        localStorage.setItem('mesa_browser_notify', '0');
      } catch {}
      return;
    }
    if (typeof Notification === 'undefined') return showNotice('Este navegador não mostra avisos fora da página.');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return showNotice('O navegador não liberou os avisos. Libere nas configurações do site (cadeado na barra de endereço).');
    setBrowserNotify(true);
    try {
      localStorage.setItem('mesa_browser_notify', '1');
    } catch {}
    showNotice('Pronto: você receberá avisos do Mesa mesmo com a aba em segundo plano.');
  };

  const setChatVisible = (visible: boolean) => {
    chatVisibleRef.current = visible;
    if (visible) setUnread((prev) => (prev.count || prev.mentions ? { count: 0, mentions: 0 } : prev));
  };

  // Assistir à tela de alguém: além de mostrar aqui, avisa quem compartilha (para ele saber quem está vendo)
  const watchScreen = (userId: string | null) => {
    setWatchedScreenId(userId);
    wsSend({ type: 'screen:watch', userId });
  };

  // Quando a pessoa para de compartilhar, o "assistindo" some (e na próxima vez volta o convite para assistir)
  useEffect(() => {
    if (watchedScreenId && !participants.some((p) => p.id === watchedScreenId && p.isSharingScreen)) setWatchedScreenId(null);
  }, [participants, watchedScreenId]);

  const updateRoom = async (roomId: string, patch: RoomPatch) => {
    const res = await request('room:update', { roomId, ...patch });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar as mudanças.' };
    return { ok: true };
  };

  const loadHistory = async () => {
    const roomId = roomIdRef.current;
    if (!roomId || historyBusyRef.current) return;
    const oldest = (allMessages[roomId] || [])[0];
    if (!oldest) {
      setHistoryStatus((prev) => ({ ...prev, [roomId]: 'done' }));
      return;
    }
    historyBusyRef.current = true;
    deletedWhileLoadingRef.current = new Set();
    setHistoryStatus((prev) => ({ ...prev, [roomId]: 'loading' }));
    try {
      let collected: ChatMessage[] = [];
      let cursor = { id: oldest.id, ts: oldest.ts };
      for (;;) {
        const res = await request('chat:history', { beforeId: cursor.id, beforeTs: cursor.ts });
        if (!res.ok) throw new Error(res.error || 'falhou');
        const page: ChatMessage[] = (res.messages || []).map(mapMessage);
        if (page.length) collected = [...page, ...collected];
        if (!res.hasMore || page.length === 0) break;
        cursor = { id: page[0].id, ts: page[0].ts };
      }
      if (roomIdRef.current !== roomId) return;
      const gone = deletedWhileLoadingRef.current;
      setOlderMessages((prev) => ({ ...prev, [roomId]: gone.size ? collected.filter((m) => !gone.has(m.id)) : collected }));
      setHistoryStatus((prev) => ({ ...prev, [roomId]: 'done' }));
    } catch {
      if (roomIdRef.current === roomId) setHistoryStatus((prev) => ({ ...prev, [roomId]: 'error' }));
    } finally {
      historyBusyRef.current = false;
    }
  };

  const deleteMessage = (id: string) => {
    void request('chat:delete', { id }).then((res) => {
      if (!res.ok) {
        showNotice(res.error || 'Não foi possível apagar a mensagem.');
        playErrorSound();
      }
    });
  };

  // Número de mensagens não lidas no título da aba
  useEffect(() => {
    const base = 'Mesa · A sala de estudo online';
    document.title = unread.count > 0 ? `(${unread.count}) ${base}` : base;
  }, [unread.count]);

  /* ---------------- Soundpad ---------------- */
  const persist = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  };
  const setPadVolume = (volume: number) => {
    const clamped = Math.min(1, Math.max(0, volume));
    setPadVolumeState(clamped);
    persist('mesa_pad_volume', String(clamped));
  };
  const setPadListen = (listen: boolean) => {
    setPadListenState(listen);
    persist('mesa_pad_listen', listen ? '1' : '0');
  };
  const setPadHotkeys = (enabled: boolean) => {
    setPadHotkeysState(enabled);
    persist('mesa_pad_hotkeys', enabled ? '1' : '0');
  };

  const loadSounds = async () => {
    const res = await api('/api/sounds', { token: tokenRef.current });
    if (res.ok) {
      const list: Sound[] = res.data.sounds || [];
      setSounds(list);
      list.forEach((sound) => preloadClip(sound.url));
    }
  };

  const AUDIO_TYPES: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm' };

  const addSound = async (file: File, options: { name?: string; emoji?: string } = {}) => {
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'O som é grande demais (máximo de 2 MB).' };
    // Confere se o navegador entende o áudio e quanto ele dura (o soundpad é para sons curtos)
    let duration = 0;
    try {
      const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) throw new Error('sem áudio');
      const probe = new Ctx();
      duration = (await probe.decodeAudioData(await file.arrayBuffer())).duration;
      probe.close().catch(() => {});
    } catch {
      return { ok: false, error: 'Não consegui ler esse áudio. Tente um arquivo mp3, wav, ogg ou m4a.' };
    }
    if (duration > 15.5) return { ok: false, error: `Esse áudio tem ${Math.round(duration)} s. O soundpad aceita até 15 s.` };

    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const type = file.type || AUDIO_TYPES[extension] || 'audio/mpeg';
    const defaultName = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Som';
    try {
      const res = await fetch('/api/sounds', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': type,
          'x-name': encodeURIComponent(options.name || defaultName),
          'x-emoji': encodeURIComponent(options.emoji || ''),
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Não foi possível adicionar o som.' };
      const nextList: Sound[] = data.sounds || [];
      setSounds(nextList);
      nextList.forEach((sound: Sound) => preloadClip(sound.url));
      playSuccessSound();
      const newest = nextList[nextList.length - 1];
      return { ok: true, soundId: newest?.id };
    } catch {
      return { ok: false, error: 'Não foi possível enviar o som. Verifique sua conexão.' };
    }
  };

  const updateSound = async (id: string, patch: { name?: string; emoji?: string; key?: string }) => {
    const res = await api('/api/sounds/update', { body: { id, ...patch }, token: tokenRef.current });
    if (!res.ok) return { ok: false, error: res.error || 'Não foi possível salvar.' };
    setSounds(res.data.sounds || []);
    return { ok: true };
  };

  const deleteSound = (id: string) => {
    void api(`/api/sounds/${id}`, { method: 'DELETE', token: tokenRef.current }).then((res) => {
      if (res.ok) setSounds(res.data.sounds || []);
    });
  };

  const flashSound = (userId: string, name: string, emoji: string) => {
    setSoundFlash((prev) => ({ ...prev, [userId]: { name, emoji } }));
    const old = flashTimersRef.current.get(userId);
    if (old) window.clearTimeout(old);
    flashTimersRef.current.set(
      userId,
      window.setTimeout(() => {
        setSoundFlash((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }, 2500)
    );
  };

  /** Toca o som para mim na hora e manda o servidor avisar o resto da chamada */
  const playSound = (id: string) => {
    const sound = sounds.find((item) => item.id === id);
    if (!sound) return;
    if (!roomIdRef.current) return showNotice('Entre em uma sala para usar o soundpad.');
    if (punishedRef.current) return punishedNotice();
    void playClip(sound.url, padVolume);
    flashSound(userRef.current.id, sound.name, sound.emoji);
    void request('sound:play', { id }).then((res) => {
      if (!res.ok) showNotice(res.error || 'Não foi possível tocar o som para a sala.');
    });
  };

  padRef.current = { sounds, hotkeys: padHotkeys, inRoom: !!currentRoomId, play: playSound };

  // Atalhos de teclado do soundpad (só valem com a aba do Mesa em foco; o navegador não permite mais que isso)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const pad = padRef.current;
      if (!pad.hotkeys || !pad.inRoom || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName || '';
      const inputType = tag === 'INPUT' ? (target as HTMLInputElement).type : '';
      const typing = tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit', 'file', 'color'].includes(inputType));
      if (typing) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      const sound = pad.sounds.find((item) => item.key === combo);
      if (!sound) return;
      e.preventDefault();
      pad.play(sound.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ---------------- Foto da sala ---------------- */
  const setRoomIcon = async (dataUrl: string) => {
    const roomId = roomIdRef.current;
    if (!roomId) return false;
    const res = await request('room:icon', { roomId, iconUrl: dataUrl });
    if (!res.ok) {
      showNotice(res.error || 'Não foi possível mudar a foto da sala.');
      playErrorSound();
      return false;
    }
    playSuccessSound();
    return true;
  };

  /* ---------------- Bot de música ---------------- */
  const applyMusic = (dto: Omit<MusicState, 'receivedAt'> | undefined) => {
    if (!dto) return setMusic(EMPTY_MUSIC);
    setMusic({ on: dto.on, queue: dto.queue || [], playing: dto.playing, positionMs: dto.positionMs, seq: dto.seq, receivedAt: performance.now() });
  };

  const musicCommand = (type: string, payload: Record<string, unknown> = {}) => {
    void request(type, payload).then((res) => {
      if (!res.ok) {
        showNotice(res.error || 'Não foi possível fazer isso agora.');
        playErrorSound();
      }
    });
  };
  const musicSummon = () => musicCommand('music:summon');
  const musicDismiss = () => musicCommand('music:dismiss');
  const musicControl = (action: 'pause' | 'resume' | 'skip' | 'remove' | 'playnow', id?: string) => musicCommand(`music:${action}`, { id });
  const musicEnded = (songId: string) => void wsSend({ type: 'music:ended', id: songId });
  const musicFailed = (songId: string) => void wsSend({ type: 'music:error', id: songId });

  const musicAdd = async (url: string) => {
    if (punishedRef.current) return { ok: false, error: 'Você está de castigo e não pode mexer na música agora.' };
    const res = await request('music:add', { url });
    if (res.ok) playSuccessSound();
    return { ok: !!res.ok, error: res.error as string | undefined };
  };

  const musicSearch = async (query: string) => {
    const res = await api(`/api/music/search?q=${encodeURIComponent(query)}`, { token: tokenRef.current });
    if (!res.ok) return { ok: false, items: [] as MusicSearchItem[], error: res.error, needsKey: !!res.data?.needsKey };
    return { ok: true, items: (res.data.items || []) as MusicSearchItem[] };
  };

  /* ---------------- GIFs e figurinhas ---------------- */
  const searchGifs = async (query: string) => {
    const res = await api(`/api/gifs?q=${encodeURIComponent(query)}`, { token: tokenRef.current });
    if (!res.ok) return { ok: false, gifs: [] as GifResult[], error: res.error, needsKey: !!res.data?.needsKey };
    return { ok: true, gifs: (res.data.gifs || []) as GifResult[] };
  };

  const sendToChat = (payload: Record<string, unknown>) => {
    if (!roomIdRef.current) return;
    if (punishedRef.current) return punishedNotice();
    if (wsSend(payload)) playMessageSentSound();
    else showNotice('Sem conexão com o servidor. Não foi possível enviar.');
  };
  const sendGif = (url: string) => sendToChat({ type: 'chat:gif', url });
  const sendSticker = (id: string) => sendToChat({ type: 'chat:sticker', id });

  const loadStickers = async () => {
    const res = await api('/api/stickers', { token: tokenRef.current });
    if (res.ok) setStickers(res.data.stickers || []);
  };

  /** Cria uma figurinha a partir de uma imagem: reduz para 256px mantendo a transparência. GIF vai como está. */
  const createSticker = async (file: File): Promise<boolean> => {
    const fail = (text: string) => {
      showNotice(text);
      playErrorSound();
      return false;
    };
    if (!file.type.startsWith('image/')) return fail('Escolha uma imagem para virar figurinha.');

    let body: Blob = file;
    let type = file.type;
    if (file.type !== 'image/gif') {
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
        const png = blob && blob.type === 'image/webp' ? null : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        body = png || blob || file;
        type = body.type || file.type;
      } catch {
        return fail('Não foi possível ler essa imagem.');
      }
    }
    if (body.size > 1.5 * 1024 * 1024) return fail('Essa imagem é pesada demais para figurinha (máximo de 1,5 MB).');

    try {
      const res = await fetch('/api/stickers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}`, 'Content-Type': type },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return fail(data.error || 'Não foi possível criar a figurinha.');
      setStickers(data.stickers || []);
      playSuccessSound();
      return true;
    } catch {
      return fail('Não foi possível criar a figurinha. Verifique sua conexão.');
    }
  };

  const deleteSticker = (id: string) => {
    void api(`/api/stickers/${id}`, { method: 'DELETE', token: tokenRef.current }).then((res) => {
      if (res.ok) setStickers(res.data.stickers || []);
    });
  };

  const saveSticker = (id: string) => {
    void api('/api/stickers/save', { body: { id }, token: tokenRef.current }).then((res) => {
      if (!res.ok) {
        showNotice(res.error || 'Não foi possível salvar a figurinha.');
        return playErrorSound();
      }
      setStickers(res.data.stickers || []);
      playSuccessSound();
      showNotice('Figurinha salva na sua coleção.');
    });
  };

  /* ---------------- Moderação e volume individual ---------------- */
  const moderate = async (action: ModerationAction, userId: string, duration?: ModerationDuration) => {
    const roomId = roomIdRef.current;
    if (!roomId) return false;
    const requests: Record<ModerationAction, [string, Record<string, unknown>]> = {
      kick: ['mod:kick', { duration: duration ?? 0 }],
      punish: ['mod:punish', { duration }],
      pardon: ['mod:pardon', {}],
      unban: ['mod:unban', {}],
      promote: ['mod:role', { role: 'admin' }],
      demote: ['mod:role', { role: 'member' }],
    };
    const [type, extra] = requests[action];
    const res = await request(type, { roomId, userId, ...extra });
    if (!res.ok) {
      showNotice(res.error || 'Não foi possível fazer isso agora.');
      playErrorSound();
      return false;
    }
    const sounds: Record<ModerationAction, () => void> = {
      kick: playKickSound,
      punish: playPunishSound,
      pardon: playPardonSound,
      unban: playPardonSound,
      promote: playPromoteSound,
      demote: playDemoteSound,
    };
    sounds[action]();
    return true;
  };

  const setPeerVolume = (userId: string, volume: number) => {
    setPeerVolumes((prev) => {
      const next = { ...prev, [userId]: Math.max(0, Math.min(2, volume)) };
      try {
        localStorage.setItem('mesa_volumes', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* ---------------- Pomodoro ---------------- */
  useEffect(() => {
    if (!pomo.running || !pomo.endsAt) return;
    const timer = window.setInterval(() => {
      if (pomo.endsAt! - Date.now() <= 0) {
        playPomodoroChime();
        const mode = pomo.mode === 'focus' ? 'break' : 'focus';
        setPomo({ mode, running: false, remainingMs: mode === 'focus' ? FOCUS_MS : BREAK_MS, endsAt: null });
      } else {
        setNowTick(Date.now());
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [pomo]);

  const pomodoroSeconds =
    pomo.running && pomo.endsAt
      ? Math.max(0, Math.ceil((pomo.endsAt - nowTick) / 1000))
      : Math.ceil(pomo.remainingMs / 1000);

  const pushPomodoro = (next: { mode: 'focus' | 'break'; running: boolean; remainingMs: number }) => {
    applyPomodoro(next);
    wsSend({ type: 'pomodoro:set', ...next });
    playSuccessSound();
  };

  const togglePomodoro = () => {
    const remainingMs = pomo.running && pomo.endsAt ? Math.max(0, pomo.endsAt - Date.now()) : pomo.remainingMs;
    pushPomodoro({ mode: pomo.mode, running: !pomo.running, remainingMs });
  };

  const resetPomodoro = (newMode?: 'focus' | 'break') => {
    const mode = newMode || pomo.mode;
    pushPomodoro({ mode, running: false, remainingMs: mode === 'focus' ? FOCUS_MS : BREAK_MS });
  };

  /* ---------------- Mensagens vindas do servidor ---------------- */
  handlerRef.current = (msg: any) => {
    switch (msg.type) {
      case 'reply': {
        const resolve = pendingRef.current.get(msg.reqId);
        if (resolve) {
          pendingRef.current.delete(msg.reqId);
          resolve(msg);
        }
        return;
      }
      case 'hello': {
        setCurrentUser({ ...msg.user });
        if (roomIdRef.current) {
          void enterRoom(roomIdRef.current, true);
        } else if (pendingCodeRef.current) {
          const code = pendingCodeRef.current;
          pendingCodeRef.current = null;
          void joinRoomByCode(code).then((ok) => {
            if (!ok) {
              setRoomUrl(null);
              showNotice('O convite desse link não é mais válido.');
            }
          });
        }
        return;
      }
      case 'state': {
        setRooms(msg.rooms || []);
        const map: Record<string, User> = {};
        for (const person of msg.people || []) map[person.id] = person;
        setFriends(map);
        return;
      }
      case 'peer:joined': {
        if (msg.roomId !== roomIdRef.current || msg.user.id === userRef.current.id) return;
        let isNew = false;
        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === msg.user.id);
          isNew = !exists;
          return exists
            ? prev.map((p) => (p.id === msg.user.id ? { ...p, ...msg.user, isSpeaking: p.isSpeaking } : p))
            : [...prev, msg.user];
        });
        if (!peersRef.current.has(msg.user.id)) {
          ensurePeer(msg.user.id);
          playPeerJoinSound();
        }
        void isNew;
        return;
      }
      case 'peer:left': {
        if (msg.roomId !== roomIdRef.current) return;
        setParticipants((prev) => prev.filter((p) => p.id !== msg.userId));
        // Quem estava em foco saiu: o foco acaba (senão ele "ressuscita" em foco quando voltar)
        setCallFocus((current) => (current && current.id === msg.userId ? null : current));
        closePeer(msg.userId);
        setParticipantMenuId((current) => (current === msg.userId ? null : current));
        playPeerLeaveSound();
        return;
      }
      case 'peer:media': {
        if (msg.roomId !== roomIdRef.current) return;
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === msg.userId ? { ...p, ...msg.media, isSpeaking: msg.media.isMicOn ? p.isSpeaking : false } : p
          )
        );
        return;
      }
      // Quem está vendo a sua tela mudou: aviso na tela e um som quando chega alguém
      case 'screen:viewers': {
        if (msg.roomId !== roomIdRef.current) return;
        const next: User[] = msg.viewers || [];
        const before = screenViewersRef.current;
        const joined = next.filter((v) => !before.some((b) => b.id === v.id));
        const left = before.filter((b) => !next.some((v) => v.id === b.id));
        screenViewersRef.current = next;
        setScreenViewers(next);
        if (joined.length > 0) {
          playViewerJoinSound();
          showNotice(`${joined[0].name} está vendo a sua tela`);
        } else if (left.length > 0 && mediaRef.current.isSharingScreen) {
          playViewerLeaveSound();
        }
        return;
      }
      case 'peer:speaking': {
        if (msg.roomId !== roomIdRef.current) return;
        setParticipants((prev) => prev.map((p) => (p.id === msg.userId ? { ...p, isSpeaking: msg.isSpeaking } : p)));
        return;
      }
      case 'signal': {
        handleSignal(msg.from, msg.data);
        return;
      }
      case 'chat:new': {
        const message = mapMessage(msg.message);
        setAllMessages((prev) => {
          const list = prev[message.roomId] || [];
          if (list.some((m) => m.id === message.id)) return prev;
          return { ...prev, [message.roomId]: [...list, message] };
        });
        if (!message.isMe && message.senderId !== 'system') {
          const mentioned = !!(message.mentions?.includes(userRef.current.id) || message.mentionAll);
          if (shouldAlert(mentioned)) {
            if (mentioned) playNotificationSound();
            else playMessageReceivedSound();
            browserAlert(`${message.senderName}${currentRoom ? ` · ${currentRoom.name}` : ''}`, message.content || translateString('Enviou um arquivo'));
          }
          if (!chatVisibleRef.current) {
            setUnread((prev) => ({ count: prev.count + 1, mentions: prev.mentions + (mentioned ? 1 : 0) }));
          }
        }
        return;
      }
      case 'chat:deleted': {
        setAllMessages((prev) => ({ ...prev, [msg.roomId]: (prev[msg.roomId] || []).filter((m) => m.id !== msg.id) }));
        setOlderMessages((prev) => (prev[msg.roomId] ? { ...prev, [msg.roomId]: prev[msg.roomId].filter((m) => m.id !== msg.id) } : prev));
        if (historyBusyRef.current) deletedWhileLoadingRef.current.add(msg.id);
        return;
      }
      case 'mention': {
        // Marcaram você numa sala em que você não está na chamada agora
        if (shouldAlert(true)) {
          playNotificationSound();
          showNotice(`${msg.from} marcou você em "${msg.roomName}": ${msg.preview}`);
          browserAlert(translateString(`${msg.from} marcou você em ${msg.roomName}`), msg.preview);
        }
        return;
      }
      case 'material:new': {
        const material = mapMaterial(msg.material);
        setAllMaterials((prev) => {
          const list = prev[material.roomId] || [];
          if (list.some((m) => m.id === material.id)) return prev;
          return { ...prev, [material.roomId]: [material, ...list] };
        });
        return;
      }
      case 'notes': {
        const decrypted = decryptRoomText(msg.roomId, roomKeysRef.current.get(msg.roomId), msg.text || '');
        setRoomNotes((prev) => ({ ...prev, [msg.roomId]: decrypted }));
        return;
      }
      case 'pomodoro': {
        if (msg.roomId === roomIdRef.current) applyPomodoro(msg.pomodoro);
        return;
      }
      case 'call:replaced': {
        resetRoomLocally();
        showNotice('Você entrou em uma sala por outra aba ou aparelho; esta saiu da chamada.');
        return;
      }
      case 'room:deleted': {
        if (msg.roomId === roomIdRef.current) {
          resetRoomLocally();
          showNotice(`A sala "${msg.name}" foi excluída por quem a criou.`);
        }
        return;
      }
      case 'sound:play': {
        if (msg.roomId !== roomIdRef.current) return;
        flashSound(msg.userId, msg.name, msg.emoji);
        // Silenciando a chamada, ou os sons, ou aquela pessoa, o som não toca para mim
        if (isDeafened || !padListen) return;
        const personVolume = Math.min(1, peerVolumes[msg.userId] ?? 1);
        void playClip(msg.url, personVolume * padVolume, msg.maxDuration);
        return;
      }
      case 'music:state': {
        if (msg.roomId === roomIdRef.current) applyMusic(msg.music);
        return;
      }
      case 'board:draw': {
        if (msg.roomId === roomIdRef.current) applyBoardDraw(msg.stroke, msg.points || []);
        return;
      }
      case 'board:remove': {
        if (msg.roomId !== roomIdRef.current) return;
        const ids = new Set<string>(msg.ids || []);
        setBoardStrokes(boardRef.current.strokes.filter((stroke) => !ids.has(stroke.id)));
        return;
      }
      case 'board:reset': {
        if (msg.roomId === roomIdRef.current) setBoardStrokes(msg.strokes || []);
        return;
      }
      case 'notice': {
        showNotice(msg.text);
        playErrorSound();
        return;
      }
      case 'kicked': {
        if (msg.roomId === roomIdRef.current) resetRoomLocally();
        playKickSound();
        showNotice(
          msg.until
            ? `${msg.by} expulsou você da sala "${msg.roomName}". Você não pode voltar ${untilLabel(msg.until)}.`
            : `${msg.by} tirou você da sala "${msg.roomName}". Para voltar, entre de novo com o código.`
        );
        return;
      }
      case 'punished': {
        if (msg.roomId !== roomIdRef.current) return;
        const active = isActiveUntil(msg.until);
        punishedRef.current = active;
        setMyPunishedUntil(active ? msg.until : 0);
        if (active) {
          enforcePunishment();
          playPunishSound();
          showNotice(`${msg.by} colocou você de castigo ${untilLabel(msg.until)}: sem microfone, câmera, tela e chat.`);
        } else {
          playPardonSound();
          showNotice(msg.expired ? 'Seu castigo acabou. Pode ligar o microfone de novo.' : `${msg.by} tirou o seu castigo.`);
        }
        return;
      }
      case 'role': {
        if (msg.role === 'admin') {
          playPromoteSound();
          showNotice(`${msg.by} tornou você adm da sala "${msg.roomName}".`);
        } else {
          playDemoteSound();
          showNotice(`${msg.by} tirou o seu cargo de adm na sala "${msg.roomName}".`);
        }
        return;
      }
      case 'invited': {
        playNotificationSound();
        showNotice(`${msg.from} convidou você para a sala "${msg.roomName}". Ela já está em Minhas salas.`);
        return;
      }
    }
  };

  /* ---------------- Conexão com o servidor ---------------- */
  const disconnect = () => {
    if (reconnectRef.current.timer) window.clearTimeout(reconnectRef.current.timer);
    reconnectRef.current = { timer: null, attempts: 0 };
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    setIsConnected(false);
  };

  const forceSignOut = () => {
    disconnect();
    resetRoomLocally();
    tokenRef.current = null;
    storeToken(null);
    setCurrentUser(GUEST);
    setRooms([]);
    setFriends({});
    setStickers([]);
    setSounds([]);
    setAuthStatus('out');
  };

  const connect = () => {
    if (!tokenRef.current) return;
    storeToken(tokenRef.current);
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectRef.current.attempts = 0;
      ws.send(JSON.stringify({ type: 'auth', token: tokenRef.current }));
      setIsConnected(true);
    };
    ws.onmessage = (event) => {
      try {
        handlerRef.current(JSON.parse(event.data));
      } catch (err) {
        console.warn('Mensagem inválida do servidor', err);
      }
    };
    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setIsConnected(false);
      teardownPeers();
      setParticipants([]);
      pendingRef.current.forEach((resolve) => resolve({ ok: false, error: 'A conexão com o servidor caiu.' }));
      pendingRef.current.clear();
      if (event.code === 4001) return forceSignOut();
      if (!tokenRef.current) return;
      const delay = Math.min(1000 * 2 ** reconnectRef.current.attempts, 10000);
      reconnectRef.current.attempts += 1;
      reconnectRef.current.timer = window.setTimeout(connect, delay);
    };
  };

  const startSession = (token: string, user: User) => {
    tokenRef.current = token;
    storeToken(token);
    setCurrentUser(user);
    setAuthStatus('in');
    setIsAuthModalOpen(false);
    connect();
    void loadStickers();
    void loadSounds();
  };

  // Ao abrir o app: recupera a sessão salva e o convite que veio no link (?room=CODIGO)
  useEffect(() => {
    let cancelled = false;
    try {
      pendingCodeRef.current = new URLSearchParams(window.location.search).get('room');
      localStorage.removeItem('mesa_auth_user'); // sobra da versão antiga, sem servidor
      if (localStorage.getItem('mesa_noise') === '0') {
        noiseWantedRef.current = false;
        setNoiseSuppression(false);
      }
    } catch {}

    const token = getStoredToken();
    if (!token) {
      setAuthStatus('out');
      if (pendingCodeRef.current) {
        setAuthModalMode('signup');
        setIsAuthModalOpen(true);
      }
      return;
    }
    api('/api/me', { token }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        startSession(token, res.data.user);
      } else {
        if (res.status === 401) storeToken(null);
        setAuthStatus('out');
      }
    });

    return () => {
      cancelled = true;
      disconnect();
      teardownPeers();
      stopLocalMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Contas ---------------- */
  const openAuthModal = (mode: 'login' | 'signup' = 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    const res = await api('/api/login', { body: { login: identifier, password } });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível entrar.' };
    startSession(res.data.token, res.data.user);
    playSuccessSound();
    return { success: true };
  };

  const signup = async (data: {
    fullName: string;
    nickname: string;
    email: string;
    password: string;
    avatarUrl?: string;
  }): Promise<AuthResult> => {
    const avatarUrl = data.avatarUrl ? await shrinkAvatar(data.avatarUrl) : '';
    const res = await api('/api/signup', { body: { ...data, avatarUrl } });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível criar a conta.', field: res.field };
    if (res.data.needsVerification) return { success: true, needsVerification: true, email: res.data.email };
    startSession(res.data.token, res.data.user);
    playSuccessSound();
    return { success: true };
  };

  const verifySignup = async (email: string, code: string): Promise<AuthResult> => {
    const res = await api('/api/signup/verify', { body: { email, code } });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível confirmar o código.', field: res.field };
    startSession(res.data.token, res.data.user);
    playSuccessSound();
    return { success: true };
  };

  const resendSignupCode = async (email: string): Promise<AuthResult> => {
    const res = await api('/api/signup/resend', { body: { email } });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível reenviar o código.' };
    return { success: true };
  };

  const forgotPassword = async (identifier: string): Promise<AuthResult> => {
    const res = await api('/api/password/forgot', { body: { login: identifier } });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível enviar o código.', field: res.field };
    return { success: true };
  };

  const resetPassword = async (identifier: string, code: string, password: string): Promise<AuthResult> => {
    const res = await api('/api/password/reset', { body: { login: identifier, code, password } });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível redefinir a senha.', field: res.field };
    startSession(res.data.token, res.data.user);
    playSuccessSound();
    return { success: true };
  };

  const logout = () => {
    const token = tokenRef.current;
    if (roomIdRef.current) wsSend({ type: 'room:leave' });
    if (token) void api('/api/logout', { method: 'POST', token });
    forceSignOut();
    playLeaveRoomSound();
  };

  const updateUserProfile = async (data: {
    fullName?: string;
    name: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bannerColor?: string;
    borderColor?: string;
    joinSoundId?: string;
    statusText?: string;
  }): Promise<AuthResult> => {
    const body: Record<string, unknown> = { ...data };
    if (data.avatarUrl !== undefined) {
      const raw = data.avatarUrl;
      body.avatarUrl =
        raw === currentUser.avatarUrl
          ? undefined
          : !raw
          ? ''
          : raw.startsWith('https://') || raw.startsWith('data:image/gif')
          ? raw
          : await shrinkAvatar(raw, 240);
      if (body.avatarUrl === undefined) delete body.avatarUrl;
    }
    if (data.bannerUrl !== undefined) {
      const raw = data.bannerUrl;
      body.bannerUrl =
        raw === currentUser.bannerUrl
          ? undefined
          : !raw
          ? ''
          : raw.startsWith('https://') || raw.startsWith('data:image/gif')
          ? raw
          : await shrinkBanner(raw);
      if (body.bannerUrl === undefined) delete body.bannerUrl;
    }
    const res = await api('/api/profile', { body, token: tokenRef.current });
    if (!res.ok) return { success: false, error: res.error || 'Não foi possível salvar o perfil.', field: res.field };
    setCurrentUser(res.data.user);
    playSuccessSound();
    return { success: true };
  };

  /* ---------------- Sons ---------------- */
  const toggleSoundEffects = () => {
    setSoundActive((prev) => {
      const next = !prev;
      setSoundEnabled(next);
      if (next) playJoinRoomSound();
      return next;
    });
  };

  const testSound = (type: string) => {
    const sounds: Record<string, () => void> = {
      join: playJoinRoomSound,
      leave: playLeaveRoomSound,
      mute: playMuteSound,
      unmute: playUnmuteSound,
      message: playMessageSentSound,
      notification: playMessageReceivedSound,
      success: playSuccessSound,
      pomodoro: playPomodoroChime,
    };
    (sounds[type] || playJoinRoomSound)();
  };

  /* ---------------- Valores derivados ---------------- */
  const activeCallUsers = useMemo(() => {
    const result: Record<string, User[]> = {};
    for (const room of rooms) result[room.id] = room.members || [];
    return result;
  }, [rooms]);

  const currentRoom = useMemo<Room | null>(() => {
    if (!currentRoomId) return null;
    const base = rooms.find((r) => r.id === currentRoomId) || enteredRoom;
    if (!base) return null;
    return { ...base, members: participants, activeCount: participants.length + 1 };
  }, [rooms, enteredRoom, currentRoomId, participants]);

  const getPeerStreams = (member: User) => {
    const isLive = (s: MediaStream) => s.getVideoTracks().some((t) => t.readyState === 'live');
    const videos = (remoteStreams[member.id] || []).filter(isLive);
    const byId = (id?: string | null) => (id ? videos.find((s) => s.id === id) : undefined);

    let camera = member.isCameraOn ? byId(member.camStreamId) : undefined;
    let screen = member.isSharingScreen ? byId(member.screenStreamId) : undefined;
    // Alguns navegadores trocam o identificador do fluxo: cai para a ordem de chegada.
    const unmatched = videos.filter((s) => s !== camera && s !== screen);
    if (member.isCameraOn && !camera) camera = unmatched.shift();
    if (member.isSharingScreen && !screen) screen = unmatched.shift();
    return { camera, screen };
  };

  const screenSharers = participants.filter((p) => p.isSharingScreen);

  const screenShare: ScreenShare | null = (() => {
    if (isScreenSharing && localScreenStream) return { user: currentUser, stream: localScreenStream, isLocal: true };
    // Com mais de uma tela no ar, vale a que a pessoa escolheu assistir (ou pôs em foco)
    const sharer = screenSharers.find((p) => p.id === watchedScreenId) || screenSharers[0];
    if (!sharer) return null;
    return { user: sharer, stream: getPeerStreams(sharer).screen || null, isLocal: false };
  })();

  const remoteAudio = participants
    .filter((p) => !isActiveUntil(p.punishedUntil))
    .flatMap((p) =>
      (remoteStreams[p.id] || [])
        // Fluxo com vídeo + áudio é a tela compartilhada: o som dela só toca para quem escolheu assistir
        .filter((s) => s.getAudioTracks().length > 0 && (s.getVideoTracks().length === 0 || watchedScreenId === p.id))
        .map((stream) => ({ key: `${p.id}:${stream.id}`, stream, volume: peerVolumes[p.id] ?? 1 }))
    );

  const currentRoomMessages = currentRoomId ? allMessages[currentRoomId] || [] : [];
  const currentOlderMessages = currentRoomId ? olderMessages[currentRoomId] || [] : [];
  const currentHistoryStatus = (currentRoomId && historyStatus[currentRoomId]) || 'idle';
  const currentRoomMaterials = currentRoomId ? allMaterials[currentRoomId] || [] : [];

  return (
    <MesaContext.Provider
      value={{
        currentRoom,
        setCurrentRoomId,
        previewDevice,
        setPreviewDevice,

        callViewMode,
        setCallViewMode,
        callFocus,
        setCallFocus,
        isChatPanelOpen,
        setIsChatPanelOpen,
        toggleChatPanel: () => setIsChatPanelOpen((prev) => !prev),

        activeCallUsers,
        isConnected,

        isAuthenticated: authStatus === 'in',
        isAuthLoading: authStatus === 'loading',
        currentUser,
        login,
        signup,
        verifySignup,
        resendSignupCode,
        forgotPassword,
        resetPassword,
        logout,
        updateUserProfile,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        openAuthModal,

        studyCenterMode,
        setStudyCenterMode,

        roomNotes,
        updateRoomNotes,

        pomodoroSeconds,
        isPomodoroRunning: pomo.running,
        pomodoroMode: pomo.mode,
        togglePomodoro,
        resetPomodoro,

        rooms,
        createRoom,
        joinRoomByCode,
        deleteRoom,
        requestLeaveRoom,

        isMicOn,
        isCameraOn,
        isScreenSharing,
        isDeafened,
        audioVolumeLevel,
        toggleMic,
        toggleCamera,
        toggleScreenShare,
        toggleDeafen,
        localCameraStream,
        localScreenStream,
        getPeerStreams,
        screenShare,
        screenSharers,

        messages: currentRoomMessages,
        olderMessages: currentOlderMessages,
        historyStatus: currentHistoryStatus,
        loadHistory,
        sendMessage,
        materials: currentRoomMaterials,
        addMaterial,
        uploadRealFile,
        isUploading,
        uploadProgress,
        downloadStudyMaterial,

        activeDocument,
        setActiveDocument,

        friends,
        invitedFriends,
        inviteFriend,

        isCreateModalOpen,
        setIsCreateModalOpen,
        isInviteModalOpen,
        setIsInviteModalOpen,
        isJoinCodeModalOpen,
        setIsJoinCodeModalOpen,

        mobileActiveTab,
        setMobileActiveTab,

        soundEnabled: soundActive,
        toggleSoundEffects,
        testSound,

        board,
        noiseSuppression,
        toggleNoiseSuppression,
        watchedScreenId,
        watchScreen,
        screenViewers,
        updateRoom,
        roomSettingsId,
        openRoomSettings: setRoomSettingsId,
        closeRoomSettings: () => setRoomSettingsId(null),
        deleteMessage,
        presence: currentUser.presence || 'online',
        setPresence,
        notifyLevel: currentUser.notify || 'all',
        setNotifyLevel,
        browserNotify,
        toggleBrowserNotify,
        unread,
        setChatVisible,
        musicVolume,
        setMusicVolume,
        musicMuted,
        setMusicMuted,
        sounds,
        addSound,
        updateSound,
        deleteSound,
        playSound,
        soundFlash,
        padVolume,
        setPadVolume,
        padListen,
        setPadListen,
        padHotkeys,
        setPadHotkeys,
        settingsSection,
        openSettings,
        closeSettings,
        setRoomIcon,
        music,
        musicSummon,
        musicDismiss,
        musicAdd,
        musicSearch,
        musicControl,
        musicEnded,
        musicFailed,
        notify: showNotice,
        searchGifs,
        sendGif,
        stickers,
        createSticker,
        deleteSticker,
        saveSticker,
        sendSticker,
        peerVolumes,
        setPeerVolume,
        participantMenuId,
        participantMenuPos,
        setParticipantMenuId,
        openParticipantMenu: (userId, position) => {
          setParticipantMenuPos(position || null);
          setParticipantMenuId(userId);
        },
        myRole: currentRoom?.myRole || 'member',
        myPunishedUntil,
        isPunished: isActiveUntil(myPunishedUntil),
        moderate,

        mediaNotice,
        clearMediaNotice,
      }}
    >
      {children}
      {switchPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/75 animate-fadeIn"
          onClick={() => setSwitchPrompt(null)}
        >
          <div
            role="dialog"
            aria-label="Trocar de sala"
            data-testid="room-switch-modal"
            onClick={(e) => e.stopPropagation()}
            className="mesa-paper w-full max-w-md rounded-3xl bg-[#f6f5f0] text-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="landing-display text-xl text-slate-950">
                {switchPrompt.roomId ? 'Trocar de sala?' : 'Sair da sala?'}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {switchPrompt.roomId ? (
                  <>
                    Você está na chamada de <strong translate="no" className="text-slate-900">&ldquo;{switchPrompt.fromName}&rdquo;</strong>. Deseja sair dela para entrar em <strong translate="no" className="text-slate-900">&ldquo;{switchPrompt.roomName}&rdquo;</strong>?
                  </>
                ) : (
                  <>
                    Você está na chamada de <strong translate="no" className="text-slate-900">&ldquo;{switchPrompt.fromName}&rdquo;</strong>. Deseja sair dela e voltar para Minhas salas?
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSwitchPrompt(null)}
                className="h-10 px-4 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-900/10"
              >
                Continuar aqui
              </button>
              <button
                type="button"
                data-testid="room-switch-confirm"
                onClick={() => {
                  const targetId = switchPrompt.roomId;
                  setSwitchPrompt(null);
                  if (targetId) void enterRoom(targetId);
                  else leaveRoom();
                }}
                className="h-10 px-5 rounded-full bg-[#0b0f19] hover:bg-slate-800 text-white text-xs font-extrabold"
              >
                {switchPrompt.roomId ? 'Sim, trocar de sala' : 'Sim, sair da sala'}
              </button>
            </div>
          </div>
        </div>
      )}
      {accessPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/75 animate-fadeIn"
          onClick={() => {
            setAccessPrompt(null);
            setAccessInput('');
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!accessInput.trim() || accessBusy) return;
              setAccessBusy(true);
              if (accessPrompt.code && accessPrompt.needsPassword) {
                await joinRoomByCode(accessPrompt.code, accessInput.trim());
              } else if (accessPrompt.roomId) {
                await enterRoom(
                  accessPrompt.roomId,
                  false,
                  accessPrompt.needsPassword ? { password: accessInput.trim() } : { code: accessInput.trim() }
                );
              }
              setAccessBusy(false);
            }}
            data-testid="room-access-modal"
            className="mesa-paper w-full max-w-md rounded-3xl bg-[#f6f5f0] text-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="landing-display text-xl text-slate-950">
                {accessPrompt.needsPassword ? 'Senha da sala' : 'Código da sala'}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {accessPrompt.needsPassword
                  ? `A sala "${accessPrompt.roomName}" é protegida por senha.`
                  : `A sala "${accessPrompt.roomName}" é privada. Digite o código de convite para entrar.`}
              </p>
            </div>
            <input
              type={accessPrompt.needsPassword ? 'password' : 'text'}
              autoFocus
              value={accessInput}
              onChange={(e) =>
                setAccessInput(accessPrompt.needsPassword ? e.target.value : e.target.value.toUpperCase())
              }
              placeholder={accessPrompt.needsPassword ? 'Digite a senha da sala...' : 'Ex: MESA-4K7P'}
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-900/15 focus:border-[#3044f0] text-slate-900 placeholder-slate-400 text-sm font-semibold focus:outline-none"
            />
            {accessPrompt.error && (
              <p role="alert" className="text-xs font-semibold text-rose-600">
                {accessPrompt.error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setAccessPrompt(null);
                  setAccessInput('');
                }}
                className="h-10 px-4 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-900/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={accessBusy || !accessInput.trim()}
                className="h-10 px-5 rounded-full bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold"
              >
                {accessBusy ? 'Entrando...' : 'Entrar na sala'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Áudio dos outros participantes da chamada */}
      <div className="hidden" aria-hidden="true">
        {remoteAudio.map(({ key, stream, volume }) => (
          <StreamAudio key={key} stream={stream} muted={isDeafened} volume={volume} />
        ))}
      </div>
    </MesaContext.Provider>
  );
}

export function useMesa() {
  const context = useContext(MesaContext);
  if (!context) {
    throw new Error('useMesa must be used within a MesaProvider');
  }
  return context;
}
