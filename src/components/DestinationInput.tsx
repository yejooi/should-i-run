"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
// active 인덱스는 입력이 바뀔 때 onChange에서 직접 0으로 되돌린다(effect 불필요).
import { searchStations, type StationSuggestion } from "@/lib/stations";

interface Props {
  value: string | null;
  onSelect: (station: string) => void;
  onClear: () => void;
  label?: string;
  placeholder?: string;
}

export default function DestinationInput({
  value,
  onSelect,
  onClear,
  label = "목적지",
  placeholder = "목적지 역 이름 (예: 강남, 홍대, 롯데월드)",
}: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo<StationSuggestion[]>(
    () => (open && text ? searchStations(text) : []),
    [open, text],
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(s: StationSuggestion) {
    onSelect(s.station);
    setText("");
    setOpen(false);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-dim">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-dim transition-colors hover:text-fg"
        >
          변경
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-base outline-none placeholder:text-faint focus:border-accent"
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.station} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left ${
                  i === active ? "bg-surface-2" : ""
                }`}
              >
                <span className="font-medium">
                  {s.station}
                  {s.via && s.via !== s.station && (
                    <span className="ml-1.5 text-xs text-faint">· {s.via}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-dim">
                  {s.lineNames.join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
