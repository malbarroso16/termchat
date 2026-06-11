# TermChat

A real-time terminal chat application built as a backend portfolio project. Features a NestJS WebSocket server with Redis Pub/Sub, JWT authentication, presence tracking, rate limiting, and an Ink-based React TUI CLI client.

## Screenshots

| Auth Screen | Chat UI |
|:-----------:|:-------:|
| ![Auth Screen](docs/assets/Auth%20Screen.png) | ![TermChat UI](docs/assets/TermChat%20UI.png) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    apps/cli (Ink TUI)                   │
│   AuthScreen → ChatScreen                               │
│   ChannelPane | MessagePane | InputPane | HelpPane      │
│   useSocket() ──────► socket.io-client ────────────┐   │
└────────────────────────────────────────────────────│───┘
                                                      │ WS /chat
┌────────────────────────────────────────────────────▼───┐
│                  apps/server (NestJS)                  │
│                                                        │
│  HTTP  ┌──────────────┐  ┌────────────────────────┐   │
│ ──────►│AuthController│  │ChannelsController       │   │
│        │POST /register│  │GET  /channels           │   │
│        │POST /login   │  │POST /channels           │   │
│        └──────┬───────┘  └───────────┬────────────┘   │
│               │ JWT                  │ PrismaService   │
│  WS    ┌──────▼──────────────────────▼────────────┐   │
│ ──────►│             ChatGateway                  │   │
│        │ handleConnection → WsGuard.verifyClient() │   │
│        │ send_message → RateLimitService           │   │
│        │             → CommandsService             │   │
│        │             → MessagesService             │   │
│        │             → broadcast (Redis Pub/Sub)   │   │
│        │ handleDisconnect → PresenceService (8s)   │   │
│        └───────────────────────┬──────────────────┘   │
│                                │                       │
│  ┌─────────────┐  ┌────────────▼──────┐               │
│  │ PostgreSQL  │  │  Redis 7          │               │
│  │ (Prisma 7)  │  │  Pub/Sub adapter  │               │
│  │             │  │  Presence (Sets)  │               │
│  │             │  │  Rate limit (INCR)│               │
│  └─────────────┘  └───────────────────┘               │
└────────────────────────────────────────────────────────┘
```

## Quick Start (Docker)

```bash
cd termchat
cp .env.example .env        # edit JWT_SECRET to a 32+ char string

docker compose up --build

curl http://localhost:3000/health
# → {"status":"ok","info":{"postgres":{"status":"up"},"redis":{"status":"up"}}}
```

## Quick Start (Local Dev)

**Prerequisites:** Docker Desktop, Node.js 22 LTS

```bash
# 1. Start backing services
docker compose up postgres redis -d

# 2. Run server migrations
cd apps/server
npx prisma migrate deploy

# 3. Start server in watch mode
npm run start:dev

# 4. In a second terminal — start CLI (user 1)
cd apps/cli
npm run start

# 5. In a third terminal — start CLI (user 2, isolated session)
set CHAT_CONFIG_PATH=%USERPROFILE%\.termchat\user2
npm run start
```

## CLI Controls

Once logged in, the TUI supports:

| Input | Action |
|-------|--------|
| Type + Enter | Send message |
| `/help` | Toggle full command reference overlay |
| `/join #<name>` | Switch to a channel |
| `/leave` | Leave current channel (removes from sidebar) |
| `/create #<name> [desc]` | Create a new channel |
| `/nick <newname>` | Change display name |
| `/logout` | Sign out and clear saved session |
| `↑` / `↓` | Navigate channels (when input is empty) |
| `Esc` | Clear input |
| `Ctrl+C` | Quit |

The CLI saves your JWT to disk via the `conf` package so you stay logged in across restarts.

## Running Tests

### Unit tests (no Docker needed)

```bash
cd apps/server
npm run test          # 36 tests across 6 suites
npm run test:cov      # with coverage report
```

**Test suites:**

