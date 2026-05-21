# 部署指南

## 部署方案

**GitHub Actions 自动构建 → 推送阿里云 ACR → ECS 拉取镜像运行**

代码 push 到 main 后，GitHub Actions 自动构建镜像并推到 ACR；ECS 只负责拉镜像和运行。所有网络/编译问题都在 CI 解决，部署快且稳。

## 整体架构

```
┌──────────┐   git push    ┌──────────┐   GitHub Actions   ┌─────────┐
│ 本地 Mac │ ────────────▶ │  GitHub  │ ─────────────────▶ │   ACR   │
└──────────┘    PR/main    └──────────┘   buildx 构建      │ 镜像仓库│
                                          推送 latest+SHA  └────┬────┘
                                                                │ pull (VPC 内网)
                                                                ▼
                                                        ┌──────────────┐
                                                        │  阿里云 ECS  │
                                                        │              │
                                                        │ Caddy :80/443│
                                                        │  ├─frontend  │
                                                        │  │  └─/api/→ │
                                                        │  └─backend   │
                                                        │     ├─postgres│
                                                        │     └─minio  │
                                                        └──────────────┘
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `apps/backend/Dockerfile` | NestJS 镜像构建 |
| `apps/web-naive/Dockerfile` | 前端 + nginx 镜像构建 |
| `apps/web-naive/nginx.conf` | nginx 把 `/api/` 反代到 `backend:3100` |
| `Caddyfile` | Caddy 把 80/443 流量转给 frontend |
| `docker-compose.prod.yml` | 生产编排（5 个服务） |
| `.env.production.example` | 配置模板（提交到 git） |
| `.env.production` | 真实配置（**只在 ECS 上**，gitignore） |
| `.github/workflows/build-and-push.yml` | CI 自动构建推 ACR |
| `scripts/deploy/build-and-push.sh` | 本地手动构建推 ACR（备用） |
| `scripts/deploy/pull-and-up.sh` | ECS 拉镜像启动 |

## 首次部署（一次性）

### 1. 阿里云 ACR

1. [ACR 控制台](https://cr.console.aliyun.com) → 创建**个人版实例**（免费）→ 区域 **华北2（北京）**
2. 创建命名空间 `vben-xs`
3. 「访问凭证」→ 设置固定密码
4. 不需要预先创建仓库 — push 时自动创建

### 2. GitHub Secrets

repo Settings → Secrets and variables → Actions，添加：

| Name | Value |
|------|-------|
| `ACR_USERNAME` | ACR 访问凭证用户名（阿里云账号名） |
| `ACR_PASSWORD` | ACR 固定密码 |

### 3. ECS 准备

```bash
# 装 Docker
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker

# Docker 镜像加速（可选）
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://你的专属地址.mirror.aliyuncs.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
systemctl daemon-reload && systemctl restart docker
```

### 4. ECS 首次启动

```bash
# 拉代码（仅为获取 compose 文件 + Caddyfile + 脚本，不构建）
git clone https://github.com/meiqinhu29-alt/vben-admin-spec.git
cd vben-admin-spec

# 配置环境变量
cp .env.production.example .env.production
vi .env.production
```

`.env.production` 必须改的字段（用 `openssl rand` 生成）：

```bash
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/')
MINIO_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/')
```

```bash
# 登录 ACR（用 VPC 内网地址，免费且快）
docker login crpi-dsaw9owrbrng40lv-vpc.cn-beijing.personal.cr.aliyuncs.com

# 启动（首次会从 ACR 拉镜像）
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 初始化数据库
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend npx tsx prisma/seed.ts
```

Seed 会创建：
- 5 个角色：admin / boss / finance / manager / staff
- 完整菜单权限树 + authCode 按钮权限
- 5 个默认账号（admin / boss / finance / manager / staff），密码统一 `admin123`

### 验证

浏览器访问 ECS 公网 IP，用 `admin / admin123` 登录。**部署后请立即修改 admin 密码**。

## 日常更新流程

### 业务代码改动（前端 / 后端代码）

```
本地改代码 → git push 到 PR → 合并到 main
   ↓
