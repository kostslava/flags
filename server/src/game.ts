import {
  OPTION_COUNT,
  ROUND_TIME_MS,
  TOTAL_ROUNDS,
  countryName,
  getCountry,
  poolForDifficulty,
  shuffle,
  type Country,
  type Difficulty,
  type Lang,
  type PlayerState,
  type RoomPhase,
  type RoomState,
  type RoundState,
} from "@flags/shared";

interface InternalRound extends RoundState {
  optionCodes: string[];
  correctCode: string;
}

interface InternalRoom {
  code: string;
  hostId: string;
  phase: RoomPhase;
  difficulty: Difficulty;
  lang: Lang;
  players: Map<string, PlayerState>;
  round?: InternalRound;
  roundResults?: RoomState["roundResults"];
  usedCodes: Set<string>;
  roundTimer?: ReturnType<typeof setTimeout>;
  currentRound: number;
}

const rooms = new Map<string, InternalRoom>();
const playerRoom = new Map<string, string>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return rooms.has(code) ? randomCode() : code;
}

function pickCorrect(pool: Country[], used: Set<string>): Country | null {
  const available = pool.filter((c) => !used.has(c.code));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function buildOptions(correct: Country, pool: Country[], lang: Lang): string[] {
  const distractorPool = pool.filter((c) => c.code !== correct.code);
  const distractors = shuffle(distractorPool).slice(0, OPTION_COUNT - 1);
  const options = shuffle([correct, ...distractors]);
  return options.map((c) => c.code);
}

function publicState(room: InternalRoom): RoomState {
  const players = [...room.players.values()].sort((a, b) => b.score - a.score);
  const base: RoomState = {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    difficulty: room.difficulty,
    lang: room.lang,
    players,
    roundResults: room.roundResults,
  };

  if (room.round && (room.phase === "playing" || room.phase === "roundEnd")) {
    base.round = {
      round: room.round.round,
      totalRounds: room.round.totalRounds,
      flagCode: room.round.flagCode,
      options: [...room.round.options],
      startedAt: room.round.startedAt,
      endsAt: room.round.endsAt,
    };
    if (room.phase === "roundEnd") {
      base.round.correctCode = room.round.correctCode;
    }
  }

  return base;
}

function clearTimer(room: InternalRoom) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = undefined;
  }
}

export function getRoomState(code: string): RoomState | null {
  const room = rooms.get(code);
  return room ? publicState(room) : null;
}

export function createRoom(
  playerId: string,
  name: string,
  lang: Lang,
): { room: InternalRoom; state: RoomState } {
  leaveRoom(playerId);
  const code = randomCode();
  const room: InternalRoom = {
    code,
    hostId: playerId,
    phase: "lobby",
    difficulty: "medium",
    lang,
    players: new Map(),
    usedCodes: new Set(),
    currentRound: 0,
  };
  room.players.set(playerId, { id: playerId, name: name.slice(0, 20), score: 0 });
  rooms.set(code, room);
  playerRoom.set(playerId, code);
  return { room, state: publicState(room) };
}

export function joinRoom(
  playerId: string,
  code: string,
  name: string,
  lang: Lang,
): { ok: true; state: RoomState } | { ok: false; error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { ok: false, error: "room_not_found" };
  if (room.phase !== "lobby") return { ok: false, error: "game_started" };

  leaveRoom(playerId);
  room.players.set(playerId, { id: playerId, name: name.slice(0, 20), score: 0 });
  room.lang = lang;
  playerRoom.set(playerId, code.toUpperCase());
  return { ok: true, state: publicState(room) };
}

export function leaveRoom(playerId: string): string | null {
  const code = playerRoom.get(playerId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) {
    playerRoom.delete(playerId);
    return null;
  }

  room.players.delete(playerId);
  playerRoom.delete(playerId);

  if (room.players.size === 0) {
    clearTimer(room);
    rooms.delete(code);
    return code;
  }

  if (room.hostId === playerId) {
    const next = room.players.keys().next().value;
    if (next) room.hostId = next;
  }

  return code;
}

function localizeRound(room: InternalRoom) {
  if (!room.round) return;
  room.round.options = room.round.optionCodes.map((code) =>
    countryName(getCountry(code)!, room.lang),
  );
  if (room.roundResults && room.round.correctCode) {
    const correct = getCountry(room.round.correctCode)!;
    room.roundResults.correctName = countryName(correct, room.lang);
  }
}

export function setLang(playerId: string, lang: Lang): RoomState | null {
  const room = getPlayerRoom(playerId);
  if (!room) return null;
  room.lang = lang;
  localizeRound(room);
  return publicState(room);
}

export function setDifficulty(playerId: string, difficulty: Difficulty): RoomState | null {
  const room = getPlayerRoom(playerId);
  if (!room || room.hostId !== playerId || room.phase !== "lobby") return null;
  room.difficulty = difficulty;
  return publicState(room);
}

