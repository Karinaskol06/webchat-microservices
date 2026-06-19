# WebChat Application

A real-time chat platform built with a Spring Cloud microservices backend and a React SPA. Users can register, manage contacts, exchange messages in private and group conversations, join public channels, and receive browser push notifications when offline.

## Architecture

The system uses **service discovery (Eureka)**, an **API gateway** as the single entry point, and **event-driven notifications** via Kafka. Real-time delivery uses **WebSocket + STOMP** in `chat-service`; the gateway proxies REST and WebSocket traffic.

```text
webchat/
├── api-gateway/               # Spring Cloud Gateway (port 8089)
├── auth-service/              # JWT auth, password reset (port 8082)
├── user-service/              # Profiles, contacts, bans (port 8081)
├── chat-service/              # Rooms, messages, WebSocket, presence (port 8083)
├── notification-service/      # Web Push from Kafka events (port 8084)
├── discovery-service/         # Eureka registry (port 8761)
├── shared-module/             # Shared DTOs, Kafka schemas, validation
├── webchat_frontend/          # React SPA (dev: 5173, Docker: 80)
├── docker-compose.yaml        # Full stack (infra + all services)
├── docker-compose.dev.yml     # Infra + Eureka for local JVM development
└── pom.xml                    # Parent POM
```

### Request flow

```text
Browser
  ├─ REST  /api/**  → api-gateway → [auth | user | chat | notification]
  └─ WS    /ws/**   → api-gateway → chat-service (STOMP)

chat-service ──Kafka──► notification-service ──Web Push──► Browser (service worker)

auth-service ──Feign──► user-service
user-service ──Feign──► chat-service (account deletion cleanup)
chat-service ──Feign──► user-service (user info, bans)
```

### Service responsibilities


| Service                  | Port      | Role                                                     |
| ------------------------ | --------- | -------------------------------------------------------- |
| **discovery-service**    | 8761      | Eureka service registry                                  |
| **user-service**         | 8081      | User profiles, avatars, contacts, bans, search           |
| **auth-service**         | 8082      | Login, register, JWT, password reset (Redis tokens)      |
| **chat-service**         | 8083      | Chats, rooms, messages, attachments, presence, WebSocket |
| **notification-service** | 8084      | Push subscriptions and Kafka-driven Web Push             |
| **api-gateway**          | 8089      | Routing, JWT validation, CORS, identity headers          |
| **frontend**             | 5173 / 80 | React UI (Vite dev server or nginx in Docker)            |


Gateway routes:

- `/api/auth/`** → auth-service (public)
- `/api/users/**` → user-service (JWT)
- `/api/chat/**`, `/api/presence/**` → chat-service (JWT)
- `/api/notifications/**` → notification-service (JWT; VAPID key endpoint is public)
- `/ws/**` → chat-service WebSocket

---

## Technology Stack

### Backend

- **Java 21**, **Spring Boot 3.2**, **Spring Cloud 2023**
- **Spring Cloud Gateway** + **Netflix Eureka**
- **Spring Security** + **JWT** (HS256, shared secret)
- **OpenFeign** for inter-service HTTP
- **WebSocket + STOMP** (SockJS) for real-time messaging
- **PostgreSQL 15** — users, contacts, bans, push subscriptions
- **MongoDB 7** — chat rooms, messages, attachments metadata
- **Redis 7** — presence, caching, password-reset tokens
- **Apache Kafka** (KRaft, single-node) — async notification events
- **Maven** multi-module build

### Frontend

- **React 19**, **Vite 7**, **React Router 7**
- **Material UI (MUI) 7**
- **Zustand** — auth, chat, folders, theme, locale state
- **Axios** — REST via API gateway
- **STOMP.js + SockJS** — WebSocket client
- **Vitest** + **Testing Library** — unit tests
- **Playwright** — E2E tests

---

## Features

### Authentication & account

- Registration and login with form validation
- JWT-based sessions; gateway forwards `X-User-Id` / `X-Username` to downstream services
- Password reset via email (SMTP) or logged reset links when mail is disabled
- Profile management: avatar, background, birthday, phone, description
- Username/email availability checks, password change, account deletion

### Contacts & moderation

- Contact requests: send, accept, decline (declined requests can be snoozed)
- Global user bans (block users across private chats)
- Room-level bans and admin roles

### Chat & rooms

- **Room types:** private (1:1), group, channel, personal space (solo workspace)
- **Visibility:** public (discoverable/joinable) or private (invite link)
- Create and manage groups/channels; room photos and descriptions
- Invite links (`/join/:token`) and username-based member invites
- Channel posting restrictions (admins/moderators only)
- Message types: text, attachments, mixed, **to-do lists**, **sticky notes**, **callouts**, **polls/quizzes**
- Replies, forwards, edit, soft delete
- Message reactions (emoji)
- Poll voting with optional quiz mode (correct answers, explanations)
- Read receipts, unread counts, typing indicators
- In-chat message search
- File attachments (images, documents, video; size limits enforced server-side)

### Real-time & presence

- STOMP over SockJS at `/ws/chat`
- Per-chat topics for messages, typing, read state, edits, deletes, reactions, attachments
- User inbox stream for chat list updates and incoming messages
- Online / AFK / last-seen presence (Redis + REST heartbeat)
- Observer pattern in chat-service: WebSocket delivery + Kafka publication in parallel

### Notifications

- Web Push (VAPID) for new messages, reactions, and room invites
- Kafka topics consumed by `notification-service`
- Service worker in the frontend for push display and mark-read coordination

### Frontend UX

