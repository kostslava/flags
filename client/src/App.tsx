import { useCallback, useEffect, useMemo, useState } from "react";
import type { Difficulty, Lang, RoomState } from "@flags/shared";
import { flagUrl } from "@flags/shared";
import { isBackendConfigured, socket } from "./socket";
import { t, type StringKey } from "./i18n";

type Screen = "home" | "lobby" | "game";

const NAME_KEY = "flags-player-name";
const LANG_KEY = "flags-lang";

function loadLang(): Lang {
  const v = localStorage.getItem(LANG_KEY);
  return v === "ru" ? "ru" : "en";
}

function loadName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export default function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [connectFailed, setConnectFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myId, setMyId] = useState(socket.id);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setConnectFailed(false);
      setMyId(socket.id);
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setConnectFailed(true);
    const onRoom = (state: RoomState) => {
      setRoom(state);
      setError(null);
      if (state.phase === "lobby") setScreen("lobby");
      else setScreen("game");
    };
    const onErr = (msg: string) => setError(msg);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("roomState", onRoom);
    socket.on("error", onErr);

    if (socket.connected) setMyId(socket.id);

    let failTimer: ReturnType<typeof setTimeout> | undefined;
    if (isBackendConfigured && !socket.connected) {
      failTimer = setTimeout(() => {
        if (!socket.connected) setConnectFailed(true);
      }, 10_000);
    }

    return () => {
      clearTimeout(failTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("roomState", onRoom);
      socket.off("error", onErr);
    };
  }, []);

  const errText = useCallback(
    (key: string) => {
      const map: Record<string, StringKey> = {
        room_not_found: "error_room_not_found",
        game_started: "error_game_started",
      };
      const k = map[key];
      return k ? t(lang, k) : t(lang, "error_join");
    },
    [lang],
  );

  const createLobby = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(NAME_KEY, trimmed);
    socket.emit("createRoom", { name: trimmed, lang }, (res) => {
      if (!res.ok) setError(errText(res.error));
      else setRoom(res.state);
    });
  };

  const joinLobby = () => {
    const trimmed = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || code.length < 4) return;
    localStorage.setItem(NAME_KEY, trimmed);
    socket.emit("joinRoom", { code, name: trimmed, lang }, (res) => {
      if (!res.ok) setError(errText(res.error));
      else setRoom(res.state);
    });
  };

  const copyCode = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leave = () => {
    socket.emit("leaveRoom");
    setRoom(null);
    setScreen("home");
  };

  const switchLang = (next: Lang) => {
    setLang(next);
    if (room) socket.emit("setLang", next);
  };

  const isHost = room?.hostId === myId;

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">{t(lang, "title")}</span>
        <div className="lang-switch" role="group" aria-label="Language">
          <button
            type="button"
            className={lang === "en" ? "active" : ""}
            onClick={() => switchLang("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={lang === "ru" ? "active" : ""}
            onClick={() => switchLang("ru")}
          >
            RU
          </button>
        </div>
      </header>

      <main className="main">
        {!isBackendConfigured && (
          <div className="error-toast">{t(lang, "serverNotConfigured")}</div>
        )}

        {isBackendConfigured && !connected && (
          <p className="waiting-msg">
            {connectFailed ? t(lang, "connectionFailed") : t(lang, "connecting")}
          </p>
        )}

        {error && <div className="error-toast">{error}</div>}

        {screen === "home" && (
          <HomeScreen
            lang={lang}
            name={name}
            setName={setName}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onCreate={createLobby}
            onJoin={joinLobby}
            disabled={!isBackendConfigured || !connected}
          />
        )}

        {screen === "lobby" && room && (
          <LobbyScreen
            lang={lang}
            room={room}
            isHost={isHost}
            myId={myId}
            copied={copied}
            onCopy={copyCode}
            onDifficulty={(d) => socket.emit("setDifficulty", d)}
            onStart={() => socket.emit("startGame")}
            onLeave={leave}
          />
        )}

        {screen === "game" && room && (
          <GameScreen
            lang={lang}
            room={room}
            myId={myId}
            isHost={isHost}
            onAnswer={(label) => socket.emit("answer", label)}
            onNext={() => socket.emit("nextRound")}
            onLeave={leave}
          />
        )}
      </main>
    </div>
  );
}

function HomeScreen({
  lang,
  name,
  setName,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  disabled,
}: {
  lang: Lang;
  name: string;
  setName: (v: string) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  disabled: boolean;
}) {
  return (
    <div className="card">
      <h2>{t(lang, "title")}</h2>
      <p className="sub">{t(lang, "subtitle")}</p>

      <div className="field">
        <label htmlFor="name">{t(lang, "yourName")}</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          enterKeyHint="go"
        />
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onCreate}
          disabled={disabled || !name.trim()}
        >
          {t(lang, "createLobby")}
        </button>
      </div>

      <div className="divider">{t(lang, "joinLobby")}</div>

      <div className="field">
        <label htmlFor="code">{t(lang, "roomCode")}</label>
        <input
          id="code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={onJoin}
        disabled={disabled || !name.trim() || joinCode.trim().length < 4}
      >
        {t(lang, "join")}
      </button>
    </div>
  );
}