function getPlayerRoom(playerId: string): InternalRoom | null {
  const code = playerRoom.get(playerId);
  return code ? rooms.get(code) ?? null : null;
}

export function startGame(playerId: string): RoomState | null {
  const room = getPlayerRoom(playerId);
  if (!room || room.hostId !== playerId || room.phase !== "lobby") return null;
  if (room.players.size < 1) return null;

  room.usedCodes.clear();
  room.currentRound = 0;
  room.roundResults = undefined;
  for (const p of room.players.values()) {
    p.score = 0;
    delete p.lastAnswer;
    delete p.lastCorrect;
    delete p.answeredAt;
  }

  return startRound(room);
}

function scoreForAnswer(startedAt: number, answeredAt: number): number {
  const elapsed = answeredAt - startedAt;
  const max = ROUND_TIME_MS;
  const base = 1000;
  const speedBonus = Math.max(0, Math.round(((max - elapsed) / max) * 500));
  return base + speedBonus;
}

function startRound(room: InternalRoom): RoomState | null {
  clearTimer(room);
  room.roundResults = undefined;

  if (room.currentRound >= TOTAL_ROUNDS) {
    room.phase = "gameOver";
    room.round = undefined;
    return publicState(room);
  }

  const pool = poolForDifficulty(room.difficulty);
  const correct = pickCorrect(pool, room.usedCodes);
  if (!correct) {
    room.phase = "gameOver";
    room.round = undefined;
    return publicState(room);
  }

  room.usedCodes.add(correct.code);
  room.currentRound += 1;

  const now = Date.now();
  const options = buildOptions(correct, pool, room.lang);

  for (const p of room.players.values()) {
    delete p.lastAnswer;
    delete p.lastCorrect;
    delete p.answeredAt;
  }

  room.round = {
    round: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
    flagCode: correct.code,
    optionCodes: options,
    options: options.map((code) => countryName(getCountry(code)!, room.lang)),
    correctCode: correct.code,
    startedAt: now,
    endsAt: now + ROUND_TIME_MS,
  };

  room.phase = "playing";

  room.roundTimer = setTimeout(() => endRound(room), ROUND_TIME_MS);

  return publicState(room);
}

export function submitAnswer(playerId: string, answerLabel: string): RoomState | null {
  const room = getPlayerRoom(playerId);
  if (!room || room.phase !== "playing" || !room.round) return null;

  const player = room.players.get(playerId);
  if (!player || player.answeredAt) return publicState(room);

  const idx = room.round.options.indexOf(answerLabel);
  const code = idx >= 0 ? room.round.optionCodes[idx] : answerLabel;
  const correct = code === room.round.correctCode;
  const now = Date.now();

  player.lastAnswer = answerLabel;
  player.lastCorrect = correct;
  player.answeredAt = now;

  if (correct) {
    player.score += scoreForAnswer(room.round.startedAt, now);
  }

  const allAnswered = [...room.players.values()].every((p) => p.answeredAt);
  if (allAnswered) {
    endRound(room);
  }

  return publicState(room);
}

function endRound(room: InternalRoom) {
  if (room.phase !== "playing" || !room.round) return;

  clearTimer(room);
  const correct = getCountry(room.round.correctCode)!;

  const deltas: RoomState["roundResults"] = {
    correctCode: correct.code,
    correctName: countryName(correct, room.lang),
    scores: [],
  };

  for (const p of room.players.values()) {
    const wasCorrect = p.lastCorrect === true;
    const delta =
      wasCorrect && p.answeredAt
        ? scoreForAnswer(room.round.startedAt, p.answeredAt)
        : 0;
    deltas.scores.push({
      id: p.id,
      name: p.name,
      delta: wasCorrect ? delta : 0,
      total: p.score,
    });
  }

  deltas.scores.sort((a, b) => b.total - a.total);
  room.roundResults = deltas;
  room.phase = "roundEnd";
}

export function nextRound(playerId: string): RoomState | null {
  const room = getPlayerRoom(playerId);
  if (!room || room.hostId !== playerId || room.phase !== "roundEnd") return null;
  return startRound(room);
}

export function resetToLobby(playerId: string): RoomState | null {
  const room = getPlayerRoom(playerId);
  if (!room || room.hostId !== playerId || room.phase !== "gameOver") return null;
  clearTimer(room);
  room.phase = "lobby";
  room.round = undefined;
  room.roundResults = undefined;
  room.usedCodes.clear();
  room.currentRound = 0;
  for (const p of room.players.values()) {
    p.score = 0;
    delete p.lastAnswer;
    delete p.lastCorrect;
    delete p.answeredAt;
  }
  return publicState(room);
}

export function getRoomByPlayer(playerId: string): InternalRoom | null {
  return getPlayerRoom(playerId);
}

export function getPublicState(room: InternalRoom): RoomState {
  return publicState(room);
}