- Single-page chat workspace at `/chat` with responsive mobile layout
- Chat folders (client-side organization, persisted per user)
- Filters: All, Direct, Groups, Channels
- Three theme presets (Purple, Teal, Maroon) with glass/bento styling
- **i18n:** English and Ukrainian
- Web Push subscription management
- Personal spaces with rich content (notes, todos, callouts, polls)

---

## Databases


| Store          | Used by              | Data                                                                       |
| -------------- | -------------------- | -------------------------------------------------------------------------- |
| **PostgreSQL** | user-service         | `users`, `friend_requests`, `user_contacts`, `user_bans`, `profile_images` |
| **PostgreSQL** | notification-service | `push_subscriptions`, `notification_delivery`                              |
| **MongoDB**    | chat-service         | `chat_rooms`, `messages`, `room_member_invites`, `attachments`             |
| **Redis**      | auth-service         | Password-reset tokens and rate limits                                      |
| **Redis**      | chat-service         | Presence, online sets, user/chat participant caches                        |
| **Filesystem** | chat-service         | Uploaded attachment files (`APP_UPLOAD_DIR`)                               |


---

## Kafka

`docker-compose.yaml` runs a single-node Kafka broker (KRaft) and optional **Kafka UI** at [http://localhost:8090](http://localhost:8090).


| Topic                         | Producer     | Consumer             | Purpose                                   |
| ----------------------------- | ------------ | -------------------- | ----------------------------------------- |
| `chat.message.created.v1`     | chat-service | notification-service | Push on new message                       |
| `chat.message.reaction.v1`    | chat-service | notification-service | Push on reaction                          |
| `chat.room.member.invited.v1` | chat-service | notification-service | Push on room invite                       |
| `*.dlq`                       | —            | —                    | Dead-letter queues for failed consumption |


**Bootstrap servers:**

- Host JVM / IDE: `localhost:9092`
- Inside Docker Compose: `kafka:29092`

Topics auto-create when `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` (default). To create explicitly:

```bash
docker compose exec kafka kafka-topics --create --topic chat.message.created.v1 --bootstrap-server kafka:29092 --partitions 1 --replication-factor 1
```

---

## Docker

### Full stack

Runs infrastructure, all microservices, and the frontend (nginx on port **80**).

```bash
# Copy and adjust secrets
cp local-development.env.example .env

# Start everything
docker compose --env-file ./.env up -d --build
```


| Endpoint             | URL                                            |
| -------------------- | ---------------------------------------------- |
| Frontend             | [http://localhost](http://localhost)           |
| API gateway          | [http://localhost:8089](http://localhost:8089) |
| Eureka               | [http://localhost:8761](http://localhost:8761) |
| Kafka UI             | [http://localhost:8090](http://localhost:8090) |
| Notification service | [http://localhost:8084](http://localhost:8084) |


The frontend container proxies `/api/` to the gateway and `/ws/` to chat-service WebSocket (same-origin in production).

### Local development (infra only)

For running Java services and the Vite dev server on the host:

```bash
cp local-development.env.example .env
docker compose --env-file ./.env -f docker-compose.dev.yml -p webchatdev up -d
```

Dev compose maps non-default host ports to avoid clashes with local installs:


| Service    | Host port |
| ---------- | --------- |
| PostgreSQL | 5433      |
| MongoDB    | 27018     |
| Redis      | 6380      |
| Kafka      | 9092      |
| Eureka     | 8761      |


Optional Kafka UI: add profile `kafka-ui` to the compose command.

---

## Usage

### Prerequisites

- **JDK 21**, **Maven 3.9+**
- **Node.js 20+** and **npm** (frontend)
- **Docker** and **Docker Compose** (databases / full stack)

### Local development (recommended)

1. **Start infrastructure:**
  ```bash
   cp local-development.env.example .env
   docker compose --env-file ./.env -f docker-compose.dev.yml -p webchatdev up -d
  ```
2. **Configure environment** — `local-development.env.example` documents all variables (DB hosts, JWT secret, mail, VAPID keys, Kafka). Export them in your shell or IDE run configuration. JVM services read `${VAR}` from `application.yml`.
3. **Start backend services** (order matters loosely; Eureka first is safest):
  ```bash
   mvn -pl discovery-service spring-boot:run
   mvn -pl user-service spring-boot:run
   mvn -pl auth-service spring-boot:run
   mvn -pl chat-service spring-boot:run
   mvn -pl notification-service spring-boot:run
   mvn -pl api-gateway spring-boot:run
  ```
   Or run each module from your IDE with the same env vars.
4. **Start frontend:**
  ```bash
   cd webchat_frontend
   npm install
   npm run dev
  ```
   Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` and `/ws` to the gateway at `localhost:8089`.
5. **Build all backend modules:**
  ```bash
   mvn clean install
  ```

### Password reset email (optional)

Set `MAIL_ENABLED=true` and Gmail SMTP credentials in `.env` (`MAIL_USERNAME`, `MAIL_PASSWORD` as an [App Password](https://myaccount.google.com/apppasswords)). Set `PASSWORD_RESET_FRONTEND_URL` to your frontend origin.

### Web Push (optional)

Generate VAPID keys and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `.env` for both `notification-service` and the frontend build if testing push outside Docker.

### Testing

**Backend** (per module):

```bash
mvn -pl chat-service test
```

**Frontend unit tests:**

```bash
cd webchat_frontend
npm test
```

**Frontend E2E** (starts Vite automatically):

```bash
cd webchat_frontend
npm run test:e2e:install   # first time only
npm run test:e2e
```

---

## Project status

Core messaging, rooms, presence, contacts, rich personal-space content, reactions, polls, and push notifications are implemented. The app is actively developed; see service tests and the `webchat_frontend/e2e` suite for covered flows.