# Local launch scripts

PowerShell helpers for two run modes. Prefer documenting commands from the root [README](../README.md); these scripts wrap the same flows.

## Modes

| Mode | Env file | What runs |
|------|----------|-----------|
| **modeA** | `.env.modeA` (gitignored) | Full stack via `docker-compose.yaml` |
| **modeB** | `.env.modeB` (gitignored) | Infra via `docker-compose.dev.yml` + JVM services via `mvn spring-boot:run` (logs under `logs/`) |

Copy from `local-development.env.example` into `.env.modeA` / `.env.modeB` before first use.

## Commands

From repo root:

```powershell
# Full Docker stack
.\scripts\start-modeA.ps1
.\scripts\status-modeA.ps1
.\scripts\stop-modeA.ps1

# Infra in Docker + Java services on the host
.\scripts\start-modeB.ps1
.\scripts\status-modeB.ps1
.\scripts\stop-modeB.ps1
```

Or call the shared entrypoint:

```powershell
.\scripts\run-webchat.ps1 -Mode modeB -Action up
.\scripts\run-webchat.ps1 -Mode modeB -Action status
.\scripts\run-webchat.ps1 -Mode modeB -Action down
```

Mode B starts `user-service`, `auth-service`, `chat-service`, `notification-service`, and `api-gateway`. Start `discovery-service` separately if Eureka is not already up from compose.
