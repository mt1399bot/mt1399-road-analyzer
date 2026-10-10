# 測試集補充說明

## 目前已有的測試圖片（10 張）

已放在 `tests/fixtures/`，可直接執行測試：

```bash
cd mt1399-road-analyzer
npx tsx tests/road-recognition.test.ts
```

## 需要補充的真實截圖（6 張）

請從以下平台截取牌路圖片，放入 `tests/fixtures/`：

| 檔名 | 平台 | 裝置 | 截圖要求 |
|------|------|------|----------|
| `real-mobile-mt.jpg` | MT 真人 | 手機 | 完整顯示大路+下三路 |
| `real-mobile-dg.jpg` | DG 真人 | 手機 | 完整顯示大路+下三路 |
| `real-desktop-t9.jpg` | T9 真人 | 電腦 | 完整顯示大路+下三路 |
| `real-mobile-ob.jpg` | 歐博真人 | 手機 | 完整顯示大路+下三路 |
| `real-mobile-w.jpg` | W 真人 | 手機 | 完整顯示大路+下三路 |
| `real-mobile-sa.jpg` | SA 真人 | 手機 | 完整顯示大路+下三路 |

### 截圖規範
1. **必須包含完整牌路區域**（大路 + 大眼仔路 + 小路 + 曱甴路）
2. **清晰可見**：紅藍圓點邊界清楚，不模糊
3. **不裁切**：保留完整介面，不要只截部分
4. **格式**：JPG 或 PNG，建議寬度 600px 以上
5. **命名**：嚴格依照上表檔名，區分大小寫

## 校準流程

放入截圖後，執行以下命令更新 `expected-results.json`：

```bash
# 1. 執行測試，產生實際結果
npx tsx tests/road-recognition.test.ts

# 2. 查看 test-report.json 中的實際輸出
cat tests/fixtures/test-report.json

# 3. 人工核對 outcomes 順序是否正確
# 4. 手動更新 expected-results.json 中的 baseline 欄位
```

### 人工核對方式

1. 開啟圖片，肉眼數出莊閒和的順序（建議從最新一局往回數）
2. 與測試輸出的 `outcomes` 比對
3. 如果一致，將實際結果寫入 `expected-results.json` 的 `baseline` 欄位
4. 如果不一致，記錄錯誤位置，作為引擎改進依據

## 執行完整測試

```bash
npm test
```

這會執行：
1. `rendered-html.test.mjs` - 檢查頁面渲染
2. `road-recognition.test.ts` - 檢查牌路辨識

## 測試結果解讀

```
Results: X passed, Y failed, Z skipped
```

- **passed**：辨識結果符合預期
- **failed**：需要檢查錯誤原因
- **skipped**：圖片尚未放入（真實截圖待補充）

## 注意事項

- `synthetic-road-dg.png`（暗色背景）目前會失敗，這是引擎限制
- 如果新增平台截圖後發現辨識失敗，請記錄並回報
- 每次引擎修改後，必須重新執行測試，確認沒有回歸
