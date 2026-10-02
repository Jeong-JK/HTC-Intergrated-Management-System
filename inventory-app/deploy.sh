#!/bin/bash
# HTC Inventory — EC2 배포 스크립트
set -e

echo "=== HTC Inventory Deploy ==="

# 1. 백엔드 의존성
echo "[1/4] 백엔드 패키지 설치..."
cd /home/ec2-user/inventory-app/backend
pip3 install -r requirements.txt

# 2. 프론트엔드 빌드
echo "[2/4] 프론트엔드 빌드..."
cd /home/ec2-user/inventory-app/frontend
npm install
npm run build

# 3. systemd 서비스 등록
echo "[3/4] systemd 서비스 등록..."
sudo tee /etc/systemd/system/htc-inventory.service > /dev/null << EOF
[Unit]
Description=HTC Inventory FastAPI
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ec2-user/inventory-app/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable htc-inventory
sudo systemctl restart htc-inventory

echo "[4/4] 완료!"
echo ">>> http://YOUR_EC2_IP:8000 으로 접속하세요"
