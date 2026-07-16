# Webchat on Kubernetes (local learning path)

This folder deploys the webchat stack to a **local** Kubernetes cluster (Docker Desktop or minikube).

## What needs to be installed

| Tool | Purpose |
|------|---------|
| Docker Desktop | Runs containers + optional K8s cluster | 
| kubectl | Talks to the cluster | 
| Kubernetes cluster | The runtime | 

## Phase 1 — Foundations (do this first)

### Step 1.1 — Enable a local cluster

**Docker Desktop (recommended on Windows):**

1. Open **Docker Desktop**
2. **Settings → Kubernetes**
3. Enable **Kubernetes** → **Apply & restart**
4. Wait until status shows **Kubernetes is running**

**Verify:**

```powershell
kubectl config current-context
# expected: docker-desktop

kubectl get nodes
# expected: docker-desktop   Ready
```

**Theory:** `kubectl` is only the remote control. Without a running cluster, every command fails with "connection refused".
---
### Step 1.2 — Learn core objects with a demo app

```powershell
cd C:\Java\webchat
kubectl apply -f k8s/learning/nginx-demo.yaml
kubectl get pods -n webchat-dev
kubectl get svc -n webchat-dev
kubectl port-forward -n webchat-dev svc/nginx-demo 8080:80
```

Open http://localhost:8080 — you should see the nginx welcome page.

**Explore (mental model):**

```powershell
kubectl describe pod -n webchat-dev -l app=nginx-demo
kubectl logs -n webchat-dev -l app=nginx-demo
kubectl delete pod -n webchat-dev -l app=nginx-demo   # watch it come back!
kubectl get pods -n webchat-dev -w
```

| Object | Role |
|--------|------|
| **Namespace** `webchat-dev` | Isolates this project |
| **Deployment** | Keeps N identical pods running |
| **Pod** | One or more containers (the actual running unit) |
| **Service** | Stable DNS name + load balancing to pods |

**Cleanup demo (optional):**

```powershell
kubectl delete -f k8s/learning/nginx-demo.yaml
```

---

## Phase 2 — Deploy webchat services (incremental)

Deploy in order. Each layer depends on the previous one.

| Step | Component | Why |
|------|-----------|-----|
| 2.1 | Namespace + secrets | Isolation and credentials |
| 2.2 | Redis | Simple stateful dependency |
| 2.3 | Postgres | user-service DB |
| 2.4 | discovery-service | Eureka (same as docker-compose) |
| 2.5 | user-service | First Spring Boot microservice |

Later (not in this starter set): auth-service, chat-service, mongodb, kafka, api-gateway, frontend.

### Step 2.1 — Create namespace and secrets

```powershell
kubectl apply -f k8s/namespace.yaml
```

Create secrets from your local `.env` values (same as docker-compose):

```powershell
# Copy the example and edit values, OR run:
kubectl create secret generic webchat-secrets -n webchat-dev `
  --from-literal=POSTGRES_USER=your_user `
  --from-literal=POSTGRES_PASSWORD=your_password `
  --from-literal=POSTGRES_DB=your_db `
  --from-literal=REDIS_PASSWORD=your_redis_password `
  --from-literal=JWT_SECRET=your_jwt_secret `
  --dry-run=client -o yaml | kubectl apply -f -
```

**Theory:** Secrets are injected into pods as environment variables. Never commit real secrets to git.

### Step 2.2 — Build local Docker images

Kubernetes runs **images**, not your source code. Build from repo root:

```powershell
cd C:\Java\webchat
docker build -f discovery-service/Dockerfile -t webchat/discovery-service:local .
docker build -f user-service/Dockerfile -t webchat/user-service:local .
```

Docker Desktop Kubernetes uses images from your local Docker daemon (`imagePullPolicy: IfNotPresent`).

### Step 2.3 — Deploy infrastructure

```powershell
kubectl apply -f k8s/redis/
kubectl apply -f k8s/postgres/
kubectl wait --for=condition=ready pod -l app=redis -n webchat-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=postgres -n webchat-dev --timeout=180s
```

### Step 2.4 — Deploy microservices

```powershell
kubectl apply -f k8s/discovery-service/
kubectl wait --for=condition=ready pod -l app=discovery-service -n webchat-dev --timeout=180s

kubectl apply -f k8s/user-service/
kubectl get pods -n webchat-dev -w
```

### Step 2.5 — Verify user-service

```powershell
kubectl get all -n webchat-dev
kubectl logs -n webchat-dev -l app=user-service --tail=50
kubectl port-forward -n webchat-dev svc/user-service 8081:8081
```

In another terminal:

```powershell
curl http://localhost:8081/actuator/health
```

---

## Daily workflow (after K8s is set up)

1. **Develop** with `docker compose` (fast iteration)
2. **Rebuild** image when testing on K8s: `docker build ...`
3. **Rollout** update: `kubectl rollout restart deployment/user-service -n webchat-dev`
4. **Debug**: `kubectl logs`, `kubectl describe pod`

---

## Useful commands

```powershell
kubectl get pods -n webchat-dev
kubectl describe deployment user-service -n webchat-dev
kubectl rollout status deployment/user-service -n webchat-dev
kubectl rollout undo deployment/user-service -n webchat-dev
kubectl delete namespace webchat-dev   # removes everything in the namespace
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `connection refused` on kubectl | Enable Kubernetes in Docker Desktop |
| `ImagePullBackOff` | Build the image locally with the tag in the YAML |
| `CrashLoopBackOff` | `kubectl logs` and `kubectl describe pod` |
| Pod pending | `kubectl describe pod` — often CPU/memory or PVC |
