# Jenkins CI/CD for webchat

This document describes how Jenkins is integrated into the WebChat microservices project: the architectural choices, how the pieces connect, and how the pipeline behaves.

Related files:

| File | Role |
|------|------|
| [`jenkins/Dockerfile`](Dockerfile) | Custom Jenkins controller image |
| [`jenkins/docker-compose.yml`](docker-compose.yml) | How Jenkins runs on Docker Desktop |
| [`Jenkinsfile`](../Jenkinsfile) | Declarative pipeline (Pipeline as Code) |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | GitHub Actions CI on pull requests |
| [`k8s/README-k8s.md`](../k8s/README-k8s.md) | Local Kubernetes stack |

Jenkins UI (when running): **http://localhost:8080**

---

## 1. Goals

The webchat stack is a Spring Cloud microservices backend, a React frontend, and a full local Kubernetes deployment (`webchat-dev`). CI/CD was added to:

1. **Automate quality gates** — run backend and frontend tests on every branch that contains a `Jenkinsfile`.
2. **Build immutable Docker artifacts** — one image per service, tagged by build number.
3. **Deploy to local Kubernetes** — restart application Deployments after a successful build on protected branches.
4. **Practice production patterns** — Pipeline as Code, credentials, registry push (GHCR), parallel builds, and a split between CI tooling (GitHub Actions) and self-hosted CD (Jenkins).

This is intentionally a **local lab** on one machine (Docker Desktop + Kubernetes). The same concepts map to cloud setups (EKS + ECR + separate Jenkins agents), but the implementation is simplified so the full path can be exercised without cloud cost.

---

## 2. Overall architecture

```text
Developer
   │
   │  git push
   ▼
GitHub (webchat-microservices)
   │
   ├──────────────────────────────────────┐
   │                                      │
   ▼                                      ▼
GitHub Actions (hosted)              Jenkins (local)
   │  PR / push to main                   │  Multibranch Pipeline
   │  webhook (instant)                   │  poll or manual scan
   ▼                                      ▼
   CI: test, lint, build images           CI: mvn test, npm lint/test
   Push to GHCR on main                   Parallel docker build
                                          Push GHCR (main branches)
                                          CD: kubectl rollout restart
   │                                      │
   └────────────── images ────────────────┘
                         │
                         ▼
              Docker Desktop (single daemon)
                         │
                         ▼
              Kubernetes namespace webchat-dev
                         │
                         ▼
              http://localhost (Ingress → frontend)
```

### Why two CI systems?

| Tool | Responsibility | Rationale |
|------|----------------|-----------|
| **GitHub Actions** | CI on every PR and push to `main` | Fast feedback via webhooks; no need to expose local Jenkins to the internet; publishes images to GHCR on `main`. |
| **Jenkins** | Full pipeline including **CD to local K8s** | Self-hosted controller; demonstrates Multibranch Pipeline, Declarative `Jenkinsfile`, credentials, and `kubectl` deploy. |

This project keeps both to show understanding of each model.

---

## 3. Key design decisions

### 3.1 Jenkins as a Docker container on the developer machine

**Choice:** Run Jenkins via Docker Compose on the same host as Docker Desktop Kubernetes.

**Why:**

- Zero extra servers; images built by Jenkins land on the **same Docker daemon** that K8s uses (`imagePullPolicy: IfNotPresent`, tag `:local`).
- Reproducible setup: `Dockerfile` + `docker-compose.yml` in the repo.
- Matches how many teams run a small self-hosted controller.

**Tradeoff:** The controller also acts as the build **agent** (built-in node). In production, builds run on separate agents for security and scale; the `Jenkinsfile` would use `agent { label 'docker' }` instead of `agent any`.

### 3.2 Custom Jenkins image

**Base:** `jenkins/jenkins:lts-jdk21` (aligned with Java 21 in the project).

**Added tooling:**

| Tool | Purpose |
|------|---------|
| Docker CLI | Build images via mounted host socket (no second daemon) |
| kubectl | Deploy to Docker Desktop Kubernetes |
| Maven | `mvn -B test` in pipeline |
| Node.js 20 | Frontend lint and Vitest |


