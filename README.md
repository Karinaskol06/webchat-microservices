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
