# QA Platform

**End-to-end design-to-deployment quality assurance automation.**

One platform that covers the full lifecycle: **Figma → Code → Test → QA → Deploy**.

---

## What it does

| Module | Tools | Output |
|--------|-------|--------|
| Figma Ingestion | Figma REST API | Design schema JSON + screenshots |
| AI Code Generation | Claude API | React + Tailwind components |
| Visual Regression | Playwright + pixelmatch | Pixel-diff reports |
| Accessibility | axe-core | WCAG AA compliance report |
| Performance | Lighthouse CI (CDP) | LCP, CLS, TTI metrics |
| Security | OWASP ZAP + passive headers | Vulnerability report |
| Code Quality | SonarQube integration | Smells, coverage, duplication |
| Reporting | Claude AI + Jira | Unified HTML/JSON report + tickets |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                  │
│          Dashboard / Projects / Reports / Live Status        │
└────────────────────────┬────────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                    API Gateway (NestJS)                      │
│        Auth · Projects · Runs · Reports · WebSocket          │
└──┬──────────┬──────────┬──────────┬────────────┬────────────┘
   │          │          │          │            │
   ▼          ▼          ▼          ▼            ▼
Figma    Codegen    Testing    Security    Reporting
Service  Service    Service    Service     Service
   │          │          │          │            │
   └──────────┴──────────┴──────────┴────────────┘
                          │
                    ┌─────▼──────┐
                    │ Bull Queue │
                    │  (Redis)   │
                    └─────┬──────┘
                          │
              ┌───────────┴──────────┐
              ▼                      ▼
         PostgreSQL                 S3/MinIO
       (Projects, Runs)          (Screenshots,
        Issues, Reports)          Reports, Assets)
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Figma Personal Access Token

### 1. Clone and install

```bash
git clone https://github.com/your-org/saas-qa-platform.git
cd saas-qa-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your API keys:
# - ANTHROPIC_API_KEY (required for code gen + AI fixes)
# - FIGMA_API_BASE_TOKEN (optional, can be set per-project)
# - JWT_SECRET (change for production!)
```

### 3. Start with Docker Compose

```bash
# Start all infrastructure (postgres, redis, minio, zap)
npm run docker:up

# Or start everything including app services
docker-compose up -d

# View logs
docker-compose logs -f api-gateway
```

### 4. Run database migrations

```bash
npm run db:migrate
npm run db:seed
```

### 5. Start in development

```bash
npm run dev
```

Services start at:
| Service | URL |
|---------|-----|
| Web Dashboard | http://localhost:3000 |
| API Gateway | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| Figma Service | http://localhost:4001 |
| Codegen Service | http://localhost:4002 |
| Testing Service | http://localhost:4003 |
| Security Service | http://localhost:4004 |
| Reporting Service | http://localhost:4005 |
| MinIO Console | http://localhost:9001 |

---

## Typical Flow

```
1. Register at http://localhost:3000
2. Create a project → paste Figma URL + Personal Access Token
3. Click "Run" → pipeline starts automatically:
   ┌─ figma_ingestion   Parse design, capture screenshots
   ├─ code_generation   Claude AI generates React components
   ├─ deployment        Deploy preview to sandbox URL
   ├─ visual_regression Playwright pixel-diff vs Figma
   ├─ accessibility     axe-core WCAG AA checks
   ├─ performance       Lighthouse LCP/CLS/TTI
   ├─ security          OWASP ZAP + header checks
   ├─ code_quality      SonarQube analysis
   └─ report_generation HTML report + AI fix suggestions
4. View QA report with scores, diffs, issues
5. Jira tickets auto-created for critical/high issues
```

---

## API Reference

Full Swagger UI at `/api/docs`. Key endpoints:

### Auth
```
POST /api/v1/auth/register   Register organization + admin user
POST /api/v1/auth/login      Login → { accessToken, refreshToken }
POST /api/v1/auth/refresh    Refresh access token
GET  /api/v1/auth/me         Current user
```

### Projects
```
GET    /api/v1/projects         List projects
POST   /api/v1/projects         Create project
GET    /api/v1/projects/:id     Get project details
PATCH  /api/v1/projects/:id     Update project settings
DELETE /api/v1/projects/:id     Archive project
POST   /api/v1/projects/:id/runs  Trigger test run
```

### Runs
```
GET  /api/v1/runs        List all runs (paginated)
GET  /api/v1/runs/:id    Get run with stages + issues
POST /api/v1/runs/:id/cancel  Cancel a running run
```

