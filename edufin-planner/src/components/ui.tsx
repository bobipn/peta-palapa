"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatNumber, parseRupiah } from "@/lib/format";

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={clsx("card", className)}>{children}</As>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Heading level; use "h1" when the card is the page's only header (e.g. login). */
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-3 px-4 pt-4 sm:px-5", className)}>
      <div className="min-w-0">
        <Heading className="text-[0.95rem] font-semibold leading-tight text-ink">{title}</Heading>
        {subtitle ? <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-2">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("px-4 pb-4 pt-3 sm:px-5", className)}>{children}</div>;
}

export type Tone = "good" | "warning" | "serious" | "critical" | "info" | "neutral";

const toneStyles: Record<Tone, { bg: string; dot: string; Icon: typeof Info }> = {
  good: { bg: "bg-good-soft", dot: "text-good", Icon: CheckCircle2 },
  warning: { bg: "bg-warning-soft", dot: "text-warning", Icon: AlertTriangle },
  serious: { bg: "bg-serious-soft", dot: "text-serious", Icon: AlertTriangle },
  critical: { bg: "bg-critical-soft", dot: "text-critical", Icon: OctagonAlert },
  info: { bg: "bg-info-soft", dot: "text-accent", Icon: Info },
  neutral: { bg: "bg-card-2", dot: "text-muted", Icon: Info },
};

/** Status is never color alone: icon + label, ink-colored text. */
export function StatusPill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const s = toneStyles[tone];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink", s.bg, className)}>
      <s.Icon aria-hidden className={clsx("h-3.5 w-3.5", s.dot)} strokeWidth={2.25} />
      {children}
    </span>
  );
}

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const s = toneStyles[tone];
  return <s.Icon aria-hidden className={clsx("h-4 w-4 shrink-0", s.dot, className)} strokeWidth={2.25} />;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-md border border-line px-1.5 py-0.5 text-[0.7rem] font-medium text-ink-2", className)}>
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  action,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("card flex min-w-0 flex-col gap-1 p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.78rem] font-medium leading-tight text-ink-2">{label}</span>
        {action}
      </div>
      <div className="flex items-center gap-2">
        {tone ? <ToneIcon tone={tone} /> : null}
        <span className="truncate text-xl font-semibold tracking-tight text-ink sm:text-[1.35rem]">{value}</span>
      </div>
      {sub ? <div className="text-[0.75rem] leading-snug text-muted">{sub}</div> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[0.8rem]" : "h-10 px-4 text-[0.875rem]",
        variant === "primary" && "bg-accent text-white hover:brightness-110",
        variant === "secondary" && "border border-line-strong bg-card text-ink hover:bg-card-2",
        variant === "ghost" && "text-ink-2 hover:bg-card-2 hover:text-ink",
        variant === "danger" && "border border-line-strong bg-card text-critical hover:bg-critical-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[0.8rem] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="text-[0.72rem] leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("field", props.className)} />;
}

export function Select({
  value,
  onChange,
  options,
  className,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={clsx("field pr-8", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Rupiah input: shows thousands separators, accepts "7,5 jt" style entries. */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value ? formatNumber(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? formatNumber(value) : "");
  }, [value]);
  return (
    <div className={clsx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.85rem] text-muted">Rp</span>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        className="field tnum pl-9"
        value={text}
        placeholder={placeholder ?? "0"}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          const v = parseRupiah(text);
          setText(v ? formatNumber(v) : "");
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseRupiah(e.target.value);
          if (v !== null) onChange(Math.max(0, v));
          else if (e.target.value.trim() === "") onChange(0);
        }}
      />
    </div>
  );
}

const pctText = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? "" : String(+(v * 100).toFixed(2)));

/** Percent input stored as a decimal (0.07) and edited as 7. Pass onClear to allow an empty value. */
export function PercentInput({
  value,
  onChange,
  onClear,
  step = 0.1,
  min = -50,
  max = 100,
  ariaLabel,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  onClear?: () => void;
  step?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(pctText(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(pctText(value));
  }, [value]);
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        step={step}
        min={min}
        max={max}
        className="field tnum pr-8"
        value={text}
        onFocus={() => (focused.current = true)}
        placeholder={placeholder}
        onBlur={() => {
          focused.current = false;
          setText(pctText(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "") {
            onClear?.();
            return;
          }
          const v = Number(e.target.value.replace(",", "."));
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)) / 100);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.85rem] text-muted">%</span>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        min={min}
        max={max}
        className={clsx("field tnum", suffix && "pr-14")}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(max !== undefined ? Math.min(max, v) : v);
        }}
      />
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-muted">{suffix}</span> : null}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx("scroll-x -mx-1 flex gap-1 px-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "h-9 shrink-0 rounded-full px-3.5 text-[0.82rem] font-medium transition-colors",
            value === t.value ? "bg-ink text-page" : "text-ink-2 hover:bg-card-2 hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-[10px] border border-line-strong bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "h-8 rounded-[8px] px-3 text-[0.8rem] font-medium",
            value === o.value ? "bg-card-2 text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Accessible modal / bottom sheet (bottom sheet on mobile, centered dialog on desktop). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={clsx(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-card outline-none sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id={id} className="text-[0.95rem] font-semibold text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-card-2" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-[0.95rem] font-semibold text-ink">{title}</p>
      {body ? <p className="max-w-md text-[0.85rem] text-ink-2">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-ink sm:text-[1.6rem]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-[0.85rem] text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Meter({ value, tone = "info", label }: { value: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const color =
    tone === "good" ? "var(--good)" : tone === "warning" ? "var(--warning)" : tone === "critical" ? "var(--critical)" : tone === "serious" ? "var(--serious)" : "var(--accent)";
  return (
    <div className="w-full" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={label}>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--card-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[0.85rem] text-ink">
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
