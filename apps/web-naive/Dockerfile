FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build:naive

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/apps/web-naive/dist /usr/share/nginx/html
COPY apps/web-naive/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
