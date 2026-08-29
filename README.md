# prueba

MVP local (no publicado en GitHub). Monorepo con pnpm workspaces.

## Stack

| Capa       | Tecnología                            |
| ---------- | ------------------------------------- |
| Lenguaje   | TypeScript                            |
| Backend    | NestJS + GraphQL (code-first, Apollo) |
| Frontend   | Next.js                               |
| Base datos | MongoDB (vía Mongoose)                |
| Mapa       | Por definir con el prompt del MVP     |

## Estructura

```
backend/    NestJS API (GraphQL en /graphql)
frontend/   Next.js app
```

## Setup

```bash
pnpm install
```

Copia `backend/.env.example` a `backend/.env` y ajusta `MONGODB_URI` si tu Mongo local no corre en el default (`mongodb://localhost:27017/prueba`).

## Desarrollo

```bash
# Backend (http://localhost:3001, GraphQL playground en /graphql)
pnpm --filter backend start:dev

# Frontend (http://localhost:3000)
pnpm --filter frontend dev
```

## Calidad

```bash
pnpm format        # Prettier — todo el repo (agent_docs, README, backend/, frontend/)
pnpm format:check

pnpm --filter backend lint    # oxlint
pnpm --filter backend build   # typecheck + build
pnpm --filter backend test

pnpm --filter frontend lint   # ESLint
pnpm --filter frontend build  # typecheck + build
```

## Convenciones

Ver `CLAUDE.md` y `agent_docs/` (arquitectura hexagonal en el backend, capas + Atomic Design en el
frontend).
