# MT1399 Analyze v1.11.0 — 公開介紹與 20 局試用

正式網址：`https://mt1399.com/analyze/`

## 本版範圍

- 公開介紹頁與搜尋引擎 metadata
- 手機選取牌路截圖
- 電腦拖曳、選檔或貼上牌路截圖
- 大路、大眼仔路、小路及曱甴路辨識
- 同一 IP 共用 20 局免費額度
- 只有成功產生分析結果才扣 1 局
- 辨識失敗與範例圖片不扣次數
- 不包含會員登入、管理後台、會員 API、學習 API 或自動下注

## GitHub → Cloudflare 建置

建置指令：

```bash
npm run build:trial
```

輸出目錄：

```text
dist/server
dist/client
dist-trial/server
dist-trial/client
```

Cloudflare 部署前請保留目前環境已設定的 D1 `database_id` 與 `MEMBER_SESSION_SECRET`，不要用範例 placeholder 覆蓋。

若 D1 尚未建立 `trial_usage`，請執行：

```bash
npx wrangler d1 execute <DATABASE_NAME> --remote --file=./db/public-trial-init.sql --config <WRANGLER_CONFIG>
```

## 驗收

1. `/analyze/` 回傳 HTTP 200 並顯示 v1.11.0。
2. 首次開啟顯示剩餘 20／20 局。
3. 成功辨識後變成 19／20，重新整理仍為 19／20。
4. 同一 IP 的無痕視窗與其他瀏覽器共用相同額度。
5. 低解析度、非牌路圖片與辨識失敗不扣次數。
6. 範例圖片可產生結果但不扣次數。
7. `/analyze/admin`、`/analyze/login`、`/analyze/member`、會員及管理 API 都回傳 404。

牌路訊號不代表下一局必然結果；本版不讀取遊戲帳密，也不提供自動下注。
