"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { normalize } from "@/lib/text";
import { completion } from "@/lib/search/catalog";
import { popover } from "@/components/ui/motion";

export type AcItem = {
  id: string;
  label: string;
  sublabel?: string;
  meta?: string;
  icon: LucideIcon;
  onPick: () => void;
};
export type AcGroup = {
  id: string;
  title: string;
  items: AcItem[];
  action?: { label: string; onClick: () => void };
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  groups: AcGroup[];
  completions: string[]; // texte din care se ia completarea „fantomă"
  placeholder: ReactNode; // când câmpul e gol și nu e selectat
  focusedPlaceholder: string; // când câmpul e gol și e selectat
  ariaLabel: string;
  autoFocus?: boolean;
  inline?: boolean; // lista apare în pagină (în popover), nu plutitoare
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  fieldClassName?: string;
  listClassName?: string;
};

/*
  Câmp de căutare cu sugestii:
  - completare „fantomă" (gri) a primei sugestii care începe cu ce ai tastat → Tab sau → o acceptă;
  - săgeți sus/jos prin sugestii, Enter alege, Escape închide;
  - partea potrivită din fiecare sugestie apare îngroșată.
*/
export function Autocomplete(p: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);

  const flat = p.groups.flatMap((g) => g.items);
  const suggestion = focused ? completion(p.value, p.completions) : "";
  const ghost = suggestion.slice(p.value.length);
  const showList = (p.inline || focused) && flat.length > 0;

  const accept = (v: string) => {
    p.onChange(v);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const atEnd = e.currentTarget.selectionStart === p.value.length;
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if ((e.key === "Tab" || e.key === "ArrowRight") && ghost && atEnd) {
      e.preventDefault();
      accept(suggestion);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) flat[active].onPick();
      else p.onSubmit?.();
      setActive(-1);
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  };

  let index = -1;

  return (
    <div className={`relative ${p.className ?? ""}`}>
      <div className={p.fieldClassName ?? "flex items-center gap-2"}>
        {p.leading}
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            role="combobox"
            aria-label={p.ariaLabel}
            aria-expanded={showList}
            aria-controls={`${id}-list`}
            aria-autocomplete="both"
            aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            autoFocus={p.autoFocus}
            value={p.value}
            onChange={(e) => accept(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setFocused(true);
              p.onFocus?.();
            }}
            onBlur={() => {
              setFocused(false);
              setActive(-1);
              p.onBlur?.();
            }}
            className="w-full bg-transparent text-sm text-ink outline-none"
          />
          {/* Stratul din spate: completarea „fantomă" sau placeholder-ul animat */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-sm whitespace-pre"
          >
            {p.value ? (
              <>
                <span className="invisible">{p.value}</span>
                <span className="text-muted/80">{ghost}</span>
              </>
            ) : focused ? (
              <span className="text-muted">{p.focusedPlaceholder}</span>
            ) : (
              p.placeholder
            )}
          </div>
        </div>
        {p.trailing}
      </div>

      <AnimatePresence>
        {showList && (
          <motion.div
            id={`${id}-list`}
            role="listbox"
            variants={p.inline ? undefined : popover}
            initial={p.inline ? false : "hidden"}
            animate="show"
            exit="exit"
            onMouseDown={(e) => e.preventDefault()} // păstrează focusul în câmp când alegi
            className={
              p.inline
                ? "mt-3 space-y-1"
                : `absolute top-full z-40 mt-4 space-y-1 rounded-card bg-cream-50 p-2 shadow-soft ring-1 ring-sand ${p.listClassName ?? "inset-x-0"}`
            }
          >
            {p.groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.id}>
                    <div className="flex items-center justify-between px-3 pt-2 pb-1">
                      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                        {g.title}
                      </span>
                      {g.action && (
                        <button
                          type="button"
                          onClick={g.action.onClick}
                          className="text-[11px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                        >
                          {g.action.label}
                        </button>
                      )}
                    </div>
                    {g.items.map((item) => {
                      index++;
                      const i = index;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          id={`${id}-opt-${i}`}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={active === i}
                          onMouseEnter={() => setActive(i)}
                          onClick={item.onPick}
                          className={`relative flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                            active === i ? "text-ink" : "text-ink-soft"
                          }`}
                        >
                          {active === i && (
                            <motion.span
                              layoutId={`${id}-hl`}
                              className="absolute inset-0 rounded-2xl bg-cream-100 shadow-pressed"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                          )}
                          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-cream-50 text-accent shadow-pill">
                            <Icon className="size-4" />
                          </span>
                          <span className="relative min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              <Highlight text={item.label} query={p.value} />
                            </span>
                            {item.sublabel && (
                              <span className="block truncate text-xs text-muted">{item.sublabel}</span>
                            )}
                          </span>
                          {item.meta && (
                            <span className="relative shrink-0 text-xs font-medium text-muted">
                              {item.meta}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ),
            )}
            {p.hint && <p className="px-3 pt-1 pb-1.5 text-[11px] text-muted">{p.hint}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Îngroașă partea din text care se potrivește cu ce s-a tastat
function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalize(query.trim());
  const i = q ? normalize(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-bold text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
