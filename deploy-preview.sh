#!/usr/bin/env bash
# MT1399 Road Analyzer v1.9.3 Preview 部署腳本
# 用法：在解壓後的 mt1399-road-analyzer-v1.9.3-deploy 目錄中執行

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

echo "========================================"
echo "MT1399 Road Analyzer v1.9.3 Preview 部署"
echo "========================================"
echo ""

# Step 1: 確認 wrangler 已登入
echo "[1/7] 確認 Cloudflare 認證..."
if ! npx wrangler whoami >/dev/null 2>&1; then
    echo "尚未登入，請先執行：npx wrangler login"
    exit 1
fi
echo "✅ 已登入 Cloudflare"

# Step 2: 建立 D1 資料庫
echo ""
echo "[2/7] 建立 Preview D1 資料庫..."
DB_CREATE_OUTPUT=$(npx wrangler d1 create mt1399-road-analyzer-preview-db 2>&1) || true

# 嘗試從輸出提取 database_id
DB_ID=$(echo "$DB_CREATE_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[0-9a-f-]{36}' || true)

if [ -z "$DB_ID" ]; then
    # 可能已存在，嘗試列出
    DB_LIST=$(npx wrangler d1 list 2>&1)
    DB_ID=$(echo "$DB_LIST" | grep "mt1399-road-analyzer-preview-db" | grep -oP '[0-9a-f-]{36}' | head -1 || true)
fi

if [ -z "$DB_ID" ]; then
    echo "❌ 無法取得 database_id"
    echo "$DB_CREATE_OUTPUT"
    exit 1
fi

echo "✅ Database ID: $DB_ID"

# Step 3: 更新 wrangler.preview.jsonc
echo ""
echo "[3/7] 更新 wrangler.preview.jsonc..."
sed -i "s/YOUR_PREVIEW_DB_ID_HERE/$DB_ID/g" wrangler.preview.jsonc
echo "✅ database_id 已填入"

# Step 4: 執行 migration
echo ""
echo "[4/7] 執行 D1 migration（remote）..."
npx wrangler d1 execute mt1399-road-analyzer-preview-db \
    --remote --file=./db/preview-init.sql \
    --config wrangler.preview.jsonc
echo "✅ Migration 完成"

# Step 5: 設定 Secret
echo ""
echo "[5/7] 設定 MEMBER_SESSION_SECRET..."
SECRET_VALUE=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '=+/')
echo "$SECRET_VALUE" | npx wrangler secret put MEMBER_SESSION_SECRET \
    --config wrangler.preview.jsonc
echo "✅ Secret 已設定"

# Step 6: 部署
echo ""
echo "[6/7] 部署至 Preview..."
DEPLOY_OUTPUT=$(npx wrangler deploy --config wrangler.preview.jsonc 2>&1)
echo "$DEPLOY_OUTPUT"

# Step 7: 提取 URL
echo ""
echo "[7/7] 提取 Preview URL..."
PREVIEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[a-zA-Z0-9._-]+\.workers\.dev' | head -1 || true)

if [ -n "$PREVIEW_URL" ]; then
    echo ""
    echo "========================================"
    echo "✅ 部署成功！"
    echo "========================================"
    echo ""
    echo "Preview URL: $PREVIEW_URL"
    echo "Worker Name: mt1399-road-analyzer-preview"
    echo "D1 Database: mt1399-road-analyzer-preview-db"
    echo "D1 ID:       $DB_ID"
    echo ""
    echo "請將 Preview URL 回傳給 Kimi Claw 進行驗證。"
else
    echo ""
    echo "⚠️ 部署可能已完成，但無法自動提取 URL。"
    echo "請手動檢查 Cloudflare Dashboard 或重新執行："
    echo "  npx wrangler deploy --config wrangler.preview.jsonc"
fi
