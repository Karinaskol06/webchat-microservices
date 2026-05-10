# WebChat Application
## Overview :octocat:
A real-time chat application built with microservices architecture. Users can register, login, and exchange messages in real-time. Currently in active development with core features being implemented.

## Architecture
This project follows microservices architecture with the following components:
```text
webchat-microservices/
├── api-gateway/               # Spring Cloud Gateway (PORT: 8089)
│   ├── src/
│   └── pom.xml
│
├── auth-service/              # Authentication service (PORT: 8082)
│   ├── src/
│   └── pom.xml
│
├── chat-service/              # Chat logic + WebSocket (PORT: 8083)
│   ├── src/
│   └── pom.xml
│
├── discovery-service/         # Eureka service registry (PORT: 8761)
│   ├── src/
│   └── pom.xml
│
├── user-service/              # User management (PORT: 8081)
│   ├── src/
│   └── pom.xml
│
├── shared-module/             # Shared DTOs and utilities
│   ├── src/
│   └── pom.xml
│
├── webchat_frontend/          # React frontend (PORT: 5173)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── docker-compose.yaml        # Docker setup
├── README.md
└── pom.xml                    # Parent POM (shared dependencies)
```


## 🛠 Technology Stack
### Backend (In Development)
- Java 17 - Core language
- Spring Boot 3.2 - Application framework
- Spring Cloud - Microservices tools (Gateway, Eureka)
- Spring Security + JWT - Authentication
- WebSocket + STOMP - Real-time messaging
- PostgreSQL - Database for user info storage
- MongoDB - Database for chats and messages storage
- Redis - Presence tracking, real-time status, caching
- Maven - Dependency management

### Frontend (In Development)
- React 18 - UI library
- Material-UI (MUI) - Component library
- Zustand - State management
- STOMP.js + SockJS - WebSocket client

## Kafka (Docker Compose)

`docker-compose.yaml` includes a single-node Kafka broker (KRaft mode) plus optional `kafka-ui` for local debugging.

- Kafka broker host port: `localhost:9092`
- Kafka broker container address (inside Docker network): `kafka:29092`
- Kafka UI: [http://localhost:8090](http://localhost:8090)

Use bootstrap servers based on where the service runs:

- Services running on your host machine (IDE/local JVM): `SPRING_KAFKA_BOOTSTRAP_SERVERS=localhost:9092`
- Services running inside Docker Compose: `SPRING_KAFKA_BOOTSTRAP_SERVERS=kafka:29092`

Recommended Kafka env vars for upcoming producers/consumers:

- `SPRING_KAFKA_BOOTSTRAP_SERVERS`
- `SPRING_KAFKA_CONSUMER_GROUP_ID` (example: `notification-service`)
- `KAFKA_TOPIC_MESSAGE_CREATED` (example: `chat.message.created.v1`)
- `KAFKA_TOPIC_MESSAGE_CREATED_DLQ` (example: `chat.message.created.v1.dlq`)

### Topic creation (dev)

Two supported options:

1. **Auto-create (default in compose)**: keep `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` and let topics be created when first used.
2. **Explicit creation**: create topics manually from the Kafka container:

```bash
docker compose exec kafka kafka-topics --create --topic chat.message.created.v1 --bootstrap-server kafka:29092 --partitions 1 --replication-factor 1
docker compose exec kafka kafka-topics --create --topic chat.message.created.v1.dlq --bootstrap-server kafka:29092 --partitions 1 --replication-factor 1
```

## :game_die: Current Features

### User Authentication
- Registration with form validation
- Login with JWT token generation
- Password encryption using BCrypt

### Microservices Infrastructure
- Service discovery with Eureka
- API Gateway routing configuration
- Inter-service communication via Feign Client
- Centralized configuration management

### Chat Basics
- Create private chats between users
- Send and receive messages in real-time
- Message persistence in MongoDB
- Basic REST endpoints for chat operations

### Real-time Features
- WebSocket connection establishment
- STOMP protocol integration
- Real-time message delivery
- Connection lifecycle management
- Real-time typing indicators
- Online/offline presence
- Read receipts

### Frontend
- Login and registration pages
- Chat list view with active conversations
- Message history display
- Basic UI components with Material-UI
- Emoji support
