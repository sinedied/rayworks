import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ChoiceTally } from '@/lib/results';

export const SERIES = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgb(15 23 42 / 0.1)',
  fontSize: 12,
  color: 'var(--text)',
} as const;

/**
 * Single-choice answers are mutually exclusive, so a donut reads as parts of a whole.
 * Multi-choice answers overlap, so they render as ranked bars instead.
 */
export function ChoiceChart({
  tallies,
  variant,
}: {
  tallies: ChoiceTally[];
  variant: 'donut' | 'bars';
}) {
  if (tallies.every((tally) => tally.count === 0)) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
        No answers yet.
      </p>
    );
  }

  if (variant === 'bars') {
    // Precomputed so the label does not have to look a tally up by value, which is
    // ambiguous when two options are tied.
    const data = tallies.map((tally) => ({
      ...tally,
      display: `${tally.count} · ${tally.percent}%`,
    }));

    return (
      <ResponsiveContainer
        width="100%"
        height={Math.max(140, tallies.length * 38)}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 4, right: 48, top: 4, bottom: 4 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-sunk)' }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((tally, index) => (
              <Cell key={tally.label} fill={SERIES[index % SERIES.length]} />
            ))}
            {/* Values are shown inline so the chart is readable without hovering. */}
            <LabelList
              dataKey="display"
              position="right"
              offset={8}
              style={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[180px] w-full max-w-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={tallies}
              dataKey="count"
              nameKey="label"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={1}
            >
              {tallies.map((tally, index) => (
                <Cell key={tally.label} fill={SERIES[index % SERIES.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {tallies.map((tally, index) => (
          <li
            key={tally.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: SERIES[index % SERIES.length] }}
              />
              <span className="truncate">{tally.label}</span>
            </span>
            <span className="font-data shrink-0 text-xs text-[var(--text-muted)]">
              {tally.count} · {tally.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
