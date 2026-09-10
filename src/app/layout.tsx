import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "지금 뛰어야 하나?",
  description:
    "늦었을 때 목적지만 입력하면, 가장 가까운 지하철역까지 도보 시간과 타야 할 다음 열차 도착 시간을 알려주고 뛸지 말지 판정합니다.",
  applicationName: "지금 뛰어야 하나?",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "뛰어?" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
  ],
};

// 첫 페인트 전에 저장된 테마 / 시스템 설정을 적용해 깜빡임을 막는다.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
