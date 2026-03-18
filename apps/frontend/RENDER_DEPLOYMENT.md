# Render Deployment - Frontend (Next.js)

This is a **Next.js** app. It does NOT use `dist/index.js` — that path is for Node/Express backends.

## Correct Render Settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/frontend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

## What Each Command Does

- **Build**: `next build` → creates `.next/` folder (not `dist/`)
- **Start**: `npm start` → runs `next start` (production server)

Next.js automatically binds to `process.env.PORT` when set by Render.

## Environment Variables

API calls use same-domain relative routing (`/api`). Ensure your deployment proxies `/api` to the backend, or configure rewrites as needed.

## Using Blueprint

Alternatively, use the `render.yaml` at the project root for Infrastructure as Code deployment.