### 3.3 Docker socket mount (local-only pattern)

```yaml
- //var/run/docker.sock:/var/run/docker.sock
```

When the pipeline runs `docker build`, it talks to **Docker Desktop’s daemon**, not an isolated Docker inside Jenkins. Built images are immediately visible to the local Kubernetes cluster.

**Production equivalent:** CI agents build and **push to a registry** (GHCR, ECR); cluster nodes **pull** images. The socket mount is a lab shortcut.

### 3.4 Pipeline as Code (`Jenkinsfile` at repo root)

The pipeline is versioned with the application. Jenkins discovers changes via a **Multibranch Pipeline** job that scans branches containing `Jenkinsfile`.

### 3.5 Branch-based deploy gate

| Stage | Runs on |
|-------|---------|
| Backend Test, Frontend Test, Docker Build | Every branch with `Jenkinsfile` |
| Push GHCR, Deploy | `main`, `master`, `cicd-processes` only |

Feature branches get **CI only** (tests + image build). Deploy and registry push run only when merging to integration branches.

### 3.6 Image tagging strategy

Each service image receives three tags per build:

| Tag | Example | Use |
|-----|---------|-----|
| `:local` | `webchat/chat-service:local` | Local K8s Deployments (fixed name, new layers on rebuild) |
| `:b<N>` | `webchat/chat-service:b42` | Immutable local rollback reference |
| GHCR `:b<N>` / `:latest` | `ghcr.io/karinaskol06/webchat-chat-service:b42` | Registry handoff (cloud-style; same as ECR pattern on AWS) |


---

## 4. Jenkins infrastructure

### 4.1 Container layout

```text
Host (Windows + Docker Desktop)
├── webchat-jenkins container
│   ├── Jenkins controller (UI, job scheduling)
│   ├── Built-in agent (runs pipeline steps)
│   ├── docker CLI  socket -> host Docker daemon
│   └── kubectl     kubeconfig -> Docker Desktop K8s
└── Volume jenkins_home -> /var/jenkins_home (jobs, plugins, credentials metadata)
```

Port **8080** serves the UI. Port **50000** is reserved for inbound agents (future Phase: separate agent container).

### 4.2 Persistence

Jenkins state lives in the named volume `jenkins_home`, mapped to `/var/jenkins_home` inside the container. Jobs, plugins, and credential *references* survive `docker compose down`. Destroying the volume (`docker compose down -v`) resets Jenkins to a fresh install.

### 4.3 Credentials model (least privilege)

| Secret | Stored in | Used for |
|--------|-----------|----------|
| GitHub PAT | Jenkins Credentials (`github-webchat-pat`) | Clone private repo in Multibranch job |
| GHCR PAT | Jenkins Credentials (`ghcr-webchat`) | `docker login` + push in Push GHCR stage |
| JWT, DB, mail, VAPID | Kubernetes Secret `webchat-secrets` | Application pods only — **not** in Jenkins |

Jenkins needs permission to build, push images, and call `kubectl`; it does not need application runtime secrets.

---

## 5. Pipeline stages (Jenkinsfile)

```text
Backend Test ──► Frontend Test ──► Docker Build (×7 parallel)
                                        │
                    ┌───────────────────┴────────────────────┐
                    │  (only main / master / cicd-processes) │
                    ▼                                        ▼
              Push GHCR                              Deploy (kubectl)
```

### Quality gates

Stages run **sequentially**. If `mvn test` or frontend lint/tests fail, later stages do not run.

### Backend Test

- Command: `mvn -B test` from repo root (all Maven modules).
- Includes unit tests and Spring tests configured in the `test` phase.
- On failure, Surefire reports are archived as Jenkins artifacts.

### Frontend Test

- Working directory: `webchat_frontend`.
- Steps: `npm ci`, `npm run lint`, `npm test` (Vitest).

### Docker Build

- Parallel build of all seven images using each service’s Dockerfile.
- Context is repo root for Java services, `webchat_frontend` for the frontend.

### Push GHCR

