import { animate } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { formatMetric } from '@/story/metrics';
import { splitMetric } from '@/story/text';
import type { MetricFormat } from '@/story/types';

function MetricFigure({ text }: { text: string }) {
  const { figure, unit } = splitMetric(text);
  return (
    <>
      <span className="metric-figure">{figure}</span>
      {unit && <span className="metric-unit">{unit}</span>}
    </>
  );
}

/**
 * A metric value that counts up from zero each time its chapter becomes active. The final value is
 * always in the DOM for assistive technology; only the visible digits animate.
 */
export function CountUp({ value, format, active, reducedMotion }: {
  value: number | null;
  format: MetricFormat;
  active: boolean;
  reducedMotion: boolean;
}) {
  const visible = useRef<HTMLSpanElement>(null);
  const finalText = formatMetric(value, format);

  useEffect(() => {
    const element = visible.current;
    if (!element || !active || reducedMotion || value === null || value === 0) return;
    const render = (current: number) => {
      const text = formatMetric(format === 'days' ? Math.round(current * 10) / 10 : current, format);
      const { figure, unit } = splitMetric(text);
      element.firstElementChild!.textContent = figure;
      if (element.lastElementChild && element.lastElementChild !== element.firstElementChild) {
        element.lastElementChild.textContent = unit;
      }
    };
    render(0);
    const controls = animate(0, value, {
      duration: 1.4,
      delay: 0.35,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: render,
    });
    return () => {
      controls.stop();
      render(value);
    };
  }, [active, reducedMotion, value, format]);

  return (
    <span className="metric-value">
      <span className="sr-only">{finalText}</span>
      <span ref={visible} aria-hidden className="metric-value-visible">
        <MetricFigure text={finalText} />
      </span>
    </span>
  );
}
