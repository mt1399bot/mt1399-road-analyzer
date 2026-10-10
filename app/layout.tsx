import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL("https://mt1399.com"),
  title: "百家樂牌路機率分析器",
  description: "上傳牌路截圖，整理莊、閒、和的歷史樣本比例與連續走勢。",
  openGraph: {
    title: "百家樂牌路機率分析器",
    description: "上傳牌路・即時統計・理性判讀",
    type: "website",
    images: [{ url: "/analyze/og.png", width: 1200, height: 630, alt: "MT1399" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "百家樂牌路機率分析器",
    description: "上傳牌路・即時統計・理性判讀",
    images: ["/analyze/og.png"],
  },
  icons: {
    icon: [{ url: "/analyze/mt1399-favicon-mt-v4.png", type: "image/png", sizes: "64x64" }],
    shortcut: "/analyze/mt1399-favicon-mt-v4.png",
    apple: "/analyze/mt1399-favicon-mt-v4.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}{GA_MEASUREMENT_ID && <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
    <Script id="ga4-config" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}</Script>
  </>}</body></html>;
}