| Suite | Tests | What it covers |
|-------|-------|---------------|
| `auth.service.spec.ts` | 5 | Register (success, duplicate email), Login (success, wrong password, not found) |
| `channels.service.spec.ts` | 4 | Create channel (success, duplicate name), isMember (exists, not exists) |
| `commands.service.spec.ts` | 5 | parse() cases, handleNick() (short name, taken name) |
| `rate-limit.service.spec.ts` | 4 | Below threshold, above threshold, TTL set, TTL not reset |
| `messages.service.spec.ts` | 7 | create(), edit() (success + NotFoundException + ForbiddenException), softDelete() (success + NotFoundException + ForbiddenException) |
| `presence.service.spec.ts` | 11 | userJoinedChannel, userLeftChannel, getOnlineUsers, scheduleDisconnect (timer fires, replaces), cancelDisconnect (prevents fire, no-op), hasPendingDisconnect |

### E2E test (requires running server + DB)

```bash
cd apps/server
npm run test:e2e      # rate-limit E2E: burst 8 messages, assert error_rate_limit
```

### Manual HTTP test scripts

Use the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension:

| File | Purpose |
|------|---------|
| `tests/sprint1.http` | Register, login, duplicate email, wrong password, health check |
| `tests/sprint2.http` | Create channels, list channels, get messages |
| `tests/sprint5.http` | Multi-user setup (admin, alice, bob) |

### WebSocket smoke tests

```bash
node tests/ws-test.js <JWT_TOKEN>           # connect → join → send → receive
node tests/ws-ratelimit-test.js <JWT_TOKEN> # burst send → expect error_rate_limit
```

## WebSocket Event Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `channel_join` | `{ channelId }` | Join a channel, receive `message_history` |
| `channel_leave` | `{ channelId }` | Leave a channel |
| `send_message` | `{ channelId, content }` | Send a message or slash command |
| `edit_message` | `{ messageId, content }` | Edit own message |
| `delete_message` | `{ messageId }` | Soft-delete own message |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `initial_state` | `{ channels }` | Sent on connect — channel list for the user |
| `message_history` | `{ channelId, messages }` | Last 20 messages after channel join |
| `new_message` | `Message` | New message broadcast to channel |
| `message_edited` | `{ messageId, content, editedAt }` | Edit broadcast |
| `message_deleted` | `{ messageId }` | Soft-delete broadcast |
| `user_joined` | `{ userId, username, channelId }` | Presence notification |
| `user_left` | `{ userId, username, channelId }` | Presence notification (8s grace period) |
| `name_changed` | `{ userId, oldName, newName }` | `/nick` broadcast |
| `presence_update` | `{ channelId, onlineUserIds }` | Online user list for a channel |
| `error_rate_limit` | `{ message }` | Rate limit exceeded (5 msg/s) |
| `error_unauthorized` | `{ message }` | Auth failure |
| `command_error` | `{ message }` | Slash command error |

## Slash Commands

Slash commands are typed directly into the chat input. Unknown commands are forwarded to the server, which routes `/nick`, `/join`, `/leave`, and `/dm`.

| Command | Example | Description |
|---------|---------|-------------|
| `/help` | `/help` | Toggle help overlay in TUI |
| `/join #<name>` | `/join #general` | Switch to a channel by name |
| `/leave` | `/leave` | Leave current channel |
| `/create #<name>` | `/create #dev backend channel` | Create channel (with optional description) |
| `/nick <name>` | `/nick alice` | Change display name (persisted to DB) |
| `/logout` | `/logout` | Sign out, clear JWT, return to auth screen |
| `/dm @<user> <msg>` | `/dm @alice hello` | Direct message — coming soon |

## Multi-Session Testing

To simulate multiple concurrent users on one machine, the CLI respects `CHAT_CONFIG_PATH` for isolated JWT storage per window.

```cmd
REM Terminal 1 — admin
set CHAT_CONFIG_PATH=%USERPROFILE%\.termchat\admin
cd apps\cli && npm run start

REM Terminal 2 — alice
set CHAT_CONFIG_PATH=%USERPROFILE%\.termchat\alice
cd apps\cli && npm run start

REM Terminal 3 — bob
set CHAT_CONFIG_PATH=%USERPROFILE%\.termchat\bob
cd apps\cli && npm run start
```

> **Status:** Multi-terminal concurrent testing is pending (Sprint 5).

## Architecture Decision Records

### ADR-01: Redis Adapter for Socket.io
Using `@socket.io/redis-adapter` with two ioredis clients (pub/sub) so every broadcast reaches all socket.io instances, enabling horizontal scaling. Even with a single instance this validates the pattern.

