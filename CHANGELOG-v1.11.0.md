# v1.11.0

## 公開介紹與 20 局試用

- 正式入口統一為 `/analyze/`。
- 新增免登入 20 局、成功才扣次數、本機辨識與風險說明。
- 公開頁採用指定文案，列出 MT、DG、T9、DB、W、EVO 等標準牌路介面。
- 首頁及結果區同步顯示剩餘試用額度。
- 試用版不顯示尚未開放的畫面即時分析入口。
- 修正範例圖片、Logo、OG 圖、favicon、API、canonical、sitemap 與 robots 路徑。
- `/analyze` 以 HTTP 301 導向 `/analyze/`。

## 公開建置清理

- `npm run build` 預設建立 public trial-only 輸出。
- 只保留首頁、`/api/trial/status` 與 `/api/trial/use`。
- 排除 admin、login、member 與 learning 路由。
- 新增最小化 D1 schema：`db/public-trial-init.sql`。
- 原始碼與部署範例均不包含 `.env` 或真實 Secret。

## 驗證

- 公開 Trial build：成功。
- 路由：首頁、trial status、trial use；無私人路由。
- 牌路辨識：10 passed、0 failed、6 skipped（缺少真實平台截圖）。
- IP 計次邏輯：7 passed、0 failed。
- ESLint：0 errors、5 warnings。

## 尚未包含

- MT 分頁即時讀牌。
- 會員登入與會員額度。
- 管理後台。
- 自動下注。
- 六組真實平台截圖的辨識驗收。
