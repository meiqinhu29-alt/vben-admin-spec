#!/bin/bash
# ============================================
# 本地构建 + 推送到阿里云 ACR
# 用于 Mac M 系列(ARM)跨平台编译为 linux/amd64
# 使用前: 修改下方 IMAGE_NAMESPACE 为你的 ACR 命名空间
# ============================================
set -e

# === 配置（按你的 ACR 实际情况修改） ===
REGISTRY="registry.cn-beijing.aliyuncs.com"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-vben-xs}"   # 你的 ACR 命名空间
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="linux/amd64"

BACKEND_IMAGE="${REGISTRY}/${IMAGE_NAMESPACE}/vben-admin-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${REGISTRY}/${IMAGE_NAMESPACE}/vben-admin-frontend:${IMAGE_TAG}"

echo "=== 1. 检查 docker buildx ==="
docker buildx version >/dev/null || {
  echo "错误: 需要 Docker buildx (Docker Desktop 自带)"
  exit 1
}

# 创建/复用 builder 实例
if ! docker buildx inspect vben-builder >/dev/null 2>&1; then
  docker buildx create --name vben-builder --use
else
  docker buildx use vben-builder
fi

echo ""
echo "=== 2. 登录 ACR ==="
echo "请输入 ACR 访问凭证（用户名/密码）— 在阿里云 ACR 控制台 → 访问凭证 设置"
docker login "${REGISTRY}"

echo ""
echo "=== 3. 构建并推送 backend (${PLATFORM}) ==="
docker buildx build \
  --platform "${PLATFORM}" \
  -f apps/backend/Dockerfile \
  -t "${BACKEND_IMAGE}" \
  --push \
  .

echo ""
echo "=== 4. 构建并推送 frontend (${PLATFORM}) ==="
docker buildx build \
  --platform "${PLATFORM}" \
  -f apps/web-naive/Dockerfile \
  -t "${FRONTEND_IMAGE}" \
  --push \
  .

echo ""
echo "=== 完成 ==="
echo "Backend:  ${BACKEND_IMAGE}"
echo "Frontend: ${FRONTEND_IMAGE}"
echo ""
echo "ECS 上拉取部署: bash scripts/deploy/pull-and-up.sh"