### ADR-02: In-Memory Disconnect Timers
Presence uses `setTimeout` in-memory (8s grace period) rather than Redis TTL. Trade-off: timers are lost on server restart. In a multi-instance deployment a reconnect landing on a different instance would not cancel the timer. The production fix is a short-TTL Redis key per user. Intentional scope limitation.

### ADR-03: Prisma 7 with PrismaPg Driver Adapter
Prisma 7 removes `url` from `datasource` in `schema.prisma`. The database URL is supplied via `prisma.config.ts` for CLI operations and `process.env.DATABASE_URL` at runtime through `PrismaPg`. The generated client lives at `src/generated/prisma/`. After each `prisma generate`, two `import.meta.url` lines must be removed from the generated `client.ts` to avoid a Node.js 22 CJS/ESM conflict.

### ADR-04: Redis Sliding Window Rate Limiting
`INCR + EXPIRE` key `rate:{userId}:{unix_second}` — atomic and cross-instance safe. 5 messages/second per user. One Redis round-trip per message.

### ADR-05: JWT in WS Handshake
JWT is passed in `socket.handshake.auth.token` (not as a query param) to avoid token leakage in server access logs. `WsGuard.verifyClient()` validates at connection time.

### ADR-06: /nick In-Session Username Patch
`/nick` patches `client.data.user.username` in-memory and updates the DB. On reconnect the JWT still carries the old username — a new login is required to pick up the DB name in the token. Documented limitation.

### ADR-07: apps/cli Isolated from npm Workspaces
`apps/cli` is excluded from the root workspace array. Prisma 7 bundles `@prisma/studio-core` which hoists React 19 to the workspace root, conflicting with Ink which requires React 18. Isolation avoids the conflict without patching.

## Project Structure

```
termchat/
├── apps/
│   ├── server/              # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── auth/         # JWT auth, WsGuard, strategies
│   │   │   ├── channels/     # Channel CRUD + membership
│   │   │   ├── chat/         # ChatGateway (WebSocket)
│   │   │   ├── commands/     # /nick, /join, /leave, /dm parsing
│   │   │   ├── health/       # GET /health (Postgres + Redis)
│   │   │   ├── messages/     # Create, edit, soft-delete
│   │   │   ├── presence/     # Redis Sets + grace period timers
│   │   │   ├── prisma/       # PrismaService (driver adapter)
│   │   │   ├── rate-limit/   # INCR+EXPIRE sliding window
│   │   │   └── redis/        # ioredis provider (REDIS_CLIENT token)
│   │   ├── test/             # E2E tests
│   │   └── prisma.config.ts  # Prisma 7 CLI configuration
│   └── cli/                  # Ink TUI client
│       └── src/
│           ├── components/
│           │   ├── AuthScreen.tsx   # Login / Register with mode selector
│           │   ├── ChatScreen.tsx   # Main shell, command routing
│           │   ├── ChannelPane.tsx  # Channel list sidebar
│           │   ├── HelpPane.tsx     # /help overlay
│           │   ├── InputPane.tsx    # Controlled text input
│           │   └── MessagePane.tsx  # Message history (12-hour timestamps)
│           ├── api.ts        # axios HTTP client
│           ├── config.ts     # conf-based JWT storage
│           ├── index.tsx     # Entry point, terminal resize listener
│           └── useSocket.ts  # socket.io-client hook + all event handlers
├── tests/                    # HTTP + WS test scripts
├── docker-compose.yml
├── .env.example
└── wait-for-it.sh
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server framework | NestJS 11 + TypeScript |
| WebSocket | Socket.io 4 (`@nestjs/platform-socket.io`) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL 15 |
| Cache / PubSub | Redis 7 + ioredis |
| Auth | JWT (`@nestjs/jwt`) + Passport |
| Password hashing | bcrypt (12 rounds) |
| Logging | nestjs-pino (JSON structured) |
| API docs | Swagger (`@nestjs/swagger`) |
| Health checks | `@nestjs/terminus` |
| CLI framework | Ink 4 (React for terminals) |
| HTTP client | axios |
| Config persistence | conf |
| Container | Docker Compose |
| Runtime | Node.js 22 LTS |
