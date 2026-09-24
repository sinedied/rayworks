import type { ChartSpec } from 'graphein';

export type Metric = {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
};

export type DeckSlide = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  body: string;
  notes?: string;
  kind: 'cover' | 'metrics' | 'chart' | 'comparison' | 'closing';
  metrics?: Metric[];
  chart?: ChartSpec;
  source?: string;
};

const revenueTrend: ChartSpec = {
  type: 'line',
  data: [
    { month: '2026-01-01', revenue: 2.8 },
    { month: '2026-02-01', revenue: 3.1 },
    { month: '2026-03-01', revenue: 3.3 },
    { month: '2026-04-01', revenue: 3.8 },
    { month: '2026-05-01', revenue: 4.2 },
    { month: '2026-06-01', revenue: 4.7 },
    { month: '2026-07-01', revenue: 5.1 },
    { month: '2026-08-01', revenue: 5.8 },
  ],
  area: true,
  curve: 'monotone',
  points: true,
  encoding: {
    x: { field: 'month', type: 'temporal', title: 'FY26', format: '%b' },
    y: {
      field: 'revenue',
      type: 'quantitative',
      title: 'Revenue ($M)',
      format: '$.1f',
    },
  },
  annotations: [
    { type: 'line', axis: 'y', value: 4.5, label: 'Plan' },
  ],
  description: 'Monthly recurring revenue increased from $2.8M to $5.8M.',
};

const channelComparison: ChartSpec = {
  type: 'bar',
  data: [
    { channel: 'Direct', current: 0.82 },
    { channel: 'Partners', current: 0.68 },
    { channel: 'Digital', current: 0.61 },
    { channel: 'Enterprise', current: 0.54 },
  ],
  orientation: 'horizontal',
  cornerRadius: 6,
  encoding: {
    x: { field: 'channel', type: 'nominal', title: '' },
    y: {
      field: 'current',
      type: 'quantitative',
      title: 'Attainment',
      format: '.0%',
    },
  },
  description: 'Direct and partner channels lead plan attainment.',
};

export const SAMPLE_DECK: DeckSlide[] = [
  {
    id: 'opening',
    number: '01',
    eyebrow: 'Quarterly business review',
    title: 'Momentum, made visible.',
    body: 'A concise view of the signals shaping our next quarter.',
    kind: 'cover',
  },
  {
    id: 'snapshot',
    number: '02',
    eyebrow: 'Executive snapshot',
    title: 'Growth is accelerating without sacrificing efficiency.',
    body: 'Revenue, retention, and pipeline quality all moved in the right direction. The opportunity now is to concentrate investment behind the channels already compounding.',
    kind: 'metrics',
    metrics: [
      { label: 'Recurring revenue', value: '$5.8M', change: '+18.4%', positive: true },
      { label: 'Net retention', value: '116%', change: '+4.2 pts', positive: true },
      { label: 'Qualified pipeline', value: '$12.6M', change: '+27.1%', positive: true },
    ],
  },
  {
    id: 'trajectory',
    number: '03',
    eyebrow: 'Revenue trajectory',
    title: 'The second-half inflection is now visible.',
    body: 'Expansion revenue and faster enterprise onboarding pushed monthly recurring revenue above plan in June.',
    kind: 'chart',
    chart: revenueTrend,
    source: 'Sample data · replace with a Fabric semantic model query',
  },
  {
    id: 'channels',
    number: '04',
    eyebrow: 'Channel performance',
    title: 'Direct motion leads; partners are the next multiplier.',
    body: 'Partner-sourced opportunities convert faster than digital demand, making enablement the highest-leverage near-term investment.',
    kind: 'comparison',
    chart: channelComparison,
    source: 'Sample data · replace with a Fabric semantic model query',
  },
  {
    id: 'close',
    number: '05',
    eyebrow: 'Next 90 days',
    title: 'Protect the core. Scale the signal.',
    body: 'Focus the team on three moves: shorten enterprise onboarding, package the partner playbook, and turn expansion triggers into an operating rhythm.',
    kind: 'closing',
  },
];
