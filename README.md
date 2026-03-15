# Solar Quotation App

Production-ready monorepo with Next.js frontend, Node.js backend, PostgreSQL, and role-based auth (admin, sales).

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: JWT with role-based access (ADMIN, SALES)

## Project Structure

```
├── apps/
│   ├── backend/           # Node.js API
│   │   ├── prisma/        # Schema, migrations, seed
│   │   └── src/
│   │       ├── config/    # Environment config
│   │       ├── middleware/# Auth, roles, error handling
│   │       ├── routes/    # API routes
│   │       ├── services/  # Business logic
│   │       └── types/     # Shared types
│   └── frontend/          # Next.js app
│       └── src/
│           ├── app/       # App Router pages
│           ├── components/
│           ├── contexts/  # Auth context
│           ├── lib/       # API client, utils
│           └── types/
├── packages/              # Shared packages (optional)
├── docker-compose.yml     # PostgreSQL
└── package.json           # Workspace root
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL, JWT_SECRET
```

Example `.env`:

```
DATABASE_URL="postgresql://solar:solar@localhost:5432/solar_quotation"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 4. Run migrations and seed

```bash
npm run db:migrate
npm run db:seed -w backend
```

### 5. Start development servers

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

### Seed users

| Email           | Password  | Role  |
|-----------------|-----------|-------|
| admin@solar.com | Admin123! | ADMIN |
| sales@solar.com | Admin123! | SALES |

## Scripts

| Command       | Description                    |
|---------------|--------------------------------|
| `npm run dev` | Start both frontend & backend  |
| `npm run build` | Build production artifacts   |
| `npm run db:migrate` | Run Prisma migrations  |
| `npm run db:seed` | Seed database with test users |
| `npm run db:studio` | Open Prisma Studio (in backend) |

## Auth & Roles

- **ADMIN**: Full access; can register new users (admin or sales).
- **SALES**: Standard access; authenticated routes.
- JWT stored in `localStorage`; sent via `Authorization: Bearer <token>`.
- Protected routes use `authenticate` + `requireRoles` middleware on backend.

## API Endpoints

| Method | Endpoint      | Auth    | Roles | Description       |
|--------|---------------|---------|-------|-------------------|
| POST   | /api/auth/login | No    | -     | Login             |
| POST   | /api/auth/register | Yes | ADMIN | Create new user   |
| GET    | /api/auth/me  | Yes     | -     | Current user      |
| GET    | /api/health   | No      | -     | Health check      |
