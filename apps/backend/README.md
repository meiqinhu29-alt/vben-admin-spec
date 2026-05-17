# @vben/backend

NestJS REST API for the shop bookkeeping system. Provides authentication, user info, and role-based menu/permission endpoints.

## Local development

1. Start dev databases:
   ```bash
   docker compose -f ../../docker-compose.dev.yml up -d
   ```

2. Set env (first time only):
   ```bash
   cp .env.example .env
   ```

3. Apply migrations and seed admin:
   ```bash
   pnpm prisma:migrate:dev
   pnpm prisma:seed
   ```

4. Start backend:
   ```bash
   pnpm dev
   # or from repo root: pnpm dev:backend
   ```

Default admin: `admin` / `admin123`.

API base URL: `http://localhost:3100/api`.

## Endpoints (Plan #1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Issue access + refresh token |
| POST | `/api/auth/refresh` | Public | Rotate refresh token |
| POST | `/api/auth/logout` | Bearer | Revoke all refresh tokens for user |
| GET | `/api/auth/codes` | Bearer | Permission codes for current user role |
| GET | `/api/menu/all` | Bearer | Menu tree for current user role |
| GET | `/api/user/info` | Bearer | Current user profile + shop access list |

All responses (except errors) are wrapped: `{ code: 0, data: <result>, message: 'ok' }`.

## Tests

```bash
pnpm test:unit          # Vitest unit tests (services + guards, mocked)
pnpm test:integration   # Vitest e2e tests (real PostgreSQL via shop_bookkeeping_test DB)
```

The integration suite requires PostgreSQL running and the `shop_bookkeeping_test` database created:
```bash
docker exec vben_pg_dev psql -U vben -d shop_bookkeeping -c "CREATE DATABASE shop_bookkeeping_test;"
DATABASE_URL=postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping_test pnpm prisma migrate deploy
```

## Production

Build via root `docker-compose.prod.yml`:
```bash
# from repo root
cp .env.example .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

The frontend will be available on port 80 (or `${FRONTEND_PORT}`), the NestJS backend on the docker network at `backend:3100`.

After first start, seed the admin user:
```bash
docker compose -f docker-compose.prod.yml exec backend pnpm prisma:seed
```
