# Webchat on Kubernetes (local learning path)

This folder deploys the **full** webchat stack to a **local** Kubernetes cluster.

Namespace: `webchat-dev`

## What needs to be installed

| Tool | Purpose |
|------|---------|
| Docker Desktop | Runs containers + optional K8s cluster | 
| kubectl | Talks to the cluster | 
| Kubernetes cluster | The runtime | 

---

## Architecture

| Component | Image / chart | Port (in-cluster) | Role |
|-----------|---------------|-------------------|------|
| redis | `redis:7` | 6379 | Sessions / presence / rate limits |
| postgres | `postgres:15-alpine` + PVC `postgres-data` | 5432 | user + notification DB (persisted) |
| mongo | `mongo:7` + PVC `mongo-data` | 27017 | chat messages (persisted) |
| kafka | `bitnami/kafka` (KRaft) | 29092 | notification events |
| discovery-service | `webchat/discovery-service:local` | 8761 | Eureka |
| user-service | `webchat/user-service:local` | 8081 | users / profiles |
| auth-service | `webchat/auth-service:local` | 8082 | login / JWT / password reset |
| chat-service | `webchat/chat-service:local` + PVC `chat-uploads` | 8083 | chats + WebSocket `/ws` (attachment files persisted) |
| notification-service | `webchat/notification-service:local` | 8084 | Web Push |
| api-gateway | `webchat/api-gateway:local` | 8089 | `/api/**` routing |
| frontend | `webchat/frontend:local` | 80 | nginx UI; proxies `/api` → gateway, `/ws` → chat |
| Ingress `webchat` | ingress-nginx controller | 80 (localhost) | HTTP entry → `frontend` Service |

The number of **replicas** is set to 1 for every Deployment on Docker Desktop. 
Scaling `chat-service` needs sticky sessions and a shared broker relay which is not required for learning.




---
## Deploy the full stack
### Step 1 - Namespace + secrets

```powershell
cd .
kubectl apply -f k8s/namespace.yaml
```

Secrets live in a **gitignored** file:

- File: `k8s/secrets.local.yaml` (listed in `.gitignore`)
- Name in cluster: `webchat-secrets` in namespace `webchat-dev`

ENVs `k8s/secrets.local.yaml` look like this (values replaced):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: webchat-secrets
  namespace: webchat-dev
type: Opaque
stringData:
  POSTGRES_USER: user
  POSTGRES_PASSWORD: 111
  POSTGRES_DB: db
  REDIS_PASSWORD: 111
  JWT_SECRET: randomhex
  GATEWAY_INTERNAL_AUTH_TOKEN: randomtoken
  MONGO_INITDB_ROOT_USERNAME: user
  MONGO_INITDB_ROOT_PASSWORD: 111
  MONGO_INITDB_DATABASE: db2

  # Matching pair generated with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: key
  VAPID_PRIVATE_KEY: key
  VAPID_SUBJECT: mailto:admin@webchat.local

  # Gmail SMTP
  MAIL_USERNAME: user@gmail.com
  MAIL_PASSWORD: 111
```

Should be applied (and re-applied after any edit):

```powershell
kubectl apply -f k8s/secrets.local.yaml
```

Many Deployments also need `kubectl rollout restart` to pick up new secret values.

### Step 2 - Build local images

Kubernetes runs **images**. From repo root:

```powershell
cd .

docker build -f discovery-service/Dockerfile -t webchat/discovery-service:local .
docker build -f user-service/Dockerfile -t webchat/user-service:local .
docker build -f auth-service/Dockerfile -t webchat/auth-service:local .
docker build -f chat-service/Dockerfile -t webchat/chat-service:local .
docker build -f notification-service/Dockerfile -t webchat/notification-service:local .
docker build -f api-gateway/Dockerfile -t webchat/api-gateway:local .
docker build -f webchat_frontend/Dockerfile -t webchat/frontend:local .
```

Docker Desktop Kubernetes uses the local Docker daemon (`imagePullPolicy: IfNotPresent`).

### Step 3 - Deploy in dependency order

```powershell
# Infrastructure (postgres/mongo/chat-uploads include PersistentVolumeClaims — data survives pod restarts)
kubectl apply -f k8s/redis/
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/mongo/
kubectl apply -f k8s/kafka/

kubectl wait --for=condition=ready pod -l app=postgres -n webchat-dev --timeout=180s
kubectl wait --for=condition=ready pod -l app=mongo -n webchat-dev --timeout=180s
```

`kubectl apply -f k8s/postgres/` creates both the PVC and Deployment. Same for mongo. `kubectl apply -f k8s/chat-service/` creates the `chat-uploads` PVC with the Deployment. Docker Desktop provisions the volumes automatically (default StorageClass).

**Note:** switching from `emptyDir` to a PVC recreates pods on **new** disks — old ephemeral data is not migrated. After that, crashes/restarts keep data.

```powershell
# Verify claims are Bound
kubectl get pvc -n webchat-dev

# Platform + services
kubectl apply -f k8s/discovery-service/
kubectl wait --for=condition=ready pod -l app=discovery-service -n webchat-dev --timeout=180s

kubectl apply -f k8s/user-service/
kubectl apply -f k8s/auth-service/
kubectl apply -f k8s/chat-service/
kubectl apply -f k8s/notification-service/
kubectl apply -f k8s/api-gateway/
kubectl apply -f k8s/frontend/

