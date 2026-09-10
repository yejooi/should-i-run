"use client";

import { useSyncExternalStore } from "react";

// <html>의 class 변경을 구독해 현재 테마를 읽는다 (하이드레이션 안전).
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="라이트 / 다크 전환"
      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-dim transition-colors hover:text-fg"
    >
      {dark ? "다크" : "라이트"}
    </button>
  );
}
