import { headers } from "next/headers";
import type { Metadata } from "next";
import RoadAnalyzer from "./road-analyzer";
import { TRIAL_LIMIT, trialAccess } from "./trial-ip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "百家樂牌路分析器｜免登入 20 局免費試用－MT1399",
  description: "MT1399 百家樂牌路分析器支援手機與電腦截圖，免費試用 20 局，辨識大路、大眼仔路、小路及曱甴路；適用 MT、DG、T9、DB、W、EVO 等標準牌路介面。",
  keywords: ["百家樂路圖分析器", "百家樂路單分析", "百家樂預測程式", "百家樂問路", "百家樂", "百家樂牌路", "牌路分析", "MT 真人", "DG 真人", "T9 真人", "DB 真人", "W 真人", "EVO 真人", "大路", "大眼路", "大眼仔路", "小路", "曱甴路", "蟑螂路", "MT1399"],
  alternates: { canonical: "/analyze/" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "百家樂牌路分析器｜免登入 20 局免費試用｜MT1399",
    description: "上傳手機或電腦牌路截圖，免費試用 20 局，分析大路與三條衍生路。",
    url: "/analyze/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "百家樂牌路分析器｜免登入 20 局免費試用｜MT1399",
    description: "支援手機與電腦截圖的大路及三條衍生路分析工具。",
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MT1399 百家樂路圖分析器",
    url: "https://mt1399.com/analyze/",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Android, iOS, Windows, macOS",
    description: "免登入免費試用 20 局，支援手機與電腦截圖，辨識大路與下三路近期訊號的百家樂牌路分析工具。",
    featureList: ["免登入 20 局試用", "辨識大路", "辨識大眼仔路", "辨識小路", "辨識曱甴路", "下三路訊號整理", "莊閒問路分析", "範例牌路一鍵測試"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
    publisher: { "@type": "Organization", name: "MT1399", url: "https://mt1399.com/" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "手機如何使用 MT1399 百家樂牌路分析工具？",
        acceptedAnswer: { "@type": "Answer", text: "手機使用者可依三個步驟操作：1. 在百家樂遊戲中截取包含大路與下三路的完整畫面；2. 回到 MT1399 分析器，點選選擇手機截圖並從相簿上傳；3. 辨識完成後查看大路、大眼仔路、小路與曱甴路的近期訊號整理。" },
      },
      {
        "@type": "Question",
        name: "MT1399 百家樂路圖分析器會讀取哪些內容？",
        acceptedAnswer: { "@type": "Answer", text: "工具會辨識截圖中的大路、大眼仔路、小路與曱甴路，整理大路近期排列、下三路規律度、訊號一致度及可辨識樣本數，再輸出保守的牌路推估；不會讀取下注金額或遊戲帳號。" },
      },
      {
        "@type": "Question",
        name: "電腦如何貼上百家樂牌路截圖進行分析？",
        acceptedAnswer: { "@type": "Answer", text: "Windows 可按 Win、Shift、S 截取完整牌路，回到分析器後按 Ctrl、V；也可以點擊從剪貼簿貼上或拖曳圖片。圖片需清楚包含大路與下三路。" },
      },
      {
        "@type": "Question",
        name: "免費試用版如何計算使用次數？",
        acceptedAnswer: { "@type": "Answer", text: "同一連線 IP 可免費試用 20 局。只有成功辨識牌路並產生分析結果才會計算一次；無法辨識的圖片與範例圖片不會扣除使用次數。" },
      },
      {
        "@type": "Question",
        name: "其他百家樂遊戲可以使用嗎？",
        acceptedAnswer: { "@type": "Answer", text: "可以。MT 真人、DG、T9、DB、W、EVO 等遊戲，只要畫面採用可辨識的標準百家樂牌路介面即可上傳分析；特殊版型或截圖不完整時可能無法辨識。" },
      },
      {
        "@type": "Question",
        name: "百家樂牌路分析結果代表下一局一定會出現嗎？",
        acceptedAnswer: { "@type": "Answer", text: "不代表。分析結果是根據已辨識牌路的近期排列、下三路一致度與樣本品質進行訊號整理，不是勝率保證；牌局結果仍具有隨機性。" },
      },
    ],
  },
];

export default async function TrialPage() {
  let used = 0;
  let disabled = false;
  try {
    const access = await trialAccess(await headers());
    used = access.used;
    disabled = access.disabled;
  } catch {
    used = 0;
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <RoadAnalyzer trial={{ limit: TRIAL_LIMIT, used, disabled, lineUrl: "https://lin.ee/WG0xITo" }} />
  </>;
}
