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

export type FlagStyle = "flat" | "shiny";

const FLAG_API_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;

function nearestFlagApiSize(requested: number): (typeof FLAG_API_SIZES)[number] {
  return FLAG_API_SIZES.reduce((best, n) =>
    Math.abs(n - requested) < Math.abs(best - requested) ? n : best,
  );
}

/** https://flagsapi.com/:country_code/:style/:size.png */
export function flagUrl(code: string, size = 256, style: FlagStyle = "flat"): string {
  const px = nearestFlagApiSize(size);
  return `https://flagsapi.com/${code.toUpperCase()}/${style}/${px}.png`;
}

export { COUNTRIES, getCountry, poolForDifficulty, shuffle } from "./countries.js";
