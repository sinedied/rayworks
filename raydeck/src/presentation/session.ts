import { validateSpec } from 'graphein';

import type { DeckSlide } from '@/deck/sampleDeck';

export const SESSION_PROTOCOL = 'raydeck.presenter.v1';
export const HEARTBEAT_MS = 2000;
export const CONNECTION_TIMEOUT_MS = 15000;
export type AudienceSlide = Omit<DeckSlide, 'notes'>;
export type Navigation = { type: 'next' } | { type: 'previous' } | { type: 'goTo'; slideId: string };
export type SessionBody =
  | { type: 'ready'; clientId: string }
  | { type: 'state'; revision: number; slides: AudienceSlide[]; activeId: string }
  | { type: 'navigate'; clientId: string; commandId: number; command: Navigation }
  | { type: 'ack'; revision: number }
  | { type: 'ping' | 'pong' | 'end' };
export type SessionMessage = SessionBody & { protocol: typeof SESSION_PROTOCOL; sessionId: string };

export function message(sessionId: string, body: SessionBody): SessionMessage {
  return { ...body, protocol: SESSION_PROTOCOL, sessionId };
}

export function audienceSlides(slides: DeckSlide[]): AudienceSlide[] {
  return slides.map((slide) => ({
    id: slide.id, number: slide.number, kind: slide.kind, eyebrow: slide.eyebrow,
    title: slide.title, body: slide.body, metrics: slide.metrics, chart: slide.chart, source: slide.source,
  }));
}

export function navigateIndex(index: number, slides: Pick<DeckSlide, 'id'>[], command: Navigation) {
  const next = command.type === 'next' ? index + 1
    : command.type === 'previous' ? index - 1 : slides.findIndex((slide) => slide.id === command.slideId);
  return next < 0 && command.type === 'goTo' ? index : Math.max(0, Math.min(slides.length - 1, next));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSlide(value: unknown): value is AudienceSlide {
  if (!record(value) || 'notes' in value
    || !['id', 'number', 'eyebrow', 'title', 'body'].every((field) => typeof value[field] === 'string')
    || !['cover', 'metrics', 'chart', 'comparison', 'closing'].includes(String(value.kind))) return false;
  if (value.source !== undefined && typeof value.source !== 'string') return false;
  if (value.metrics !== undefined && (!Array.isArray(value.metrics) || !value.metrics.every((metric) =>
    record(metric) && ['label', 'value', 'change'].every((field) => typeof metric[field] === 'string')
    && (metric.positive === undefined || typeof metric.positive === 'boolean')))) return false;
  return value.chart === undefined || validateSpec(value.chart).valid;
}

function isNavigation(value: unknown): value is Navigation {
  return record(value) && (value.type === 'next' || value.type === 'previous'
    || (value.type === 'goTo' && typeof value.slideId === 'string'));
}

export function isSessionMessage(value: unknown): value is SessionMessage {
  if (!record(value) || value.protocol !== SESSION_PROTOCOL || typeof value.sessionId !== 'string') return false;
  switch (value.type) {
    case 'ready': return typeof value.clientId === 'string';
    case 'ping': case 'pong': case 'end': return true;
    case 'ack': return typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0;
    case 'navigate': return typeof value.clientId === 'string' && typeof value.commandId === 'number'
      && Number.isSafeInteger(value.commandId) && value.commandId > 0 && isNavigation(value.command);
    case 'state': return typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0
      && Array.isArray(value.slides) && value.slides.length > 0 && value.slides.every(isSlide)
      && new Set(value.slides.map((slide) => slide.id)).size === value.slides.length
      && value.slides.some((slide) => slide.id === value.activeId);
    default: return false;
  }
}

export function belongsToSession(value: unknown, sessionId: string) {
  return record(value) && value.protocol === SESSION_PROTOCOL && value.sessionId === sessionId;
}

export function audienceSessionId(hash: string): string | null {
  const id = new URLSearchParams(hash.slice(1)).get('audience');
  return id && /^[\da-f-]{36}$/i.test(id) ? id : null;
}
