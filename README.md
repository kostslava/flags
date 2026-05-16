# Flag Guess

Online multiplayer flag guessing game with lobbies (JKLM-style). Tap one of six country names, play on your phone, switch UI between English and Russian.

## Features

- **Lobbies** — 4-letter room codes; share and join with friends
- **Difficulty** — Easy, Medium, Hard (different country pools)
- **6 options** — Large tap targets, mobile-first layout
- **EN / RU** — Language toggle for UI and country names
- **Scoring** — Faster correct answers earn more points

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 (client). The API/WebSocket server runs on port 3001.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Serves the built client and Socket.IO from a single server on port 3001 (or `PORT`).

## Stack

- React + Vite (client)
- Express + Socket.IO (server)
- Shared TypeScript types and country data

Flag images via [flagsapi.com](https://flagsapi.com).

## Deploy

**No database.** Room state lives in server memory.

### Vercel (frontend only)

1. Import the GitHub repo on Vercel (uses `vercel.json` → builds `client/dist`).
2. Deploy the **API** on [Render](https://render.com) or Railway (use `render.yaml` or `npm run build && npm start`).
3. In Vercel → **Settings → Environment Variables**, add:
   - `VITE_SOCKET_URL` = your Render URL, e.g. `https://flags-api.onrender.com`
4. Redeploy Vercel after setting the variable.

Multiplayer will not work until `VITE_SOCKET_URL` points at a running Node server.