### Reports
```
GET /api/v1/reports/runs/:runId          Report for a run
GET /api/v1/reports/projects/:projectId  All reports for a project
```

### WebSocket
```
Connect to: ws://localhost:4000/runs

Events to emit:
  subscribe:run     { runId }      → subscribe to run updates
  subscribe:project { projectId }  → subscribe to project updates

Events received:
  run:update    { status }
  stage:update  { stageType, status, durationMs }
  run:completed { runId, summary }
```

---

## Project Structure

```
saas-qa-platform/
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── api-gateway/            # NestJS API gateway + Bull queue
│   ├── figma-service/          # Figma API + screenshot capture
│   ├── codegen-service/        # Claude AI → React code gen
│   ├── testing-service/        # Visual, a11y, perf, functional
│   ├── security-service/       # OWASP ZAP + header checks
│   └── reporting-service/      # Report gen + Jira integration
├── packages/
│   ├── shared-types/           # TypeScript types shared across all services
│   └── shared-utils/           # Utility functions, logger, score helpers
├── infrastructure/
│   ├── terraform/              # AWS VPC, RDS, ElastiCache, ECS, S3, ECR
│   ├── kubernetes/             # K8s Deployments, Services, Ingress, HPA
│   └── docker/                 # Nginx config
├── .github/workflows/
│   ├── ci.yml                  # PR: lint, test, build
│   ├── cd.yml                  # main: build, push ECR, deploy K8s
│   └── security.yml            # Scheduled: npm audit, CodeQL, Trivy
├── docker-compose.yml          # Full local dev stack
├── turbo.json                  # Turborepo pipeline
└── .env.example                # Environment variable template
```

---

## Configuration

### Project Settings (per project)

```json
{
  "autoRunOnFigmaUpdate": true,
  "autoRunOnPush": false,
  "enabledTests": {
    "visual": true,
    "functional": true,
    "accessibility": true,
    "performance": true,
    "security": true,
    "codeQuality": true
  },
  "thresholds": {
    "visualMatchPercent": 90,
    "accessibilityScore": 85,
    "performanceScore": 75,
    "securityScore": 90,
    "codeQualityRating": "B"
  }
}
```

### QA Score Weights

| Dimension | Weight |
|-----------|--------|
| Visual Match | 25% |
| Accessibility | 20% |
| Performance | 20% |
| Security | 20% |
| Code Quality | 15% |

---

## Deployment

### AWS (Terraform + ECS/EKS)

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan
terraform plan -var="db_password=yourpassword" -var="domain_name=your-domain.com"

# Apply
terraform apply

# Get ECR registry
terraform output ecr_registry
```

### GitHub Actions CD

1. Set repository secrets:
   - `AWS_ROLE_ARN` — IAM role for OIDC
   - `ECR_REGISTRY` — from `terraform output ecr_registry`
   - `EKS_CLUSTER_NAME` — your EKS cluster name
   - `DATABASE_URL` — production DB connection string
   - `SLACK_WEBHOOK_URL` (optional)

2. Push to `main` → automatic build + deploy

---

## Development Tips

### Running a single service
```bash
npm run dev --workspace=@qa-platform/api-gateway
npm run dev --workspace=@qa-platform/web
```

### Watching logs
```bash
docker-compose logs -f figma-service codegen-service
```

### Running tests locally
```bash
# All tests
npm run test

# Single service
npm run test --workspace=@qa-platform/api-gateway

# With coverage
npm run test -- --coverage
```

### Connecting to local postgres
```bash
docker exec -it qa-postgres psql -U qaplatform -d qaplatform
```

### MinIO browser (S3 UI)
Open http://localhost:9001 → login: `minioadmin` / `minioadmin`

---

## Tech Stack

**Frontend:** Next.js 14, React 18, TailwindCSS, Zustand, TanStack Query, Socket.io-client, Recharts

**Backend:** NestJS, Prisma, Bull (Redis queues), Passport JWT, Socket.io, Swagger

**Testing:** Playwright, axe-core, pixelmatch, OWASP ZAP

**AI:** Anthropic Claude API (code gen + fix suggestions)

**Infrastructure:** PostgreSQL 16, Redis 7, MinIO (S3-compatible), OWASP ZAP

**DevOps:** Docker, Turborepo, GitHub Actions, Terraform, Kubernetes, AWS ECS/EKS

---

## License

MIT
