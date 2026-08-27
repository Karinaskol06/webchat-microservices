# Sequence — send message → real-time + push

Happy path after the sender is already authenticated (JWT in browser).

```mermaid
sequenceDiagram
    autonumber
    actor User as Browser
    participant GW as api-gateway
    participant Chat as chat-service
    participant Mongo as MongoDB
    participant WS as STOMP subscribers
    participant Kafka as Kafka
    participant Notify as notification-service
    participant Push as Web Push

    Note over User,GW: Browser already holds a JWT from login
    User->>GW: POST /api/chat/.../messages<br/>(Authorization Bearer JWT)
    GW->>GW: Validate JWT, strip client X-User-*, stamp X-User-Id + X-Gateway-Auth
    GW->>Chat: Forward with trusted headers
    Chat->>Chat: Authorize membership / room rules
    Chat->>Mongo: Persist message
    Chat-->>WS: Publish to /topic/chat/{id}/messages
    Chat->>Kafka: Produce chat.message.created.v1
    Chat-->>GW: 200 Message DTO
    GW-->>User: 200 Message DTO
    Kafka-->>Notify: Consume event
    Notify->>Notify: Idempotent delivery row
    Notify->>Push: Send to offline recipients
    Push-->>User: Service worker notification (if subscribed)
```

WebSocket delivery and Kafka publication are sequential fan-out from chat-service after persist (same request path), not a classic Observer framework.