function LobbyScreen({
  lang,
  room,
  isHost,
  myId,
  copied,
  onCopy,
  onDifficulty,
  onStart,
  onLeave,
}: {
  lang: Lang;
  room: RoomState;
  isHost: boolean;
  myId: string | undefined;
  copied: boolean;
  onCopy: () => void;
  onDifficulty: (d: Difficulty) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="card">
      <h2>{t(lang, "lobby")}</h2>
      <p className="sub">{t(lang, "shareInvite")}</p>

      <div className="room-banner">
        <div>
          <div className="room-code">
            <small>{t(lang, "room")}</small>
            {room.code}
          </div>
        </div>
        <button type="button" className="copy-btn" onClick={onCopy}>
          {copied ? t(lang, "copied") : t(lang, "copyCode")}
        </button>
      </div>

      <p className="field label" style={{ margin: "0 0 8px" }}>
        {t(lang, "players")}
      </p>
      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id}>
            <span>
              {p.name}
              {p.id === myId ? ` (${t(lang, "you")})` : ""}
            </span>
            {p.id === room.hostId && (
              <span className="badge">{t(lang, "host")}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="field label" style={{ margin: "0 0 8px" }}>
        {t(lang, "difficulty")}
      </p>
      <div className="difficulty-picker">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={room.difficulty === d ? "active" : ""}
            disabled={!isHost}
            onClick={() => onDifficulty(d)}
          >
            {t(lang, d)}
          </button>
        ))}
      </div>

      {isHost ? (
        <button type="button" className="btn btn-primary" onClick={onStart}>
          {t(lang, "startGame")}
        </button>
      ) : (
        <p className="waiting-msg">{t(lang, "waitingHost")}</p>
      )}

      <button
        type="button"
        className="btn btn-ghost"
        style={{ marginTop: 12 }}
        onClick={onLeave}
      >
        {t(lang, "leave")}
      </button>
    </div>
  );
}

function GameScreen({
  lang,
  room,
  myId,
  isHost,
  onAnswer,
  onNext,
  onLeave,
}: {
  lang: Lang;
  room: RoomState;
  myId: string | undefined;
  isHost: boolean;
  onAnswer: (label: string) => void;
  onNext: () => void;
  onLeave: () => void;
}) {
  const me = room.players.find((p) => p.id === myId);
  const round = room.round;

  if (room.phase === "gameOver") {
    return (
      <div className="card">
        <h2>{t(lang, "gameOver")}</h2>
        <p className="sub">{t(lang, "finalScores")}</p>
        <ul className="player-list">
          {room.players.map((p, i) => (
            <li key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <span>
                {p.score} {t(lang, "points")}
              </span>
            </li>
          ))}
        </ul>
        {isHost ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => socket.emit("resetLobby")}
          >
            {t(lang, "playAgain")}
          </button>
        ) : (
          <p className="waiting-msg">{t(lang, "waitingHost")}</p>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={onLeave}
        >
          {t(lang, "leave")}
        </button>
      </div>
    );
  }

  if (room.phase === "roundEnd" && room.roundResults) {
    return (
      <div className="card game-screen">
        <div className="round-result">
          <h3>{t(lang, "round")} {round?.round}</h3>
          <p className="answer">{room.roundResults.correctName}</p>
        </div>
        <ul className="result-list">
          {room.roundResults.scores.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <span>
                +{s.delta} · {s.total} {t(lang, "points")}
              </span>
            </li>
          ))}
        </ul>
        {isHost && (
          <button type="button" className="btn btn-primary" onClick={onNext}>
            {t(lang, "nextRound")}
          </button>
        )}
        {!isHost && <p className="waiting-msg">{t(lang, "waitingHost")}</p>}
      </div>
    );
  }

  if (!round) return null;

  return (
    <PlayingRound
      lang={lang}
      room={room}
      round={round}
      me={me}
      onAnswer={onAnswer}
    />
  );
}

function PlayingRound({
  lang,
  room,
  round,
  me,
  onAnswer,
}: {
  lang: Lang;
  room: RoomState;
  round: NonNullable<RoomState["round"]>;
  me: RoomState["players"][0] | undefined;
  onAnswer: (label: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const answered = Boolean(me?.answeredAt);
  const myAnswer = me?.lastAnswer;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, [round.round]);

  const remaining = Math.max(0, round.endsAt - now);
  const pct = (remaining / (round.endsAt - round.startedAt)) * 100;
  const low = pct < 25;

  const flagSrc = useMemo(() => flagUrl(round.flagCode, 64), [round.flagCode]);

  return (
    <div className="game-screen">
      <div className="round-header">
        <span>
          {t(lang, "round")} {round.round} {t(lang, "of")} {round.totalRounds}
        </span>
        <span>{Math.ceil(remaining / 1000)}s</span>
      </div>

      <div className="timer-bar">
        <div
          className={`timer-fill ${low ? "low" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flag-frame">
        <img
          src={flagSrc}
          alt=""
          draggable={false}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallback !== "shiny") {
              img.dataset.fallback = "shiny";
              img.src = flagUrl(round.flagCode, 64, "shiny");
            }
          }}
        />
      </div>

      <div className="scoreboard-mini">
        {room.players.map((p) => (
          <span key={p.id} className="score-chip">
            {p.name}: <strong>{p.score}</strong>
          </span>
        ))}
      </div>

      {answered && (
        <div className="answered-banner">{t(lang, "answered")}</div>
      )}

      <div className="options-grid">
        {round.options.map((label) => {
          let cls = "option-btn";
          if (answered && label === myAnswer) cls += " selected";
          return (
            <button
              key={label}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => onAnswer(label)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
