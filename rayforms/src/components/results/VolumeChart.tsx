import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { VolumePoint } from '@/lib/results';

import { TOOLTIP_STYLE } from './ChoiceChart';

/** Responses per day. Gap-filled upstream so a quiet day reads as zero, not as a gap. */
export function VolumeChart({ points }: { points: VolumePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={points} margin={{ left: -22, right: 8, top: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="volume-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          width={38}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#volume-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
