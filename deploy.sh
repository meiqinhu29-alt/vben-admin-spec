#!/bin/bash
# ============================================
# 阿里云 ECS 一键部署脚本
# 在 ECS 上执行: bash deploy.sh
# ============================================
set -e

echo "=== 1. 安装 Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
  echo "Docker 安装完成"
else
  echo "Docker 已安装，跳过"
fi

echo ""
echo "=== 2. 配置阿里云镜像加速 ==="
if [ ! -f /etc/docker/daemon.json ]; then
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'DAEMON'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DAEMON
  systemctl daemon-reload
  systemctl restart docker
  echo "镜像加速配置完成（请替换为你的阿里云专属加速地址）"
else
  echo "daemon.json 已存在，跳过"
fi

echo ""
echo "=== 3. 检查 .env.production ==="
if [ ! -f .env.production ]; then
  echo "错误: 请先创建 .env.production 文件并填写密码/密钥"
  echo "参考模板: .env.production.example"
  exit 1
fi

echo ""
echo "=== 4. 构建并启动服务 ==="
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo ""
echo "=== 5. 等待服务就绪 ==="
sleep 5
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== 6. 初始化数据库（首次部署） ==="
echo "如果是首次部署，执行以下命令初始化种子数据："
echo "  docker compose -f docker-compose.prod.yml exec backend pnpm prisma db seed"
echo ""
echo "=== 部署完成 ==="
echo "访问: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_ECS_IP')"
echo "默认账号: admin / admin123"
