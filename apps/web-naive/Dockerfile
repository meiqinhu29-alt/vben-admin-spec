FROM node:22-alpine AS builder
WORKDIR /app

# CI=true 让 prepare 脚本里的 is-ci 短路成功，跳过 lefthook git hook 安装
ENV CI=true
# bcrypt 二进制镜像（全量 install 会装到 backend 的 bcrypt）
ENV npm_config_bcrypt_binary_host_mirror=https://registry.npmmirror.com/-/binary/bcrypt/

# 原生模块编译工具链（兜底）
RUN apk add --no-cache python3 make g++

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
