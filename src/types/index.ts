/** Matéria/assunto da sala: texto livre escolhido por quem cria */
export type SubjectType = string;

export type UserStatus = 'online' | 'estudando' | 'ausente';

/** Como a pessoa quer aparecer: online, ausente ou ocupada (não perturbe) */
export type Presence = 'online' | 'ausente' | 'ocupado';

/** Quais mensagens avisam a pessoa: todas, só as que a marcam ou nenhuma */
export type NotifyLevel = 'all' | 'mentions' | 'none';

export interface User {
  id: string;
  fullName?: string;
  name: string; // Nickname / Nome aparente
  email?: string;
  avatarUrl?: string; // Foto de perfil real
  avatarLetter: string;
  avatarColor: string;
  isEmailVerified?: boolean;
  status: UserStatus;
  statusText?: string;
  currentRoomId?: string;
  isMicOn?: boolean;
  isCameraOn?: boolean;
  isSharingScreen?: boolean;
  isSpeaking?: boolean;
  isOwner?: boolean;
  presence?: Presence;
  notify?: NotifyLevel;
  // Identificadores dos fluxos de mídia da chamada (para casar câmera/tela no outro lado)
  micStreamId?: string | null;
  camStreamId?: string | null;
  screenStreamId?: string | null;
  // Cargo na sala atual e castigo (0 = sem castigo, -1 = para sempre, senão data em ms)
  role?: RoomRole;
  punishedUntil?: number;
}

export interface MusicSong {
  id: string;
  kind: 'youtube' | 'file';
  /** youtube: código do vídeo · file: endereço do arquivo no servidor */
  ref: string;
  title: string;
  author?: string;
  thumb?: string;
  addedBy: string;
  addedById: string;
}

export interface MusicState {
  /** O bot de música está na sala? */
  on: boolean;
  /** A primeira é a que está tocando */
  queue: MusicSong[];
  playing: boolean;
  /** Em que ponto (ms) a música estava quando esta atualização chegou */
  positionMs: number;
  seq: number;
  /** performance.now() de quando a atualização chegou: com o ponto acima dá a posição de agora */
  receivedAt: number;
}

export interface MusicSearchItem {
  id: string;
  title: string;
  author: string;
  thumb: string;
}

/** Som curto do soundpad de uma pessoa */
export interface Sound {
  id: string;
  name: string;
  emoji: string;
  /** Atalho de teclado, como "F7" ou "Ctrl+Num1"; vazio = sem atalho */
  key: string;
  url: string;
}

export interface Sticker {
  id: string;
  url: string;
}

export interface GifResult {
  id: string;
  title: string;
  preview: string;
  url: string;
}

export type RoomRole = 'owner' | 'admin' | 'member';

export interface RoomBan {
  user: User;
  until: number;
}

export interface BoardStroke {
  id: string;
  userId: string;
  tool: 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse';
  color: string;
  size: number;
  /** Pontos normalizados de 0 a 1: [x0, y0, x1, y1, ...] */
  points: number[];
}

export interface Room {
  id: string;
  name: string;
  subject: SubjectType;
  code: string;
  color: string;
  gradient: string;
  isPrivate: boolean;
  activeCount: number;
  members: User[];
  createdAt?: string;
  ownerId?: string;
  isOwner?: boolean;
  /** Foto da sala (imagem pequena em data URL); vazio = sem foto */
  iconUrl?: string;
  memberIds?: string[];
  adminIds?: string[];
  myRole?: RoomRole;
  myPunishedUntil?: number;
  bans?: RoomBan[];
  screenSharer?: string;
  currentDocument?: string;
  customUploadedFile?: {
    name: string;
    url: string;
    type: 'pdf' | 'image' | 'text';
  };
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'link' | 'file' | 'audio' | 'sticker' | 'video';
  size: string;
  /** Duração em segundos (mensagem de voz) */
  duration?: number;
  /** true quando é uma mensagem de voz gravada no chat; arquivo de áudio enviado não tem isso */
  voice?: boolean;
  url?: string;
  pageCount?: number;
  /** Imagem enviada "como documento": aparece como cartão em vez de abrir no chat */
  asDocument?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderAvatarUrl?: string;
  senderColor: string;
  content: string;
  timestamp: string;
  ts?: number;
  /** Quem foi marcado com @ nesta mensagem */
  mentions?: string[];
  /** @todos (só adm e dono) */
  mentionAll?: boolean;
  attachment?: ChatAttachment;
  isMe?: boolean;
}

export interface StudyMaterial {
  id: string;
  roomId: string;
  title: string;
  type: 'pdf' | 'image' | 'link' | 'file';
  size?: string;
  pages?: number;
  uploadedBy: string;
  uploadedAt: string;
  /** Quando foi enviado (milissegundos), para filtrar por dia */
  ts?: number;
  url: string;
  isCustomFile?: boolean;
}
