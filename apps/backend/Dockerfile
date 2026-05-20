FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# 配置国内 npm 镜像
RUN echo "registry=https://registry.npmmirror.com" > .npmrc

# 复制 monorepo 元数据先
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
COPY internal/tsconfig/package.json ./internal/tsconfig/

# 移除根 postinstall（stub 脚本在 Docker 构建中不需要）
RUN sed -i '/"postinstall"/d' package.json

# 复制源码并安装依赖
COPY apps/backend ./apps/backend
COPY packages/types ./packages/types
COPY internal/tsconfig ./internal/tsconfig

RUN pnpm install --frozen-lockfile --filter @vben/backend... --filter @vben/types

WORKDIR /app/apps/backend
RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV=production
ENV PORT=3100

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/packages/types ./packages/types

WORKDIR /app/apps/backend
EXPOSE 3100
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