- Logs in with credential `ghcr-webchat`.
- Pushes `b${BUILD_NUMBER}` and `latest` for each service.
- Demonstrates registry handoff; local Deploy still uses `:local` tags on the shared daemon.

### Deploy

- `kubectl rollout restart` for application Deployments in `webchat-dev`.
- `kubectl rollout status` with 180s timeout per Deployment.
- Idempotent: safe to re-run the pipeline; Kubernetes reconciles to the desired state.

---

## 6. Multibranch Pipeline job

Jenkins is configured with a **Multibranch Pipeline** job pointing at the GitHub repository:

1. **Branch Sources** — Git URL + credential `github-webchat-pat`.
2. **Build configuration** — by `Jenkinsfile` at repository root.
3. **Scan** — periodic (e.g. every 2–5 minutes) because local Jenkins has no public URL for GitHub webhooks.

Each branch that contains `Jenkinsfile` gets its own job (`main`, `cicd-processes`, `feature/...`).

---

## 7. End-to-end developer workflow

```text
1. Develop on a feature branch
2. git push
3. Jenkins scans -> runs Backend Test -> Frontend Test -> Docker Build
4. Merge to main / cicd-processes
5. Pipeline adds Push GHCR + Deploy
6. New images on Docker Desktop; pods restart
7. User opens http://localhost and sees the update (page reload; WebSocket may reconnect)
```

GitHub Actions runs in parallel on PRs for hosted CI and GHCR publish on `main`. Jenkins owns the **local CD** story.

---

## 8. Local lab vs production

| Aspect | This project (lab) | Typical production |
|--------|--------------------|--------------------|
| Jenkins location | Docker on developer PC | VM or cloud (always-on URL) |
| Build agent | Built-in node (same container) | Separate VMs / K8s pods |
| Image delivery | Shared Docker daemon + `:local` | Push to ECR/GHCR; cluster pulls |
| Deploy target | Docker Desktop `webchat-dev` | EKS / AKS / GKE staging/prod |
| Trigger | SCM polling | GitHub webhook |
| Secrets | Personal kubeconfig + Jenkins Credentials | IRSA, Vault, sealed secrets |
| Blast radius | Docker socket on controller | Restricted agents, no socket on controller |

The **pipeline structure** (test -> build -> push -> deploy) stays the same; only infrastructure and credentials change.

---

## 9. Operations reference

### Start Jenkins

```powershell
cd C:\Java\webchat\jenkins
docker compose up -d --build
```

### Verify tooling inside the container

```powershell
docker exec webchat-jenkins mvn -version
docker exec webchat-jenkins node -v
docker exec -u jenkins webchat-jenkins kubectl get pods -n webchat-dev
```

### Stop / restart

```powershell
docker compose stop          # stop container, keep volume
docker compose start         # start again
docker compose down          # remove container, keep volume
docker compose down -v       # remove container AND Jenkins data (fresh install)
```

### If Deploy finds no pods

Deployments may be scaled to zero. Scale up:

```powershell
kubectl get deployment -n webchat-dev -o name | ForEach-Object { kubectl scale $_ --replicas=1 -n webchat-dev }
```

### Required Jenkins plugins

Pipeline, Git, GitHub Branch Source (or Git), Pipeline: Stage View, Credentials Binding. Installed via **Manage Jenkins -> Plugins** during first setup.

### Required Jenkins credentials

| ID | Kind | Purpose |
|----|------|---------|
| `github-webchat-pat` | Username + password (PAT) | Clone repository |
| `ghcr-webchat` | Username + password (PAT with `write:packages`) | Push to GHCR |

---

## 10. Summary

Jenkins in this project is a **self-hosted Declarative pipeline** that complements **GitHub Actions**: Actions provides fast PR CI and GHCR publish; Jenkins demonstrates Multibranch workflows, parallel image builds, registry push, and **Continuous Deployment** to a local Kubernetes namespace. The setup deliberately uses Docker Desktop integration (socket mount, `:local` tags, mounted kubeconfig) as a learning path toward cloud patterns (registry + EKS + separate agents) without changing the fundamental CI/CD stages.
