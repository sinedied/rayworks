import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { NumberStats } from '@/lib/results';

import { TOOLTIP_STYLE } from './ChoiceChart';

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Histogram plus the five-number summary that makes a numeric column interpretable. */
export function NumberChart({ stats }: { stats: NumberStats }) {
  const summary = [
    { label: 'Min', value: stats.min },
    { label: 'Median', value: stats.median },
    { label: 'Mean', value: stats.mean },
    { label: 'Max', value: stats.max },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-sunk)] px-3 py-2"
          >
            <dt className="label-caps">
              {item.label}
            </dt>
            <dd className="font-data mt-0.5 text-lg font-semibold leading-tight text-[var(--text)]">
              {format(item.value)}
            </dd>
          </div>
        ))}
      </dl>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={stats.buckets}
          margin={{ left: -20, right: 8, top: 4, bottom: 4 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={46}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-sunk)' }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar
            dataKey="count"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
