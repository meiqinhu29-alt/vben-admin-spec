#!/bin/bash
# ============================================
# ECS 上从 ACR 拉取镜像并启动服务
# 走 VPC 内网（同地域免费且极快）
# ============================================
set -e

if [ ! -f .env.production ]; then
  echo "错误: 请先创建 .env.production"
  echo "  cp .env.production.example .env.production"
  exit 1
fi

# 读取 .env.production 检查必要变量
source .env.production

if [ -z "$IMAGE_NAMESPACE" ]; then
  echo "错误: .env.production 里需要设置 IMAGE_NAMESPACE"
  exit 1
fi

echo "=== 1. 登录 ACR (内网) ==="
docker login "${REGISTRY:-registry-vpc.cn-beijing.aliyuncs.com}"

echo ""
echo "=== 2. 拉取最新镜像 ==="
docker compose -f docker-compose.prod.yml --env-file .env.production pull backend frontend

echo ""
echo "=== 3. 启动服务 ==="
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo ""
echo "=== 4. 服务状态 ==="
sleep 3
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== 完成 ==="
echo "首次部署需要初始化数据库:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production exec backend pnpm prisma db seed"
