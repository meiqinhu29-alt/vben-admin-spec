FROM node:22-alpine AS builder
WORKDIR /app

# CI=true 让 prepare 里的 is-ci 短路，跳过 lefthook 安装
ENV CI=true

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY . .

RUN echo "registry=https://registry.npmmirror.com" > .npmrc
# postinstall 跑 `pnpm -r run stub`，给 internal/* 包生成 dist 入口（vite-config / node-utils 必需）
RUN pnpm install --frozen-lockfile

# 直接调 vite，绕开 turbo 拓扑分析（@vben/tsconfig 和 @vben/types 的循环依赖会让 turbo 拒绝执行）
WORKDIR /app/apps/web-naive
RUN pnpm vite build --mode production

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/apps/web-naive/dist /usr/share/nginx/html
COPY apps/web-naive/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
