# 部署指南

## 环境要求

- 阿里云 ECS（Ubuntu 22.04+，建议 2GB+ 内存）
- 安全组开放端口：22（SSH）、80（HTTP）、443（HTTPS，有域名后）
- Docker + Docker Compose

## 架构

```
ECS
├── Caddy (:80/:443)     ← 反向代理，有域名后自动 HTTPS
├── Frontend (Nginx)     ← Vue SPA + /api/ 反代到 backend
├── Backend (NestJS)     ← REST API :3100
├── PostgreSQL           ← 数据库
└── MinIO                ← 附件/凭证存储
```

## 首次部署

### 1. 安装 Docker

```bash
# 一键安装
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker

# 配置镜像加速（阿里云控制台 → 容器镜像服务 → 镜像加速器 获取专属地址）
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

### 2. 获取代码

```bash
git clone https://github.com/meiqinhu29-alt/vben-admin-spec.git
cd vben-admin-spec
```

### 3. 配置环境变量

```bash
cp .env.production.example .env.production
vi .env.production
```

必须修改的字段：

| 变量                  | 说明         | 示例                        |
| --------------------- | ------------ | --------------------------- |
| `POSTGRES_PASSWORD`   | 数据库密码   | `MyStr0ngP@ss!`             |
| `JWT_ACCESS_SECRET`   | JWT 签名密钥 | `openssl rand -hex 32` 生成 |
| `JWT_REFRESH_SECRET`  | JWT 刷新密钥 | `openssl rand -hex 32` 生成 |
| `MINIO_ROOT_PASSWORD` | MinIO 密码   | 至少 8 位                   |
| `CORS_ORIGIN`         | 前端访问地址 | `http://你的ECS公网IP`      |

快速生成密钥：

```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
```

### 4. 构建并启动

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

首次构建约 5-10 分钟（取决于网速和机器配置）。

### 5. 初始化数据库

```bash
# 等待所有容器 healthy
docker compose -f docker-compose.prod.yml ps

# 执行 seed（创建角色、菜单、权限、默认用户）
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend pnpm prisma db seed
```

Seed 会创建：

- 5 个角色：admin（全部数据）、boss（店铺数据）、finance（店铺数据）、manager（店铺数据）、staff（仅自己）
- 完整菜单权限树（资金管理 + 系统管理 + 按钮级 authCode）
- 5 个默认账号，密码统一 `admin123`

### 6. 验证

浏览器访问 `http://你的ECS公网IP`，使用 `admin / admin123` 登录。

## 后续更新

```bash
cd vben-admin-spec
git pull

# 重新构建并启动（数据库数据不会丢失）
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

> 注意：`prisma migrate deploy` 已写在 backend 容器启动命令中，每次启动自动执行迁移。无需手动操作。

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
4. 重启：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Caddy 会自动申请 Let's Encrypt 证书并续期，无需额外配置。

## 常用运维命令

```bash
# 查看所有容器状态
docker compose -f docker-compose.prod.yml ps

# 查看后端日志
docker compose -f docker-compose.prod.yml logs -f backend

# 查看所有日志
docker compose -f docker-compose.prod.yml logs -f

# 重启单个服务
docker compose -f docker-compose.prod.yml restart backend

# 进入数据库
docker compose -f docker-compose.prod.yml exec postgres psql -U vben shop_bookkeeping

# 数据库备份
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U vben shop_bookkeeping > backup_$(date +%Y%m%d).sql

# 数据库恢复
cat backup_20260520.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vben shop_bookkeeping

# 完全停止并删除容器（数据卷保留）
docker compose -f docker-compose.prod.yml down

# 完全清除（包括数据卷，慎用！）
docker compose -f docker-compose.prod.yml down -v
```

## 默认账号

| 用户名  | 密码     | 角色       | 数据范围   |
| ------- | -------- | ---------- | ---------- |
| admin   | admin123 | 系统管理员 | 全部数据   |
| boss    | admin123 | 老板       | 所属店铺   |
| finance | admin123 | 财务       | 所属店铺   |
| manager | admin123 | 店长       | 所属店铺   |
| staff   | admin123 | 员工       | 仅自己创建 |

> 部署后请立即修改 admin 密码。

## 注意事项

- **不要重复执行 seed**：seed 脚本会清空所有数据再重建，仅首次部署时执行一次
- **备份**：建议配置定时备份（crontab + pg_dump），至少每天一次
- **内存**：全套服务约占 1-1.5GB 内存，建议 ECS 至少 2GB
- **磁盘**：Docker 镜像 + 数据库 + MinIO 附件，建议 40GB+ 系统盘
