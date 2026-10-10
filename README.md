# MT1399 Analyze v1.12.6

公開介紹與同 IP 20 局免費試用版。

- 正式網址：`https://mt1399.com/analyze/`
- Node.js：22 或更新版本
- 前端：Next.js / React / Vinext
- 部署：Cloudflare Workers + D1

## 公開功能

- 手機上傳牌路截圖
- 電腦拖曳、選檔或貼上截圖
- 辨識大路、大眼仔路、小路與曱甴路
- 同一連線 IP 共用 20 局額度
- 成功產生結果才扣 1 局
- 辨識失敗與範例圖片不扣次數
- 不讀取遊戲帳號、密碼或 Cookie

本階段公開匿名自動牌路學習；系統在下一張截圖確認同一靴只新增一局後，自動回填實際結果，不要求會員手動回報。無法可靠確認時直接略過，不納入學習；範例圖片不會干擾真實學習序列。不公開會員登入、管理後台、畫面即時讀牌或自動下注。

## 安裝與測試

```bash
npm ci
npm test
npm run lint
```

## 建立公開試用版

```bash
npm run build:trial
```

輸出：

```text
dist/server
dist/client
dist-trial/server
dist-trial/client
```

公開版建置只保留以下路由：

```text
/api/trial/status
/api/trial/use
```

## Cloudflare D1

保留現有 Cloudflare 環境中的 D1 `database_id` 與 `MEMBER_SESSION_SECRET`，不要用範例 placeholder 覆蓋。

新資料庫可執行：

```bash
npx wrangler d1 execute <DATABASE_NAME> --remote \
  --file=./db/public-trial-init.sql \
  --config <WRANGLER_CONFIG>
```

完整部署與驗收清單請見 `README-public-trial.md`。

## 使用限制

牌路分析只整理已出現的圖形與近期訊號，不代表下一局必然結果，也不是獲利或勝率保證。
