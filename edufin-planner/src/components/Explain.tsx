"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";
import type { Explain as ExplainT } from "@/lib/engine/types";
import { Sheet } from "./ui";

/** "How was this calculated?" — every output shows Input, Formula, Assumption and Result. */
export function ExplainButton({ explain, label = "Cara hitung", compact }: { explain: ExplainT | undefined; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!explain) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.72rem] font-medium text-accent-ink hover:bg-accent-soft"
        aria-label={`${compact ? "Cara hitung" : label}: ${explain.title}`}
        title="How was this calculated?"
      >
        <Calculator className="h-3.5 w-3.5" aria-hidden />
        {compact ? null : label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={explain.title}>
        <ExplainBody explain={explain} />
      </Sheet>
    </>
  );
}

export function ExplainBody({ explain }: { explain: ExplainT }) {
  return (
    <div className="flex flex-col gap-4 text-[0.85rem]">
      <section>
        <h3 className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">Input</h3>
        <dl className="divide-y divide-[var(--line)] rounded-lg border border-line">
          {explain.inputs.map((i, k) => (
            <div key={k} className="flex items-start justify-between gap-3 px-3 py-2">
              <dt className="text-ink-2">
                {i.label}
                {i.note ? <span className="block text-[0.72rem] text-muted">{i.note}</span> : null}
              </dt>
              <dd className="tnum text-right font-medium text-ink">{i.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">Formula</h3>
        <p className="rounded-lg bg-card-2 px-3 py-2 font-mono text-[0.78rem] leading-relaxed text-ink">{explain.formula}</p>
        {explain.substitution ? (
          <p className="mt-1.5 rounded-lg bg-card-2 px-3 py-2 font-mono text-[0.78rem] leading-relaxed text-ink-2">{explain.substitution}</p>
        ) : null}
      </section>
      <section>
        <h3 className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">Assumption</h3>
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          {explain.assumptions.map((a, k) => (
            <li key={k}>{a}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-muted">Result</h3>
        <p className="tnum text-[1rem] font-semibold text-ink">{explain.result}</p>
        {explain.notes?.length ? (
          <ul className="mt-2 space-y-1 text-[0.8rem] text-ink-2">
            {explain.notes.map((n, k) => (
              <li key={k}>{n}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
