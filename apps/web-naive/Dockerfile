FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY . .

# 配置国内 npm 镜像 + 移除有问题的 postinstall
RUN echo "registry=https://registry.npmmirror.com" > .npmrc \
    && sed -i '/"postinstall"/d' package.json

RUN pnpm install --frozen-lockfile
RUN pnpm build:naive

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/apps/web-naive/dist /usr/share/nginx/html
COPY apps/web-naive/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
