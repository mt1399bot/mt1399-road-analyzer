"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCompositeRoadSnapshot, locateLiveRoadFromSource, readRoadFromImage, readRoadFromSource } from "./road-reader";
import type { Outcome, RoadRegion, RoadSnapshot } from "./road-reader";
import { consumeTrialUsage, requestJson } from "./json-request";
import type { TrialUsage } from "./json-request";

type CaptureMode = "live" | "upload";
type DeviceMode = "mobile" | "desktop";
type LiveStatus = "idle" | "starting" | "monitoring" | "stopped" | "error";
type TrialAccess = { limit: number; used: number; disabled: boolean; lineUrl: string };
type LearningBucket = { decisive: number; correct: number; ties: number };
type LearningProfile = {
  modelVersion: string;
  minimumSamples: number;
  totalFeedback: number;
  decisiveFeedback: number;
  buckets: Record<string, LearningBucket>;
};
type PredictionResult = NonNullable<ReturnType<typeof roadPrediction>>;
type PredictionRecord = {
  id: string;
  predictedSide: "B" | "P";
  banker: number;
  player: number;
  featureBucket: string;
};

const labels: Record<Outcome, string> = { B: "莊", P: "閒", T: "和" };
const STANDARD_ODDS = { banker: 45.8597, player: 44.6247, tie: 9.5156 } as const;
// Version policy: patch for copy/small fixes; minor for layout or interaction changes.
const APP_VERSION = "v1.12.6";