kubectl get pods -n webchat-dev
```

Wait until every pod is `1/1 Running`.

### Step 4 — Open the app (Ingress)

Preferred access: **Ingress** on http://localhost (no port-forward).

```powershell
kubectl apply -f k8s/ingress/
kubectl get ingress -n webchat-dev
```

Open **http://localhost**

Nginx inside the frontend pod still proxies:

- `/api/**` → `api-gateway:8089`
- `/ws/**` → `chat-service:8083`

**Fallback** (if Ingress is not ready):

```powershell
kubectl port-forward -n webchat-dev svc/frontend 8080:80
```

Then open http://localhost:8080 and set `PASSWORD_RESET_FRONTEND_URL` to match.

---

## Phase 3 — Ingress (step by step)

An Ingress is a routing rule. **Ingress controller** (nginx) listens on the host and implements those rules.

### Step 3.1 — Install ingress-nginx (once per cluster)

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml
```

### Step 3.2 — Apply the webchat Ingress

```powershell
cd .
kubectl apply -f k8s/ingress/
kubectl describe ingress webchat -n webchat-dev
```

### Step 3.3 — Align password-reset links

With Ingress, the UI is **http://localhost** (port 80). Auth Deployment should use:

```text
PASSWORD_RESET_FRONTEND_URL=http://localhost
```

```powershell
kubectl apply -f k8s/auth-service/deployment.yaml
kubectl rollout status deployment/auth-service -n webchat-dev
```

Service = stable name *inside* the cluster. 
Ingress = how HTTP from *outside* reaches a Service. 
Port-forward = temporary debug tunnel.

---

## Feature notes

### Password reset (email)

Configured on `auth-service`:

| Env | Purpose |
|-----|---------|
| `MAIL_ENABLED=true` | Send real email (otherwise the reset link is only logged) |
| `MAIL_HOST` / `MAIL_PORT` | `smtp.gmail.com` / `587` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | From `webchat-secrets` |
| `MAIL_FROM` | Sender address |
| `PASSWORD_RESET_FRONTEND_URL` | **`http://localhost`** with Ingress (or `http://localhost:8080` with port-forward) |

Reset links look like: `http://localhost/reset-password?token=...`


Use a Gmail **App Password** (Google Account - Security - 2-Step Verification - App passwords). If mail fails, check:

```powershell
kubectl logs -n webchat-dev -l app=auth-service --tail=50
```

### Web Push (VAPID)

Configured on `notification-service` via secret keys `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

1. Generate a **matching** pair: `npx web-push generate-vapid-keys`
2. Put both keys in `k8s/secrets.local.yaml` and `kubectl apply -f k8s/secrets.local.yaml`
3. Restart notification-service:
   ```powershell
   kubectl rollout restart deployment/notification-service -n webchat-dev
   ```
4. In the browser: hard refresh, allow notifications, re-login so the client re-subscribes

The recipient must have a stored subscription; the app tab should be in the background (visible tabs suppress OS notifications).

---

## Daily workflow

1. **Develop** with `docker compose` when iterating quickly  
2. **Rebuild** the changed image for K8s (`docker build ...`)  
3. **Roll out**: `kubectl rollout restart deployment/<name> -n webchat-dev`  
4. **Debug**: `kubectl logs`, `kubectl describe pod`  
5. **Ingress** at http://localhost; port-forward only as a fallback  

---

## Useful commands

```powershell
kubectl get pods -n webchat-dev
kubectl get all -n webchat-dev
kubectl logs -n webchat-dev -l app=chat-service --tail=80
kubectl logs -n webchat-dev -l app=notification-service --tail=80
kubectl describe pod -n webchat-dev -l app=auth-service
kubectl rollout status deployment/frontend -n webchat-dev
kubectl rollout undo deployment/chat-service -n webchat-dev
kubectl delete namespace webchat-dev  
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `connection refused` on kubectl | Enable Kubernetes in Docker Desktop |
| `ImagePullBackOff` | Build the image with the exact tag in the Deployment YAML |
| `CreateContainerConfigError` / missing secret key | Re-apply `k8s/secrets.local.yaml`; ensure every key the Deployment references exists |
| `CrashLoopBackOff` on Redis/Kafka port binding | Deployments use `enableServiceLinks: false` and explicit `REDIS_PORT` / Kafka ports — do not remove those |
| Auth mail not sending | Confirm live Deployment has `MAIL_*` envs; restart after secret/deploy changes; verify Gmail App Password |
| Push: keys do not match | Regenerate VAPID pair, apply secret, restart notification-service, re-subscribe in browser |
| Push: `UnknownHostException: fcm.googleapis.com` | Cluster DNS/egress glitch — retry; check CoreDNS / host network |
| Push: `No push subscriptions for recipient` | That user never completed push subscribe (login + permission on their browser) |
| Pod pending | `kubectl describe pod` — often CPU/memory pressure on Docker Desktop |
| UI blank / API fails | Check Ingress (`kubectl get ingress -n webchat-dev`) or fall back to port-forward |
| `404` / connection refused on http://localhost | Ingress controller not ready — finish Phase 3.1; check `kubectl get svc -n ingress-nginx` |
| Port 80 already in use on Windows | Stop the other app using :80, or keep using port-forward on :8080 |
| WebSocket drops via Ingress | Ingress has long proxy timeouts; confirm `/ws` still works through frontend nginx |
