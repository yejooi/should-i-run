"use client";

import { useIsDark, toggleTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const dark = useIsDark();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="라이트 / 다크 전환"
      className="font-digital rounded-full border border-chip-line px-2 py-1 text-[9px] tracking-[.1em] text-dim transition-colors hover:text-ink"
    >
      {dark ? "LIGHT" : "DARK"}
    </button>
  );
}