function trackSupportClick(source: string) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: string, eventName: string, parameters?: Record<string, unknown>) => void;
  };
  const parameters = { event_category: "contact", event_label: "LINE @mt7777", link_source: source };
  if (typeof analyticsWindow.gtag === "function") analyticsWindow.gtag("event", "generate_lead", parameters);
  else {
    analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
    analyticsWindow.dataLayer.push({ event: "generate_lead", ...parameters });
  }
}
const EMPTY_LEARNING_PROFILE: LearningProfile = {
  modelVersion: "v4-dual-road-feedback",
  minimumSamples: 12,
  totalFeedback: 0,
  decisiveFeedback: 0,
  buckets: {},
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function redShare(signals: RoadSnapshot["derived"]) {
  const useful = signals.filter((signal) => signal !== "G");
  return useful.length ? useful.filter((signal) => signal === "R").length / useful.length : 0.5;
}

function recencyWeightedBalance(signals: RoadSnapshot["derived"]) {
  const useful = signals.filter((signal) => signal !== "G").slice(-24);
  if (!useful.length) return 0;
  let weighted = 0;
  let totalWeight = 0;
  useful.forEach((signal, index) => {
    const weight = 0.65 + (index + 1) / useful.length;
    weighted += (signal === "R" ? 1 : -1) * weight;
    totalWeight += weight;
  });
  return totalWeight ? weighted / totalWeight : 0;
}

function patternScore(outcomes: Outcome[]) {
  const history = outcomes.slice(-30);
  if (history.length < 7) return { score: 0, agreement: 0, windows: 0 };
  const windowScores = [9, 16, 28]
    .filter((_size, index) => history.length >= [7, 12, 20][index])
    .map((size) => {
      const sample = history.slice(-size);
      let score = 0;
      let totalWeight = 0;

      for (let lag = 1; lag <= Math.min(4, Math.floor((sample.length - 1) / 2)); lag += 1) {
        let correlation = 0;
        let comparisons = 0;
        for (let index = lag; index < sample.length; index += 1) {
          correlation += sample[index] === sample[index - lag] ? 1 : -1;
          comparisons += 1;
        }
        const normalized = comparisons ? correlation / comparisons : 0;
        const reliability = clamp((Math.abs(normalized) - 0.2) / 0.8, 0, 1);
        if (!reliability) continue;
        const anchor = sample[sample.length - lag] === "B" ? 1 : -1;
        const direction = normalized >= 0 ? anchor : -anchor;
        const weight = reliability / lag;
        score += direction * weight;
        totalWeight += weight;
      }

      const last = sample.at(-1);
      if (last) {
        let run = 1;
        for (let index = sample.length - 2; index >= 0 && sample[index] === last; index -= 1) run += 1;
        const recent = sample.slice(-8);
        const transitions = recent.slice(1).reduce((sum, value, index) => sum + Number(value !== recent[index]), 0);
        const alternation = transitions / Math.max(1, recent.length - 1);
        if (run >= 2) {
          const weight = Math.min(0.7, 0.18 + run * 0.1);
          score += (last === "B" ? 1 : -1) * weight;
          totalWeight += weight;
        } else if (alternation >= 0.68) {
          const weight = Math.min(0.65, (alternation - 0.5) * 1.6);
          score += (last === "B" ? -1 : 1) * weight;
          totalWeight += weight;
        }
      }
      return totalWeight ? clamp(score / totalWeight, -1, 1) : 0;
    });

  const meaningful = windowScores.filter((score) => Math.abs(score) >= 0.12);
  if (!meaningful.length) return { score: 0, agreement: 0, windows: windowScores.length };
  const positive = meaningful.filter((score) => score > 0).length;
  const negative = meaningful.length - positive;
  const agreement = Math.max(positive, negative) / meaningful.length;
  const score = windowScores.reduce((sum, value, index) => sum + value * [0.48, 0.32, 0.2][index], 0)
    / windowScores.reduce((sum, _value, index) => sum + [0.48, 0.32, 0.2][index], 0);
  return { score: clamp(score, -1, 1), agreement, windows: windowScores.length };
}

function roadPrediction(
  snapshot: RoadSnapshot | null,
  learningProfile?: LearningProfile | null,
) {
  const baseDecisive = STANDARD_ODDS.banker + STANDARD_ODDS.player;
  const baseBanker = (STANDARD_ODDS.banker / baseDecisive) * 100;
  if (!snapshot || snapshot.markerCount < 6) {
    return null;
  }

  const outcomes = snapshot.outcomes.filter((item) => item !== "T");
  const pattern = patternScore(outcomes);
  const beadDecisive = snapshot.beadPlate.filter((item) => item !== "T");
  const bigRoadDecisive = snapshot.bigRoadOutcomes.filter((item) => item !== "T");
  const hasDualDirectRoads = beadDecisive.length >= 6 && bigRoadDecisive.length >= 6;
  const directRoadAgreement = hasDualDirectRoads
    ? clamp(1 - Math.abs(
      beadDecisive.filter((item) => item === "B").length / beadDecisive.length
      - bigRoadDecisive.filter((item) => item === "B").length / bigRoadDecisive.length,
    ) / 0.22, 0.55, 1)
    : 0.82;

  const separatedRoads = [
    { signals: snapshot.bigEyeRoad, weight: 0.46 },
    { signals: snapshot.smallRoad, weight: 0.33 },
    { signals: snapshot.cockroachRoad, weight: 0.21 },
  ].filter((road) => road.signals.length >= 3);
  const derivedRoads = separatedRoads.length
    ? separatedRoads
    : snapshot.derived.length >= 5 ? [{ signals: snapshot.derived, weight: 0.35 }] : [];
  // The three derived roads describe regularity/choppiness, not Banker/Player. They only calibrate signal strength.
  const derivedBalances = derivedRoads.map((road) => ({
    balance: recencyWeightedBalance(road.signals),
    weight: road.weight * Math.min(1, road.signals.length / 10),
  }));
  const derivedWeight = derivedBalances.reduce((sum, road) => sum + road.weight, 0);
  const derivedClarity = derivedWeight
    ? derivedBalances.reduce((sum, road) => sum + Math.abs(road.balance) * road.weight, 0) / derivedWeight
    : 0;
  const derivedDirectionAgreement = derivedBalances.length <= 1
    ? derivedClarity
    : Math.abs(derivedBalances.reduce((sum, road) => sum + Math.sign(road.balance) * road.weight, 0)) / Math.max(0.01, derivedWeight);

  const bankerAsk = snapshot.askBanker.filter((signal) => signal !== "G");
  const playerAsk = snapshot.askPlayer.filter((signal) => signal !== "G");
  let askScore = 0;
  if (bankerAsk.length >= 2 && playerAsk.length >= 2) {
    askScore = clamp((redShare(bankerAsk) - redShare(playerAsk)) * 2, -1, 1);
  }

  const hasPattern = outcomes.length >= 7 && Math.abs(pattern.score) >= 0.12;
  const hasAskRoad = Math.abs(askScore) >= 0.12;
  const combinedScore = hasPattern && hasAskRoad
    ? pattern.score * 0.72 + askScore * 0.28
    : hasPattern ? pattern.score : hasAskRoad ? askScore : 0;
  const sampleQuality = hasAskRoad && !outcomes.length ? Math.min(1, Math.min(bankerAsk.length, playerAsk.length) / 5) : Math.min(1, outcomes.length / 24);
  const recognitionQuality = clamp((snapshot.confidence - 0.45) / 0.45, 0.35, 1);
  const roadCalibration = (derivedRoads.length ? 0.82 + 0.18 * derivedClarity * derivedDirectionAgreement : 0.78)
    * (0.9 + directRoadAgreement * 0.1);
  const tendency = combinedScore * 1.65 * sampleQuality * recognitionQuality * roadCalibration;
  const conflictingWindows = hasPattern && pattern.agreement < 0.67;
  const rawWeakSignal = Math.abs(tendency) < 0.42 || (!hasAskRoad && outcomes.length < 9) || conflictingWindows;
  const rawCalibratedTendency = rawWeakSignal ? 0 : tendency;
  const rawBanker = clamp(baseBanker + rawCalibratedTendency, 49.1, 52.3);
  const rawPredictedSide = rawBanker >= 50 ? "B" : "P";
  const rawAbsoluteTendency = Math.abs(rawCalibratedTendency);
  const rawStrength = rawWeakSignal ? "觀望" : snapshot.markerCount >= 20 && pattern.agreement >= 0.67 && rawAbsoluteTendency >= 0.9 ? "中" : "低";
  const allThreeRoads = snapshot.bigEyeRoad.length > 0 && snapshot.smallRoad.length > 0 && snapshot.cockroachRoad.length > 0;
  const signal = snapshot.mode === "ask-road" ? "莊／閒問路"
    : hasDualDirectRoads && allThreeRoads ? "珠盤＋大路＋三路"
      : snapshot.beadPlate.length && allThreeRoads ? "珠盤＋三路"
        : allThreeRoads ? "大路＋三路" : snapshot.derived.length ? "大路＋衍生路" : snapshot.beadPlate.length ? "珠盤路" : "大路";
  const signalClass = snapshot.mode === "ask-road" ? "ask" : allThreeRoads ? "composite" : "basic";
  const strengthClass = rawStrength === "觀望" ? "watch" : rawStrength === "中" ? "medium" : "low";
  const featureBucket = `${signalClass}:${strengthClass}:${rawPredictedSide}`;
  const learned = learningProfile?.buckets[featureBucket];
  const learningSamples = learned?.decisive ?? 0;
  const learningHitRate = learned?.decisive ? learned.correct / learned.decisive : null;
  const learningApplied = Boolean(learned && learned.decisive >= (learningProfile?.minimumSamples ?? 12));
  const learnedWeakSignal = Boolean(learningApplied && learned && learned.decisive >= 20 && (learningHitRate ?? 0.5) < 0.46);
  const learningBoost = learningApplied && (learningHitRate ?? 0.5) > 0.5
    ? clamp(1 + ((learningHitRate ?? 0.5) - 0.5) * 0.6, 1, 1.1)
    : 1;
  const calibratedTendency = rawCalibratedTendency * learningBoost;
  const banker = clamp(baseBanker + calibratedTendency, 49.1, 52.3);
  const predictedSide = banker >= 50 ? "B" : "P";
  const strength = rawWeakSignal || learnedWeakSignal ? "觀望" : rawStrength;
  const baseNote = rawWeakSignal
    ? conflictingWindows ? "短、中期訊號互相衝突，維持理論基準" : "樣本或訊號不足，維持理論基準"
    : hasAskRoad && hasPattern ? "問路方向與多時間窗形態一致，已保守校準"
      : hasAskRoad ? "依莊／閒問路差異保守校準"
        : derivedRoads.length ? "短、中期形態同向，並以三路一致度校準" : "依大路多時間窗形態保守校準";
  const note = learnedWeakSignal
    ? `${baseNote}；同類訊號累積 ${learningSamples} 局後可靠度偏低，本局降為觀望`
    : learningApplied ? `${baseNote}；已套用 ${learningSamples} 局同類回報校準` : baseNote;
  return {
    banker,
    player: 100 - banker,
    tie: STANDARD_ODDS.tie,
    strength,
    signal,
    note,
    predictedSide,
    signalClass,
    strengthClass,
    featureBucket,
    learningSamples,
    learningHitRate,
    learningApplied,
    hasDualDirectRoads,
    directRoadAgreement,
  };
}

function liveRoadOnly(snapshot: RoadSnapshot) {
  if (!isCompositeRoadSnapshot(snapshot)) return null;
  const outcomes = snapshot.outcomes;
  const derived = snapshot.derived;
  return {
    ...snapshot,
    askBanker: [],
    askPlayer: [],
    markerCount: outcomes.length + derived.length,
    signature: `${outcomes.join("")}|${snapshot.bigEyeRoad.join("")}|${snapshot.smallRoad.join("")}|${snapshot.cockroachRoad.join("")}||`,
  } satisfies RoadSnapshot;
}

function liveRoadStateKey(snapshot: RoadSnapshot) {
  return [
    snapshot.outcomes.join(""),
    snapshot.bigEyeRoad.length,
    snapshot.smallRoad.length,
    snapshot.cockroachRoad.length,
  ].join("|");
}

function isNextCompletedRound(previous: RoadSnapshot, candidate: RoadSnapshot) {
  if (candidate.outcomes.length !== previous.outcomes.length + 1) return false;
  const sampleLength = Math.min(18, previous.outcomes.length);
  const previousTail = previous.outcomes.slice(-sampleLength);
  const candidateTail = candidate.outcomes.slice(0, -1).slice(-sampleLength);
  const matchingMarkers = previousTail.reduce(
    (count, outcome, index) => count + Number(outcome === candidateTail[index]),
    0,
  );
  return matchingMarkers >= Math.ceil(sampleLength * 0.85);
}

function Icon({ name, size = 20 }: { name: "paste" | "scan" | "shield" | "chart" | "info" | "logout" | "monitor" | "stop" | "line" | "chat"; size?: number }) {
  const paths = {
    paste: <><rect x="7" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h8v2"/><path d="M5 17H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1"/></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    chart: <><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="m8 11 2.3 2.3L16 8"/></>,
    stop: <><rect x="5" y="5" width="14" height="14" rx="2"/></>,
    line: <><path d="M20 11.4c0 4-3.8 7.2-8.5 7.2-.8 0-1.6-.1-2.3-.3L5 20l1.2-3.1C4.5 15.6 3.5 13.7 3.5 11.4c0-4 3.8-7.2 8.5-7.2s8 3.2 8 7.2Z"/><path d="M8 9v4h2"/><path d="M12 9v4"/><path d="m14 13 3-4v4"/></>,
    chat: <><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function TrialGrowthContent({ lineUrl }: { lineUrl: string }) {
  const articles = [
    {
      tag: "牌路完整教學",
      title: "百家樂看路大全：珠盤路、大路與下三路",
      description: "從珠盤路、大路到大眼路、小路與小強路，整理各路單的用途與起算位置。",
      href: "https://mt1399.com/baccarat-road-analysis",
    },
    {
      tag: "術語查詢",
      title: "百家樂牌路術語大全：長龍、單跳與雙跳",
      description: "快速查詢常見牌路名稱、紅藍符號與衍生路術語，避免把歷史路型當成必然結果。",
      href: "https://mt1399.com/baccarat-terms-guide",
    },
    {
      tag: "MT 功能實測",
      title: "MT Baccarat 功能與使用體驗觀察",
      description: "查看手機、電腦、路單與多桌模式的實際介面，了解不同裝置的顯示差異。",
      href: "https://mt1399.com/mt-baccarat-review",
    },
    {
      tag: "策略與風險",
      title: "百家樂策略與資金管理：牌路能做什麼？",
      description: "說明牌路是歷史結果整理工具，並解析常見注碼方法的用途與限制。",
      href: "https://mt1399.com/mt-baccarat-strategy",
    },
  ];

  return <div className="growth-content">
    <section className="seo-intro" aria-labelledby="baccarat-prediction-guide">
      <div className="seo-intro-copy">
        <p className="section-kicker">MT1399 BACCARAT GUIDE</p>
        <h2 id="baccarat-prediction-guide">百家樂牌路分析器使用教學與牌路規則說明</h2>
        <p>上傳手機或電腦牌路截圖，即時分析大路與三條衍生路。不限 MT 真人亦支援 DG、T9、DB、W、EVO 等採用標準牌路介面的百家樂遊戲。</p>
      </div>
      <aside className="seo-conversion-card">
        <span>更多百家樂教學</span>
        <strong>前往 MT1399 查看完整玩法、策略與最新文章</strong>
        <div><a className="growth-cta primary" href="https://mt1399.com/" target="_blank" rel="noreferrer">進入 MT1399 <b>→</b></a><a className="growth-cta secondary" href={lineUrl} target="_blank" rel="noreferrer" onClick={() => trackSupportClick("guide_card")}><Icon name="chat" size={17} /> 聯繫官方客服</a></div>
      </aside>
    </section>

    <section className="road-explainer" aria-labelledby="road-analysis-title">
      <div className="content-heading"><p>ROAD MAP ANALYSIS</p><h2 id="road-analysis-title">百家樂牌路分析會看哪些資料？</h2><span>系統會分開整理四種牌路，不會把下方紅藍訊號直接當成莊或閒。</span></div>
      <div className="road-explainer-grid">
        <article><b>01</b><h3>大路</h3><p>記錄每局莊、閒與和的排列，是百家樂預測分析的主要資料來源。</p></article>
        <article><b>02</b><h3>大眼路（大眼仔路）</h3><p>用來觀察大路排列是否整齊，以及近期結構是否持續一致。</p></article>
        <article><b>03</b><h3>小路</h3><p>從不同間隔比較牌路結構，協助判斷訊號是否互相呼應。</p></article>
        <article><b>04</b><h3>曱甴路（蟑螂路）</h3><p>補充觀察較長間隔的規律變化，作為訊號強弱的校準依據。</p></article>
      </div>
    </section>

    <section className="method-section" aria-labelledby="analysis-method-title">
      <div className="content-heading"><p>HOW IT WORKS</p><h2 id="analysis-method-title">百家樂牌路辨識分析如何產生結果？</h2><span>公開目前工具實際使用的訊號來源與限制，不刊登尚未完成驗證的準確率。</span></div>
      <div className="method-grid">
        <article><span>01</span><div><h3>辨識完整牌路</h3><p>先從截圖讀取大路、大眼仔路、小路與曱甴路；圖片模糊、裁切不完整或版型特殊時，可能無法產生結果。</p></div></article>
        <article><span>02</span><div><h3>比較近期排列</h3><p>大路會以不同長度的近期區間比較連續、跳動與重複形態，不只依最後一局直接判斷。</p></div></article>
        <article><span>03</span><div><h3>校準訊號強弱</h3><p>下三路只用來觀察牌路整齊度與一致性，不會把紅藍符號直接解讀為莊或閒。</p></div></article>
        <article><span>04</span><div><h3>不足時維持觀望</h3><p>當可辨識樣本太少、短中期訊號衝突或畫面信心不足時，系統會降低強度並顯示觀望。</p></div></article>
      </div>
    </section>

    <section className="faq-section" aria-labelledby="prediction-faq">
      <div className="content-heading"><p>FAQ</p><h2 id="prediction-faq">百家樂預測常見問題</h2><span>快速了解支援平台、手機上傳、電腦貼上、辨識內容與試用次數。</span></div>
      <div className="faq-list">
        <details><summary>其他百家樂遊戲可以使用嗎？<b>＋</b></summary><p>可以。<strong>MT 真人、DG、T9、DB、W、EVO 等遊戲</strong>，只要畫面採用可辨識的標準百家樂牌路介面即可上傳分析；特殊版型或截圖不完整時可能無法辨識。</p></details>
        <details><summary>手機如何使用 MT1399 百家樂牌路分析工具？<b>＋</b></summary><div className="faq-answer"><p>手機使用者可依 3 個步驟完成牌路分析：</p><ol><li><strong>截取畫面：</strong>在百家樂遊戲中擷取包含大路與下三路的完整牌路。</li><li><strong>上傳圖片：</strong>回到本頁點選「選擇手機截圖」，再從相簿選取圖片。</li><li><strong>查看結果：</strong>辨識完成後，查看大路與三條衍生路的近期訊號整理。</li></ol></div></details>
        <details><summary>電腦如何貼上百家樂牌路截圖進行分析？<b>＋</b></summary><p>Windows 可按 Win＋Shift＋S 截取完整牌路，回到分析器後按 Ctrl＋V；也可以點擊「從剪貼簿貼上」或直接拖曳圖片。圖片需清楚包含大路與下三路。</p></details>
        <details><summary>MT1399 百家樂路圖分析器會讀取哪些內容？<b>＋</b></summary><p>工具會辨識截圖中的大路、大眼仔路、小路與曱甴路，整理大路近期排列、下三路規律度、訊號一致度及可辨識樣本數，再輸出保守的牌路推估；不會讀取下注金額或遊戲帳號。</p></details>
        <details><summary>免費試用次數怎麼計算？<b>＋</b></summary><p>同一連線 IP 共有 20 局免費額度。只有成功辨識牌路並產生分析結果才會計算一次；無法辨識、沒有產生結果或載入範例圖片時不會扣除使用次數。</p></details>
        <details><summary>百家樂牌路分析結果代表下一局一定會出現嗎？<b>＋</b></summary><p>不代表。分析結果是根據已辨識牌路的近期排列、下三路一致度與樣本品質進行訊號整理，不是勝率保證；牌局結果仍具有隨機性。</p></details>
      </div>
    </section>

    <section className="article-section" aria-labelledby="mt1399-articles">
      <div className="content-heading article-heading"><div><p>MT1399 UPDATED GUIDE</p><h2 id="mt1399-articles">分析後延伸閱讀：牌路規則與 MT 功能</h2></div><a href="https://mt1399.com/" target="_blank" rel="noreferrer">查看全部文章 →</a></div>
      <div className="article-update">
        <span>牌路資訊更新</span>
        <p>大眼路、小路與小強路分別從大路不同位置開始推導；衍生路的紅藍符號反映排列結構，不直接代表莊或閒。「莊問路／閒問路」也只是模擬下一局出現不同結果時，路單可能如何變化，並非勝負保證。</p>
        <a href="https://mt1399.com/baccarat-road-analysis" target="_blank" rel="noreferrer">查看完整起算規則 →</a>
      </div>
      <div className="article-grid">{articles.map((article, index) => <a key={article.href} href={article.href} target="_blank" rel="noreferrer">
        <span>{article.tag}</span><b>0{index + 1}</b><h3>{article.title}</h3><p>{article.description}</p><strong>閱讀文章 <i>→</i></strong>
      </a>)}</div>
    </section>

    <section className="bottom-conversion">
      <div><p>MT1399 OFFICIAL</p><h2>想看更多百家樂預測教學與最新文章？</h2><span>前往 MT1399 瀏覽完整內容，或直接聯繫官方客服取得協助。</span></div>
      <div><a className="growth-cta light" href="https://mt1399.com/" target="_blank" rel="noreferrer">前往 MT1399</a><a className="growth-cta glass" href={lineUrl} target="_blank" rel="noreferrer" onClick={() => trackSupportClick("bottom_conversion")}><Icon name="chat" size={17} /> 專人服務</a></div>
    </section>

    <footer className="growth-footer"><div><span>© MT1399 百家樂資訊與牌路分析</span><p>分析結果為牌路訊號整理，不代表下一局必然結果。</p></div><nav><a href="https://mt1399.com/" target="_blank" rel="noreferrer">MT1399 官網</a><a href={lineUrl} target="_blank" rel="noreferrer" onClick={() => trackSupportClick("footer")}>官方 LINE</a></nav></footer>
  </div>;
}

function longestStreak(road: Outcome[]) {
  let best = 0;
  let current = 0;
  let previous: Outcome | null = null;
  road.filter((item) => item !== "T").forEach((item) => {
    current = item === previous ? current + 1 : 1;
    best = Math.max(best, current);
    previous = item;
  });
  return best;
}

function activeStreak(road: Outcome[]) {
  const withoutTies = road.filter((item) => item !== "T");
  const last = withoutTies.at(-1);
  if (!last) return "尚無資料";
  let count = 0;
  for (let index = withoutTies.length - 1; index >= 0 && withoutTies[index] === last; index -= 1) count += 1;
  return `${labels[last]} ${count} 連`;
}

function timeLabel() {
  return new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}

export default function RoadAnalyzer({ trial }: { trial: TrialAccess }) {
  const isTrial = true as const;
  const usageLimit = trial.limit;
  const [captureMode, setCaptureMode] = useState<CaptureMode>("upload");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("mobile");
  const [preview, setPreview] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoadSnapshot | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [liveMessage, setLiveMessage] = useState("選擇 MT 百家的分頁或視窗後，系統會持續辨識新局");
  const [lastDetectedAt, setLastDetectedAt] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pasteMessage, setPasteMessage] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [usedToday, setUsedToday] = useState(trial.used);
  const [trialExhausted, setTrialExhausted] = useState(trial.used >= usageLimit);
  const [trialDisabled, setTrialDisabled] = useState(trial.disabled);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const monitorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const analyzingRef = useRef(false);
  const pendingTrialRequestIdRef = useRef<string | null>(null);
  const frameReadingRef = useRef(false);
  const acceptedSnapshotRef = useRef<RoadSnapshot | null>(null);
  const pendingStateKeyRef = useRef("");
  const pendingCountRef = useRef(0);
  const missingFramesRef = useRef(0);
  const liveRegionRef = useRef<RoadRegion | null>(null);
  const learningProfileRef = useRef<LearningProfile>(EMPTY_LEARNING_PROFILE);
  const latestSnapshotRef = useRef<RoadSnapshot | null>(null);
  const activePredictionRef = useRef<PredictionRecord | null>(null);
  const reportedPredictionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const detectDevice = () => {
      const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      setDeviceMode(mobileUserAgent || (coarsePointer.matches && window.innerWidth < 980) ? "mobile" : "desktop");
    };
    detectDevice();
    window.addEventListener("resize", detectDevice);
    coarsePointer.addEventListener?.("change", detectDevice);
    return () => {
      window.removeEventListener("resize", detectDevice);
      coarsePointer.removeEventListener?.("change", detectDevice);
    };
  }, []);

  const road = useMemo(() => snapshot?.outcomes ?? [], [snapshot]);
  const trialUnavailable = trialExhausted || trialDisabled;
  const liveAnalysisEnabled = false as const;
  const learningEnabled = true as const;

  const stats = useMemo(() => {
    const banker = road.filter((item) => item === "B").length;
    const player = road.filter((item) => item === "P").length;
    const tie = road.filter((item) => item === "T").length;
    const decisive = banker + player;
    return {
      banker,
      player,
      tie,
      bankerShare: decisive ? (banker / decisive) * 100 : 0,
      playerShare: decisive ? (player / decisive) * 100 : 0,
      streak: activeStreak(road),
      longest: longestStreak(road),
    };
  }, [road]);

  useEffect(() => {
    if (!isTrial) return;
    void requestJson<TrialUsage>("/analyze/api/trial/status")
      .then(({ value }) => {
        if (typeof value.used !== "number") return;
        setUsedToday(value.used);
        setTrialExhausted(value.used >= (value.limit ?? usageLimit));
        setTrialDisabled(Boolean(value.disabled));
        if (value.disabled) setAnalysisError("此 IP 的免費試用已被管理員停用");
      })
      .catch((cause) => setAnalysisError(cause instanceof Error ? cause.message : "目前無法讀取免費試用局數"));
  }, [isTrial, usageLimit]);

  useEffect(() => {
    if (!learningEnabled) return;
    let active = true;
    void fetch("/analyze/api/learning", { cache: "no-store" })
      .then(async (response) => {
        const value = await response.json() as { profile?: LearningProfile };
        if (!active || !response.ok || !value.profile) return;
        learningProfileRef.current = value.profile;
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [learningEnabled]);

  useEffect(() => {
    if (isTrial) return;
    let active = true;
    const reportPresence = () => {
      void fetch("/analyze/api/member/presence", { method: "POST", keepalive: true })
        .then((response) => {
          if (active && (response.status === 401 || response.status === 403)) window.location.replace("/");
        })
        .catch(() => undefined);
    };
    reportPresence();
    const timer = window.setInterval(reportPresence, 45_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reportPresence();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isTrial]);

  const commitAnalysis = useCallback(async (parsed: RoadSnapshot, mode: CaptureMode, recordLearning = true) => {
    if (learningEnabled && recordLearning) {
      const previousPrediction = activePredictionRef.current;
      const previousSnapshot = latestSnapshotRef.current;
      activePredictionRef.current = null;

      if (previousPrediction && !reportedPredictionIdsRef.current.has(previousPrediction.id)) {
        reportedPredictionIdsRef.current.add(previousPrediction.id);
        const detectedOutcome = previousSnapshot && isNextCompletedRound(previousSnapshot, parsed)
          ? parsed.outcomes.at(-1)
          : undefined;

        if (detectedOutcome) {
          try {
            const response = await fetch("/analyze/api/learning", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                predictionId: previousPrediction.id,
                actualOutcome: detectedOutcome,
                detected: true,
              }),
            });
            const value = await response.json() as {
              correct?: boolean | null;
              profile?: LearningProfile;
              error?: string;
            };
            if (!response.ok) throw new Error(value.error || "目前無法自動儲存開牌結果");
            if (value.profile) {
              learningProfileRef.current = value.profile;
            }
          } catch { /* Automatic learning must not interrupt or distract the member. */ }
        }
      }

      latestSnapshotRef.current = parsed;
    }

    const nextPrediction = roadPrediction(parsed, learningEnabled ? learningProfileRef.current : null);
    setSnapshot(parsed);
    setPrediction(nextPrediction);

    if (!learningEnabled || !recordLearning || !nextPrediction) return;

    try {
      const response = await fetch("/analyze/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictedSide: nextPrediction.predictedSide,
          bankerTenths: Math.round(nextPrediction.banker * 10),
          signalClass: nextPrediction.signalClass,
          strengthClass: nextPrediction.strengthClass,
          captureMode: mode,
          signature: parsed.signature,
        }),
      });
      const value = await response.json() as {
        prediction?: { id: string; predictedSide: "B" | "P"; featureBucket: string };
        error?: string;
      };
      if (!response.ok || !value.prediction) throw new Error(value.error || "無法建立學習紀錄");
      const record: PredictionRecord = {
        id: value.prediction.id,
        predictedSide: value.prediction.predictedSide,
        banker: nextPrediction.banker,
        player: nextPrediction.player,
        featureBucket: value.prediction.featureBucket,
      };
      activePredictionRef.current = record;
    } catch { /* Analysis remains available when anonymous learning storage is unavailable. */ }
  }, [learningEnabled]);

  const consumeUsage = useCallback(async (mode: "screenshot" | "live" = "screenshot") => {
    if (isTrial && !pendingTrialRequestIdRef.current) {
      try {
        pendingTrialRequestIdRef.current = sessionStorage.getItem("mt1399-pending-trial-request");
      } catch { /* Storage may be unavailable in an embedded browser. */ }
      pendingTrialRequestIdRef.current ||= crypto.randomUUID();
      try {
        sessionStorage.setItem("mt1399-pending-trial-request", pendingTrialRequestIdRef.current);
      } catch { /* The in-memory ID still protects retries in this tab. */ }
    }
    const { response: usageResponse, value: usage } = isTrial
      ? await consumeTrialUsage(pendingTrialRequestIdRef.current!)
      : await requestJson<TrialUsage>("/analyze/api/member/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    if (!isTrial && (usageResponse.status === 401 || (usageResponse.status === 403 && !usage.error?.includes("畫面即時分析")))) {
      window.location.replace("/");
      throw new Error("請重新登入");
    }
    if (!usageResponse.ok) {
      if (isTrial && usageResponse.status === 429) setTrialExhausted(true);
      if (isTrial && usageResponse.status === 403 && usage.disabled) setTrialDisabled(true);
      throw new Error(usage.error || "目前無法進行分析");
    }
    const used = isTrial ? usage.used : usage.usedToday;
    if (typeof used !== "number") throw new Error("試用服務回應不完整，請稍後重試");
    if (isTrial) {
      pendingTrialRequestIdRef.current = null;
      try { sessionStorage.removeItem("mt1399-pending-trial-request"); } catch { /* Optional retry state. */ }
    }
    if (typeof used !== "number") throw new Error("目前無法記錄分析次數");
    setUsedToday(used);
    if (isTrial && used >= (usage.limit ?? usageLimit)) setTrialExhausted(true);
    return used;
  }, [isTrial, usageLimit]);

  const stopLive = useCallback((message = "即時監控已停止") => {
    if (monitorTimerRef.current) {
      clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    frameReadingRef.current = false;
    liveRegionRef.current = null;
    acceptedSnapshotRef.current = null;
    pendingStateKeyRef.current = "";
    pendingCountRef.current = 0;
    setLiveStatus("stopped");
    setLiveMessage(message);
    setStatus((current) => current === "ready" ? current : "idle");
  }, []);

  const inspectLiveFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || frameReadingRef.current || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    frameReadingRef.current = true;
    try {
      const lockedRegion = liveRegionRef.current;
      const sourceSnapshot = !lockedRegion
        ? locateLiveRoadFromSource(video, video.videoWidth, video.videoHeight)
        : readRoadFromSource(video, video.videoWidth, video.videoHeight, lockedRegion);
      const parsed = liveRoadOnly(sourceSnapshot);
      if (!parsed) {
        missingFramesRef.current += 1;
        if (lockedRegion && missingFramesRef.current >= 12) {
          liveRegionRef.current = null;
          pendingStateKeyRef.current = "";
          pendingCountRef.current = 0;
          setLiveMessage("牌路區持續被遮擋，正在重新鎖定同一種標準牌路面板…");
          return;
        }
        if (missingFramesRef.current === 4) setLiveMessage("本局預測維持不變，等待標準牌路白色格線區恢復顯示");
        return;
      }
      missingFramesRef.current = 0;
      const newlyLocked = !lockedRegion && parsed.region;
      if (newlyLocked) {
        liveRegionRef.current = parsed.region;
      }
      const accepted = acceptedSnapshotRef.current;
      if (accepted && !isNextCompletedRound(accepted, parsed)) {
        pendingStateKeyRef.current = "";
        pendingCountRef.current = 0;
        setLiveMessage("本局預測已鎖定，等待大路確定新增 1 個結果");
        return;
      }
      const stateKey = liveRoadStateKey(parsed);
      if (stateKey === pendingStateKeyRef.current) pendingCountRef.current += 1;
      else {
        pendingStateKeyRef.current = stateKey;
        pendingCountRef.current = 1;
        setLiveMessage(newlyLocked ? "已鎖定標準牌路面板，正在確認目前局數…" : "大路新增結果，正在等待畫面穩定…");
      }
      if (pendingCountRef.current < 4) return;
      const used = await consumeUsage("live");
      acceptedSnapshotRef.current = parsed;
      pendingStateKeyRef.current = "";
      pendingCountRef.current = 0;
      await commitAnalysis(parsed, "live");
      setStatus("ready");
      setLastDetectedAt(timeLabel());
      setLiveMessage("本局預測已鎖定，等待大路確定新增 1 個結果");
      if (isTrial && used >= usageLimit) stopLive("免費試用次數已用完");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "畫面辨識暫時中斷，系統正在重試…";
      if ((isTrial && (message.includes("試用次數已用完") || message.includes("停用"))) || message.includes("尚未開通")) stopLive(message);
      else setLiveMessage(message);
    } finally {
      frameReadingRef.current = false;
    }
  }, [commitAnalysis, consumeUsage, isTrial, stopLive, usageLimit]);

  const startLive = useCallback(async () => {
    setAnalysisError("");
    if (trialUnavailable || !liveAnalysisEnabled) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setLiveStatus("error");
      setLiveMessage("此瀏覽器不支援即時監控，請改用電腦版 Chrome");
      return;
    }
    setLiveStatus("starting");
    setLiveMessage("請在 Chrome 視窗選擇 MT 百家的分頁或視窗");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5, max: 8 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("無法建立畫面預覽");
      video.srcObject = stream;
      await video.play();
      setSnapshot(null);
      setPrediction(null);
      setStatus("reading");
      setLastDetectedAt("");
      setLiveStatus("monitoring");
      setLiveMessage("監控中，只鎖定標準大路＋下方三路白色格線面板");
      acceptedSnapshotRef.current = null;
      liveRegionRef.current = null;
      pendingStateKeyRef.current = "";
      pendingCountRef.current = 0;
      missingFramesRef.current = 0;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopLive("Chrome 已停止分享畫面"), { once: true });
      monitorTimerRef.current = setInterval(() => void inspectLiveFrame(), 650);
      window.setTimeout(() => void inspectLiveFrame(), 250);
    } catch (cause) {
      const stream = streamRef.current;
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      const message = cause instanceof Error && cause.name === "NotAllowedError"
        ? "你已取消畫面分享，尚未扣除分析局數"
        : cause instanceof Error ? cause.message : "目前無法開始即時監控";
      setLiveStatus("error");
      setLiveMessage(message);
      setStatus("idle");
    }
  }, [inspectLiveFrame, liveAnalysisEnabled, stopLive, trialUnavailable]);

  const analyzeFile = useCallback(async (selected: File, automatic = false) => {
    if (analyzingRef.current || trialUnavailable) return;
    analyzingRef.current = true;
    setAnalysisError("");
    setStatus("reading");
    if (automatic) setPasteMessage("截圖已取得，正在自動分析…");
    try {
      const parsed = await readRoadFromImage(selected);
      if (parsed.markerCount < 6) throw new Error("沒有辨識到指定牌路區，請截取莊／閒問路或大路與下方衍生路");
      await consumeUsage();
      await commitAnalysis(parsed, "upload");
      setStatus("ready");
      if (automatic) setPasteMessage("已完成自動分析，可直接貼上下一局");
    } catch (cause) {
      setStatus("idle");
      setAnalysisError(cause instanceof Error ? cause.message : "目前無法進行分析");
      if (automatic) setPasteMessage("自動分析失敗，請重新截圖貼上");
    } finally {
      analyzingRef.current = false;
    }
  }, [commitAnalysis, consumeUsage, trialUnavailable]);

  const chooseFile = useCallback((selected?: File, source: "upload" | "paste" = "upload") => {
    if (!selected || !selected.type.startsWith("image/")) return;
    if (trialUnavailable) {
      setAnalysisError(trialDisabled ? "此 IP 的免費試用已被管理員停用" : "免費試用次數已用完");
      return;
    }
    if (analyzingRef.current) {
      setPasteMessage("正在分析上一張截圖，請稍後再貼");
      return;
    }
    setPreview(() => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const next = URL.createObjectURL(selected);
      previewUrlRef.current = next;
      return next;
    });
    setStatus("idle");
    setPasteMessage(source === "paste" ? "已從剪貼簿取得截圖" : "已選取截圖");
    void analyzeFile(selected, true);
  }, [analyzeFile, trialDisabled, trialUnavailable]);

  const loadSample = useCallback(async () => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setCaptureMode("upload");
    setAnalysisError("");
    setPasteMessage("正在載入範例牌路…");
    setStatus("reading");
    try {
      const response = await fetch("/analyze/sample-baccarat-road.png");
      if (!response.ok) throw new Error("範例圖片載入失敗");
      const blob = await response.blob();
      const sample = new File([blob], "sample-baccarat-road.png", { type: blob.type || "image/png" });
      const parsed = await readRoadFromImage(sample);
      if (parsed.markerCount < 6) throw new Error("範例牌路暫時無法辨識");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreview("/analyze/sample-baccarat-road.png");
      await commitAnalysis(parsed, "upload", false);
      setStatus("ready");
      setPasteMessage("範例分析完成；此操作不扣免費試用次數");
    } catch (cause) {
      setStatus("idle");
      setAnalysisError(cause instanceof Error ? cause.message : "目前無法載入範例");
      setPasteMessage("");
    } finally {
      analyzingRef.current = false;
    }
  }, [commitAnalysis]);

  const selectMode = (mode: CaptureMode) => {
    if (captureMode === "live" && mode === "upload" && streamRef.current) stopLive();
    setCaptureMode(mode);
    setAnalysisError("");
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"));
      const pastedImage = imageItem?.getAsFile();
      if (!pastedImage) return;
      event.preventDefault();
      if (streamRef.current) stopLive("已切換為截圖分析");
      setCaptureMode("upload");
      chooseFile(pastedImage, "paste");
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [chooseFile, stopLive]);

  useEffect(() => () => {
    if (monitorTimerRef.current) clearInterval(monitorTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const pasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error("Clipboard read unavailable");
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const extension = imageType.split("/")[1] || "png";
        chooseFile(new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType }), "paste");
        return;
      }
      setPasteMessage("剪貼簿中沒有圖片");
    } catch {
      setPasteMessage("請直接按 Ctrl + V 貼上截圖");
    }
  };

  const resultStatus = captureMode === "live"
    ? !liveAnalysisEnabled ? "尚未開通"
      : liveStatus === "monitoring" && status === "ready" ? "即時同步"
      : liveStatus === "monitoring" ? "監控中"
        : liveStatus === "starting" ? "準備中" : status === "ready" ? "上次結果" : "等待監控"
    : status === "ready" ? "辨識完成" : status === "reading" ? "辨識中" : "等待截圖";
  const displayStrength = prediction?.strength === "觀望" ? "偏低" : prediction?.strength;
  const lineCta = <a className="line-cta" href={trial.lineUrl} target="_blank" rel="noreferrer" onClick={() => trackSupportClick("trial_limit")}><Icon name="line" size={20} /> 聯繫客服</a>;
  const supportCta = <a className="line-cta" href={trial.lineUrl} target="_blank" rel="noreferrer" onClick={() => trackSupportClick("feature_gate")}><Icon name="line" size={20} /> 聯繫客服</a>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="top-brand">
          <a href="https://mt1399.com/" target="_blank" rel="noreferrer" aria-label="MT1399 首頁">
            <img className="mt-brand-logo" src="/analyze/mt1399-logo.png" alt="MT1399" width={560} height={118} />
          </a>
        </div>
        <div className="member-block">
          <div><strong>MT1399 牌路預測分析</strong><span>{APP_VERSION}</span></div>
          <a className="top-line-link" href={trial.lineUrl} target="_blank" rel="noreferrer" aria-label="聯繫官方客服" onClick={() => trackSupportClick("header")}>專人服務</a>
        </div>
      </header>

      <div className="dashboard">
        <section className="hero-copy">
          <div><h1>{isTrial ? <>百家樂牌路分析器<br /><em>上傳截圖・立即整理牌路訊號</em><small>免登入免費試用 20 局</small></> : <>截圖貼上<br /><em>立即分析牌路</em></>}</h1>{isTrial && <p className="hero-lead">上傳手機或電腦牌路截圖，即時分析大路與三條衍生路。不限 MT 真人亦支援 DG、T9、DB、W、EVO 等採用標準牌路介面的百家樂遊戲。</p>}</div>
          {isTrial && <aside className="trial-hero-note" aria-label={`免費試用剩餘 ${Math.max(0, usageLimit - usedToday)} 局`}><strong>剩餘 {Math.max(0, usageLimit - usedToday)}／{usageLimit} 局</strong><span>同一 IP 共用額度；成功產生結果才扣 1 局</span></aside>}
        </section>

        <section className="work-grid">
          <article className="panel upload-panel">
            <div className="panel-heading"><div><span>01</span><div><p>{captureMode === "upload" ? "牌路截圖辨識" : "畫面即時辨識"}</p><h2>{captureMode === "live" ? "第一步：開啟百家樂畫面即時分析" : "第一步：上傳百家樂牌路截圖進行即時辨識分析"}</h2></div></div><span className="secure-pill"><Icon name="shield" size={15} /> 本機辨識</span></div>

            {!isTrial && <div className="capture-tabs" role="tablist" aria-label="分析方式">
              <button role="tab" aria-selected={captureMode === "upload"} className={captureMode === "upload" ? "active" : ""} onClick={() => selectMode("upload")}><Icon name="paste" size={16} /> 截圖貼上</button>
              <button role="tab" aria-selected={captureMode === "live"} className={captureMode === "live" ? "active" : ""} onClick={() => selectMode("live")}><Icon name="monitor" size={16} /> 畫面即時分析</button>
            </div>}

            {captureMode === "live" ? !liveAnalysisEnabled ? <div className="live-feature-gate" role="status">
              <span><Icon name="monitor" size={30} /></span>
              <strong>目前版本還在測試中</strong>
              <p>畫面即時分析暫未全面開放，如有需要請聯繫 MT1399 申請開通。</p>
              {supportCta}
            </div> : <>
              <div className={`live-preview ${liveStatus === "monitoring" ? "is-live" : ""}`}>
                <video ref={videoRef} muted playsInline autoPlay aria-label="正在分享的 MT 百家畫面預覽" />
                {liveStatus !== "monitoring" && liveStatus !== "starting" && <div className="live-empty"><span><Icon name="monitor" size={28} /></span><strong>選取 MT 百家的即時畫面</strong><small>首次自動定位，之後只分析固定牌路區域</small></div>}
                {liveStatus === "starting" && <div className="live-empty"><span className="spinner large" /><strong>等待 Chrome 畫面授權</strong><small>請在跳出的視窗選擇 MT 百家</small></div>}
                {liveStatus === "monitoring" && <div className="live-badge"><i /> 即時監控中</div>}
              </div>
              <div className={`live-message ${liveStatus === "error" ? "error" : ""}`}><span>{liveMessage}</span>{lastDetectedAt && <small>最後更新 {lastDetectedAt}</small>}</div>
              {liveStatus === "monitoring" ? <button className="stop-live-button" type="button" onClick={() => stopLive()}><Icon name="stop" size={17} /> 停止即時監控</button> : trialUnavailable ? lineCta : <button className="analyze-button live-start-button" type="button" onClick={startLive} disabled={liveStatus === "starting"}><Icon name="monitor" /> 開始即時監控</button>}
              <p className="live-quota-note"><Icon name="info" size={15} /> 讀取目前分享畫面，不使用範例圖；鎖定後只分析指定位置</p>
            </> : <>
              <div className={`dropzone device-${deviceMode} ${dragging ? "dragging" : ""} ${preview ? "has-preview" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}>
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} hidden />
                {preview ? <img src={preview} alt="已貼上或選取的牌路截圖預覽" /> : deviceMode === "mobile" ? <><div className="upload-icon"><Icon name="scan" size={30} /></div><strong>選擇手機截圖</strong><span>從相簿選擇完整牌路圖片，選取後會立即開始分析</span></> : <><div className="paste-shortcut"><kbd>Ctrl</kbd><b>＋</b><kbd>V</kbd></div><strong>截圖後直接貼上</strong><span>按 Win＋Shift＋S 截取完整牌路，回到本頁按 Ctrl＋V 立即分析</span></>}
              </div>
              {isTrial && !preview && <button className="sample-road-button" type="button" onClick={() => void loadSample()} disabled={status === "reading"}><span>沒有截圖？</span>點此載入範例圖片測試</button>}
              {!preview && deviceMode === "mobile" && <div className="capture-guide" aria-label="手機操作教學">
                <div className="mobile-guide">
                  <div className="capture-guide-title"><span><Icon name="scan" size={17} /></span><strong>手機操作</strong><small>建議方式</small></div>
                  <ol>
                    <li><b>1</b><span>在遊戲畫面截取完整牌路，需包含大路與下方三路。</span></li>
                    <li><b>2</b><span>回到本頁，點選上方「選擇手機截圖」。</span></li>
                    <li><b>3</b><span>從相簿選擇剛才的截圖，系統就會自動分析。</span></li>
                  </ol>
                </div>
              </div>}
              {deviceMode === "desktop" && <div className={`quick-paste desktop-paste ${pasteMessage ? "has-message" : ""}`}><button type="button" onClick={pasteFromClipboard} disabled={trialUnavailable || status === "reading"}><Icon name="paste" size={17} /> 從剪貼簿貼上</button><span>{status === "reading" ? "正在辨識牌路…" : pasteMessage || "貼上剛截取的完整牌路圖片"}</span></div>}
              {trialUnavailable ? lineCta : <p className="live-quota-note"><Icon name="info" size={15} /> 截圖貼上後自動分析；成功產生結果才扣 1 局</p>}
              {preview && !trialUnavailable && <button className="text-button" onClick={() => inputRef.current?.click()}>選擇其他截圖</button>}
            </>}
            {trialUnavailable && <div className="trial-ended" role="status"><strong>{trialDisabled ? "此 IP 的免費試用已停用" : "免費試用次數已用完"}</strong><span>請聯繫官方客服 LINE @mt7777 了解正式版。</span></div>}
            {analysisError && <p className="analysis-error" role="alert">{analysisError}</p>}
          </article>

          <article className="panel result-panel">
            <div className="panel-heading"><div><span>02</span><div><p>牌路訊號整理</p><h2>第二步：查看下三路與下一局牌路走向</h2></div></div><span className={`status-pill ${status === "ready" ? "done" : ""}`}>{resultStatus}</span></div>
            {isTrial && <div className="result-trial-quota" aria-label={`剩餘 ${Math.max(0, usageLimit - usedToday)} / ${usageLimit} 局`}>
              <div><span>免費試用剩餘</span><strong>{Math.max(0, usageLimit - usedToday)}<small>／{usageLimit} 局</small></strong></div>
              <p>同一 IP 共用額度；辨識失敗與範例圖片不扣次數</p>
              <a href={trial?.lineUrl} target="_blank" rel="noreferrer" onClick={() => trackSupportClick("result_quota")}><Icon name="chat" size={17} /> 聯繫客服</a>
            </div>}
            {prediction ? (
              <>
                <div className={`recommendation-card ${prediction.strength === "觀望" ? "watch" : prediction.predictedSide === "B" ? "banker" : "player"}`}>
                  <span>下一局明確走向</span>
                  <strong>下一局走{labels[prediction.predictedSide]}</strong>
                  <p>{prediction.note}</p>
                  <small>{prediction.hasDualDirectRoads ? `珠盤路與大路已交叉核對（${Math.round(prediction.directRoadAgreement * 100)}% 一致）` : `依${prediction.signal}判讀`}；這是牌路訊號，不是保證結果。</small>
                </div>
                <div className="ratio-cards">
                  <div className="ratio-card player"><span>閒家｜牌路分配</span><strong>{prediction.player.toFixed(1)}<small>%</small></strong><div><i style={{ width: `${prediction.player}%` }} /></div><p>已辨識大路：{stats.player} 閒</p></div>
                  <div className="ratio-card banker"><span>莊家｜牌路分配</span><strong>{prediction.banker.toFixed(1)}<small>%</small></strong><div><i style={{ width: `${prediction.banker}%` }} /></div><p>已辨識大路：{stats.banker} 莊</p></div>
                </div>
                <div className="mini-stats"><div><span>辨識範圍</span><strong>{prediction.signal}</strong></div><div><span>有效訊號</span><strong>{snapshot?.markerCount ?? 0} 個</strong></div><div><span>走向信心</span><strong>{displayStrength}</strong></div></div>
              </>
            ) : (
              <div className="ratio-cards empty">
                <div className="ratio-card empty"><span>尚未辨識</span><strong>—<small>%</small></strong><div><i style={{ width: "0%" }} /></div><p>請上傳截圖開始分析</p></div>
                <div className="ratio-card empty"><span>尚未辨識</span><strong>—<small>%</small></strong><div><i style={{ width: "0%" }} /></div><p>請上傳截圖開始分析</p></div>
              </div>
            )}
            {snapshot?.mode === "road-board" && <div className="road-sources" aria-label="各牌路辨識數量"><span>珠盤路 <b>{snapshot.beadPlate.length}</b></span><span>大路 <b>{snapshot.bigRoadOutcomes.length || snapshot.outcomes.length}</b></span><span>大眼路 <b>{snapshot.bigEyeRoad.length}</b></span><span>小路／蟑螂 <b>{snapshot.smallRoad.length}／{snapshot.cockroachRoad.length}</b></span></div>}
          </article>
        </section>
        {isTrial && <TrialGrowthContent lineUrl={trial.lineUrl} />}
      </div>
      {isTrial && <a className="floating-support-cta" href={trial.lineUrl} target="_blank" rel="noreferrer" aria-label="聯繫官方客服" onClick={() => trackSupportClick("floating_button")}><Icon name="chat" size={19} /> 專人服務</a>}
    </main>
  );
}
