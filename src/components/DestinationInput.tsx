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
  placeholder = "역 이름 (예: 강남, 홍대, 롯데월드)",
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
      <div className="flex items-center gap-2.5 rounded-[10px] border border-chip-line bg-chip px-3.5 py-3">
        <span className="font-digital text-[9px] tracking-[.12em] text-dim">
          {label === "목적지" ? "TO" : label.toUpperCase()}
        </span>
        <span className="font-display truncate text-[20px] leading-none text-accent">{value}</span>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto shrink-0 rounded-full border border-chip-line px-2.5 py-1 text-[11px] text-dim transition-colors hover:text-ink"
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
        className="font-display w-full rounded-[10px] border border-chip-line bg-chip px-3.5 py-3 text-[18px] text-ink outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-faint focus:border-accent"
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-[10px] border border-chip-line bg-chip py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.station} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2.5 text-left"
                style={{ background: i === active ? "var(--row-bg)" : undefined }}
              >
                <span className="font-display text-[15px] text-ink">
                  {s.station}
                  {s.via && s.via !== s.station && (
                    <span className="font-sans ml-1.5 text-[11px] text-faint">· {s.via}</span>
                  )}
                </span>
                <span className="font-digital shrink-0 text-[10px] text-dim">
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
