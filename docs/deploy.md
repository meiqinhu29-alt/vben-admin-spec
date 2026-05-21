# 部署指南

## 部署方案

**本地构建镜像 → 推送到阿里云 ACR → ECS 拉取镜像运行**

优势：构建放在本地（无网络/编译环境问题），ECS 只负责拉镜像和运行，部署快且稳。

## 架构

```
本地 Mac (ARM)                阿里云 ACR              阿里云 ECS (北京)
│                              │                       │
└─ docker buildx ──push────►   ├─ vben-admin-backend   │
                               └─ vben-admin-frontend  └─ docker compose pull + up
                                                          ├── Caddy (:80)
                                                          ├── Frontend
                                                          ├── Backend
                                                          ├── PostgreSQL
                                                          └── MinIO
```

## 前置准备

### 1. 阿里云 ACR 个人版

1. 打开 [阿里云 ACR 控制台](https://cr.console.aliyun.com)
2. 创建**个人版实例**（免费），区域选 **华北2（北京）** — 与 ECS 同地域
3. 创建命名空间，例如 `xiaose`（这就是镜像前缀）
4. 设置访问凭证：「访问凭证」→ 设置固定密码（用于 docker login）
5. 创建两个镜像仓库：`vben-admin-backend`、`vben-admin-frontend`

镜像地址：
- 公网（本地推送）：`registry.cn-beijing.aliyuncs.com/<namespace>/...`
- 内网（ECS 拉取，免费）：`registry-vpc.cn-beijing.aliyuncs.com/<namespace>/...`

### 2. ECS 安装 Docker

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker
```

阿里云 Docker 镜像配置：

```bash
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

## 首次部署

### 在本地（Mac）：构建并推送镜像

```bash
# 1. 编辑 build-and-push.sh，把 IMAGE_NAMESPACE 改成你的 ACR 命名空间
# 或通过环境变量：
IMAGE_NAMESPACE=xiaose bash scripts/deploy/build-and-push.sh
```

脚本会：
- 自动创建 buildx builder
- 跨平台编译 linux/amd64 镜像（Mac M 系列必须）
- 登录 ACR（首次需输入用户名/密码）
- 推送 backend + frontend 镜像

首次构建 5-10 分钟。

### 在 ECS 上：拉取并启动

```bash
# 1. 拉代码（仅为获取 docker-compose.prod.yml + Caddyfile + 脚本）
git clone https://github.com/meiqinhu29-alt/vben-admin-spec.git
cd vben-admin-spec

# 2. 配置环境变量
cp .env.production.example .env.production
vi .env.production
# 修改 IMAGE_NAMESPACE 为你的 ACR 命名空间

# 3. 拉取镜像并启动
bash scripts/deploy/pull-and-up.sh

# 4. 首次部署初始化数据库
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend pnpm prisma db seed
```

Seed 创建：
- 5 个角色：admin / boss / finance / manager / staff
- 完整菜单权限树 + authCode 按钮权限
- 5 个默认账号，密码统一 `admin123`

### 验证

浏览器访问 `http://101.200.219.28`，使用 `admin / admin123` 登录。

## 后续更新

```bash
# 本地：重新构建并推送（代码改动后）
IMAGE_NAMESPACE=xiaose bash scripts/deploy/build-and-push.sh

# ECS：拉新镜像并重启
cd vben-admin-spec
git pull
bash scripts/deploy/pull-and-up.sh
```

> Prisma migrate deploy 已写在 backend 容器启动命令中，自动执行迁移。

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
docker compose -f docker-compose.prod.yml ps                                    # 状态
docker compose -f docker-compose.prod.yml logs -f backend                       # 日志
docker compose -f docker-compose.prod.yml restart backend                       # 重启
docker compose -f docker-compose.prod.yml exec postgres psql -U vben shop_bookkeeping  # DB

# 备份数据库
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U vben shop_bookkeeping > backup_$(date +%Y%m%d).sql

# 完全停止（数据卷保留）
docker compose -f docker-compose.prod.yml down

# 完全清除（包括数据卷，慎用）
docker compose -f docker-compose.prod.yml down -v
```

## 默认账号

| 用户名 | 密码 | 角色 | 数据范围 |
|--------|------|------|----------|
| admin | admin123 | 系统管理员 | 全部数据 |
| boss | admin123 | 老板 | 所属店铺 |
| finance | admin123 | 财务 | 所属店铺 |
| manager | admin123 | 店长 | 所属店铺 |
| staff | admin123 | 员工 | 仅自己创建 |

> 部署后请立即修改 admin 密码。

## 注意事项

- **不要重复执行 seed**：seed 会清空所有数据再重建，仅首次部署执行一次
- **备份**：建议配置定时备份（crontab + pg_dump）
- **内存**：全套服务约占 1-1.5GB，建议 ECS 至少 2GB
- **磁盘**：建议 40GB+ 系统盘
