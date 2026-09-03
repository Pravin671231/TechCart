import { useState } from "react";

// Snap a raw step to a "nice" 1/2/5 × 10ⁿ value.
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const snapped = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  return snapped * magnitude;
}

function resolveStep(min: number, max: number, step: number | undefined): number {
  if (step && step > 0) return step;
  const raw = niceStep((max - min) / 100);
  if (Number.isInteger(min) && Number.isInteger(max)) return Math.max(1, Math.round(raw));
  return raw;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Below this gap between the two handles (in % of the track), the two value
// bubbles would overlap — show a single merged bubble instead.
const MERGE_THRESHOLD_PCT = 16;

export function RangeSlider({
  min,
  max,
  low,
  high,
  step,
  formatValue = (value) => String(value),
  minLabel,
  maxLabel,
  onCommit,
}: {
  min: number;
  max: number;
  low: number | undefined;
  high: number | undefined;
  step?: number;
  formatValue?: (value: number) => string;
  minLabel: string;
  maxLabel: string;
  onCommit: (low: number | undefined, high: number | undefined) => void;
}) {
  const gap = resolveStep(min, max, step);

  const [lo, setLo] = useState(() => clamp(low ?? min, min, max));
  const [hi, setHi] = useState(() => clamp(high ?? max, min, max));

  // Re-sync when the committed selection or the bounds change from outside
  // (category / spec switch, "clear filters"). Render-time adjustment, not a
  // `useEffect` — `react-hooks/set-state-in-effect` forbids the effect form.
  const [seen, setSeen] = useState({ low, high, min, max });
  if (seen.low !== low || seen.high !== high || seen.min !== min || seen.max !== max) {
    setSeen({ low, high, min, max });
    setLo(clamp(low ?? min, min, max));
    setHi(clamp(high ?? max, min, max));
  }

  const toPct = (value: number) => ((value - min) / (max - min)) * 100;
  const loPct = toPct(lo);
  const hiPct = toPct(hi);
  const merged = hiPct - loPct < MERGE_THRESHOLD_PCT;
  const bubbleLeft = (pct: number) => `${clamp(pct, 4, 96)}%`;

  function commitNow() {
    onCommit(lo <= min ? undefined : lo, hi >= max ? undefined : hi);
  }

  return (
    <div className="range-slider">
      <div className="range-slider__rail" aria-hidden="true">
        <div
          className="range-slider__fill"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
      </div>

      <input
        type="range"
        className="range-slider__input"
        style={{ zIndex: loPct > 50 ? 4 : 3 }}
        min={min}
        max={max}
        step={gap}
        value={lo}
        aria-label={minLabel}
        aria-valuetext={formatValue(lo)}
        onChange={(event) => setLo(Math.min(Number(event.target.value), hi - gap))}
        onPointerUp={commitNow}
        onKeyUp={commitNow}
        onBlur={commitNow}
      />
      <input
        type="range"
        className="range-slider__input"
        min={min}
        max={max}
        step={gap}
        value={hi}
        aria-label={maxLabel}
        aria-valuetext={formatValue(hi)}
        onChange={(event) => setHi(Math.max(Number(event.target.value), lo + gap))}
        onPointerUp={commitNow}
        onKeyUp={commitNow}
        onBlur={commitNow}
      />

      {merged ? (
        <span
          className="range-slider__bubble"
          style={{ left: bubbleLeft((loPct + hiPct) / 2) }}
          aria-hidden="true"
        >
          {formatValue(lo)}&ndash;{formatValue(hi)}
        </span>
      ) : (
        <>
          <span
            className="range-slider__bubble"
            style={{ left: bubbleLeft(loPct) }}
            aria-hidden="true"
          >
            {formatValue(lo)}
          </span>
          <span
            className="range-slider__bubble"
            style={{ left: bubbleLeft(hiPct) }}
            aria-hidden="true"
          >
            {formatValue(hi)}
          </span>
        </>
      )}

      <div className="range-slider__bounds" aria-hidden="true">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}
