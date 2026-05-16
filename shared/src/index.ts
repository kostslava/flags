export type Lang = "en" | "ru";
export type Difficulty = "easy" | "medium" | "hard";
export type RoomPhase = "lobby" | "playing" | "roundEnd" | "gameOver";

export interface Country {
  code: string;
  en: string;
  ru: string;
  difficulty: Difficulty;
}

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  lastAnswer?: string;
  lastCorrect?: boolean;
  answeredAt?: number;
}

export interface RoundState {
  round: number;
  totalRounds: number;
  flagCode: string;
  /** Country name labels in current room language */
  options: string[];
  correctCode?: string;
  endsAt: number;
  startedAt: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: RoomPhase;
  difficulty: Difficulty;
  lang: Lang;
  players: PlayerState[];
  round?: RoundState;
  roundResults?: {
    correctCode: string;
    correctName: string;
    scores: { id: string; name: string; delta: number; total: number }[];
  };
}

export interface ClientToServerEvents {
  createRoom: (data: { name: string; lang: Lang }, cb: (res: JoinResponse) => void) => void;
  joinRoom: (data: { code: string; name: string; lang: Lang }, cb: (res: JoinResponse) => void) => void;
  setLang: (lang: Lang) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  startGame: () => void;
  answer: (code: string) => void;
  nextRound: () => void;
  resetLobby: () => void;
  leaveRoom: () => void;
}

export interface ServerToClientEvents {
  roomState: (state: RoomState) => void;
  error: (message: string) => void;
}

export type JoinResponse =
  | { ok: true; state: RoomState }
  | { ok: false; error: string };

export const ROUND_TIME_MS = 12_000;
export const TOTAL_ROUNDS = 10;
export const OPTION_COUNT = 6;

export function countryName(c: Country, lang: Lang): string {
  return lang === "ru" ? c.ru : c.en;
}

export function flagUrl(code: string, width = 640): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

export { COUNTRIES, getCountry, poolForDifficulty, shuffle } from "./countries.js";
