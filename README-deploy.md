# MT1399 牌路分析器 v1.9.3 — 部署說明

## 檔案結構

```
dist/server/          # Worker 伺服器端程式
  index.js            # 主入口
dist/client/          # 靜態資源（CSS、JS、圖片）
  assets/             # 編譯後的 JS/CSS
  *.png, *.svg        # 圖示與範例圖片
  _routes.json        # Cloudflare Pages 路由規則
  robots.txt          # robots.txt
  sitemap.xml         # sitemap
wrangler.preview.jsonc  # Preview 環境配置
db/
  preview-init.sql    # D1 資料庫初始化 SQL
```

## 部署步驟

### 1. 建立 D1 資料庫
```bash
npx wrangler d1 create mt1399-road-analyzer-preview-db
```
記下輸出的 `database_id`。

### 2. 填入 database_id
編輯 `wrangler.preview.jsonc`，將 `YOUR_PREVIEW_DB_ID_HERE` 替換為真實 ID。

### 3. 執行 Migration
```bash
npx wrangler d1 execute mt1399-road-analyzer-preview-db --file=./db/preview-init.sql
```

### 4. 設定 Secret
```bash
npx wrangler secret put MEMBER_SESSION_SECRET --name mt1399-road-analyzer-preview
```
輸入一個隨機字串（建議：`openssl rand -hex 32`）。

### 5. 部署
```bash
npx wrangler deploy --config wrangler.preview.jsonc
```

## 版本資訊

- 版本：v1.9.3
- 日期：2026-09-03
- 變更：正式引擎黑邊裁切 + 解析度檢查、縮放一致性修復、試用版清理

## 驗證項目

部署後請驗證：
1. Logo HTTP 200
2. 原圖/200%/黑邊辨識一致
3. 低解析度圖片顯示「圖片解析度不足」且不扣次數
4. 同 IP 分析後重新整理仍維持正確次數
5. 無痕模式次數與一般模式相同
6. 範例圖片不扣次數
7. admin/login/member 路由回傳 404