GitHub Actions 自动构建（首次 5-10 分钟，缓存后 1-2 分钟）
   ↓
镜像推到 ACR：latest 和 commit SHA 双 tag
   ↓
ECS 上拉新镜像并重启
```

ECS 上的命令：

```bash
cd vben-admin-spec
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

> backend 容器启动时自动跑 `npx prisma migrate deploy`，schema 变更不用手动操作。

### 配置改动（环境变量 / Caddy / compose）

```
ECS 上 vi .env.production / Caddyfile
   ↓
docker compose ... up -d   (会重建受影响的容器)
```

不需要拉新镜像。如果改的是仓库里的文件（`Caddyfile`、`docker-compose.prod.yml`），先在 ECS 上 `git pull`。

### 数据库 schema 改动

```
本地：
  pnpm prisma migrate dev --name xxx   # 生成 migration 文件
  git commit + push
   ↓
GitHub Actions 构建新镜像（包含 migration 文件）
   ↓
ECS 上 pull + up -d
   ↓
backend 启动时自动 prisma migrate deploy
```

### 手动触发构建（绕过 push）

GitHub repo → Actions → "Build and Push to ACR" → Run workflow。

### 本地手动构建（CI 不可用时备用）

```bash
IMAGE_NAMESPACE=vben-xs bash scripts/deploy/build-and-push.sh
```

需要 Docker buildx，Mac M 系列会跨平台编译为 linux/amd64（比 GitHub runner 慢 2-3 倍）。

## 应急回滚

镜像在 ACR 里有 commit SHA tag，可以回滚到任意历史版本：

```bash
# ECS 上把 IMAGE_TAG 改成想回滚的 commit SHA
echo "IMAGE_TAG=17901b4bb2f0237c7db7729ec8a99054b735ddcd" >> .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 验证后改回 latest
sed -i '/^IMAGE_TAG=/d' .env.production
echo "IMAGE_TAG=latest" >> .env.production
```

## 添加域名（HTTPS）

1. 域名 A 记录解析到 ECS 公网 IP
2. 修改 `Caddyfile`：

```diff
- :80 {
+ yourdomain.com {
    reverse_proxy frontend:80
  }
```

3. 修改 `.env.production` 中 `CORS_ORIGIN=https://yourdomain.com`
4. 重启：`docker compose -f docker-compose.prod.yml --env-file .env.production up -d`

Caddy 自动申请 Let's Encrypt 证书并续期。

## 常用运维命令

```bash
# 状态
docker compose -f docker-compose.prod.yml ps

# 日志
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs --tail 100 backend

# 进容器调试
docker compose -f docker-compose.prod.yml exec backend sh
docker compose -f docker-compose.prod.yml exec postgres psql -U vben shop_bookkeeping

# 备份数据库
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U vben shop_bookkeeping > backup_$(date +%Y%m%d).sql

# 单独重启某服务
docker compose -f docker-compose.prod.yml --env-file .env.production restart backend

# 完全停止（数据保留）
docker compose -f docker-compose.prod.yml --env-file .env.production down

# 完全清除（连数据卷一起，慎用）
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
```

## 默认账号

| 用户名  | 密码     | 角色       | 数据范围   |
| ------- | -------- | ---------- | ---------- |
| admin   | admin123 | 系统管理员 | 全部数据   |
| boss    | admin123 | 老板       | 所属店铺   |
| finance | admin123 | 财务       | 所属店铺   |
| manager | admin123 | 店长       | 所属店铺   |
| staff   | admin123 | 员工       | 仅自己创建 |

## 注意事项

- **不要重复执行 seed**：seed 会清空所有数据再重建，仅首次部署执行一次
- **JWT secret 必须改**：example 文件里的值已公开，不改等于没安全
- **备份**：建议配置定时备份（crontab + pg_dump）
- **内存**：全套服务约占 1-1.5GB，建议 ECS 至少 2GB
- **磁盘**：建议 40GB+ 系统盘

