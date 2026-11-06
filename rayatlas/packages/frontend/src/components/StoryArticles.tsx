import { Crosshair, LocateFixed } from 'lucide-react';
import type { NetworkData } from '@rayfin-app/shared';
import type { Ref } from 'react';

import { CountUp } from '@/components/CountUp';
import { EditableText } from '@/components/EditableText';
import type { StoryDraftApi } from '@/hooks/use-story-draft';
import { formatCoordinates } from '@/map/camera';
import { evaluateMetric } from '@/story/metrics';
import { splitTitle } from '@/story/text';
import type { Story, StoryChapter } from '@/story/types';

export function StoryTitle({ title, as: Tag = 'h1', id, className }: {
  title: string;
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
}) {
  const { lead, main } = splitTitle(title);
  return (
    <Tag id={id} className={className}>
      {lead && <><span className="story-title-lead">{lead}<span className="sr-only">:</span></span>{' '}</>}
      <span className="story-title-main">{main}</span>
    </Tag>
  );
}

export function MetricLedger({ chapter, network, active, reducedMotion, editing, onLabelChange, layout = 'ledger' }: {
  chapter: StoryChapter;
  network: NetworkData;
  active: boolean;
  reducedMotion: boolean;
  editing?: boolean;
  onLabelChange?: (metricId: string, label: string) => void;
  layout?: 'ledger' | 'strip';
}) {
  if (!chapter.metrics.length) return null;
  return (
    <dl className={layout === 'strip' ? 'metric-strip' : 'ledger'}>
      {chapter.metrics.map((metric) => (
        <div className="ledger-row" key={metric.id}>
          <dt>
            <EditableText
              as="span"
              className="ledger-label"
              value={metric.label}
              editing={Boolean(editing)}
              singleLine
              label={`Metric label: ${metric.label || metric.id}`}
              onChange={(value) => onLabelChange?.(metric.id, value)}
            />
          </dt>
          <dd>
            <CountUp
              value={evaluateMetric(metric, network)}
              format={metric.format}
              active={active}
              reducedMotion={reducedMotion}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface ChapterArticleProps {
  chapter: StoryChapter;
  index: number;
  total: number;
  active: boolean;
  editing: boolean;
  reducedMotion: boolean;
  network: NetworkData;
  draft: StoryDraftApi;
  cameraOverridden: boolean;
  onUseCurrentView: () => void;
  onReturnToView: () => void;
  ref?: Ref<HTMLElement>;
}

export function ChapterArticle({
  chapter, index, total, active, editing, reducedMotion, network, draft, cameraOverridden,
  onUseCurrentView, onReturnToView, ref,
}: ChapterArticleProps) {
  const titleId = `chapter-${chapter.id}-title`;
  const framed = Boolean(chapter.focus.fit) && !cameraOverridden;
  return (
    <article
      ref={ref}
      id={chapter.id}
      className="chapter"
      data-active={active || undefined}
      aria-labelledby={titleId}
      aria-current={active ? 'step' : undefined}
    >
      <div className="chapter-leg">
        <span className="chapter-leg-mark" aria-hidden />
        <EditableText
          as="span"
          className="chapter-eyebrow"
          value={chapter.eyebrow}
          editing={editing}
          singleLine
          label="Chapter label"
          onChange={(value) => draft.setChapterText(chapter.id, 'eyebrow', value)}
        />
        <span className="chapter-count">
          <span className="sr-only">Chapter </span>{index + 1}<span aria-hidden> / </span><span className="sr-only"> of </span>{total}
        </span>
      </div>
      <EditableText
        as="h2"
        id={titleId}
        className="chapter-title"
        value={chapter.title}
        editing={editing}
        singleLine
        label="Chapter title"
        onChange={(value) => draft.setChapterText(chapter.id, 'title', value)}
      />
      <EditableText
        className="chapter-body"
        value={chapter.body}
        editing={editing}
        label="Chapter text"
        onChange={(value) => draft.setChapterText(chapter.id, 'body', value)}
      />
      <MetricLedger
        chapter={chapter}
        network={network}
        active={active}
        reducedMotion={reducedMotion}
        editing={editing}
        onLabelChange={(metricId, label) => draft.setMetricLabel(chapter.id, metricId, label)}
      />
      {editing ? (
        <div className="view-tools" role="group" aria-label="Map view for this chapter">
          <p className="view-tools-status">
            {framed
              ? 'Frames its sites and routes automatically. Saving a view replaces the automatic framing.'
              : cameraOverridden
                ? `Custom view · ${formatCoordinates(chapter.camera.center)} · zoom ${chapter.camera.zoom}`
                : `Saved view · ${formatCoordinates(chapter.camera.center)} · zoom ${chapter.camera.zoom}`}
          </p>
          <div className="view-tools-actions">
            <button type="button" className="stage-button stage-button-accent" onClick={onUseCurrentView} disabled={!active}
              title={active ? undefined : 'Scroll to this chapter first'}>
              <Crosshair className="icon-size-200" aria-hidden />
              Use current view
            </button>
            <button type="button" className="stage-button" onClick={onReturnToView} disabled={!active}>
              <LocateFixed className="icon-size-200" aria-hidden />
              Return to saved view
            </button>
          </div>
        </div>
      ) : (
        <p className="chapter-coords" aria-hidden>
          {framed ? 'Framed to fit' : `${formatCoordinates(chapter.camera.center)}`}
        </p>
      )}
    </article>
  );
}

export function IntroArticle({ story, editing, draft, chapterCount, minutes, sampleLabel, onBegin, onPresent, ref }: {
  story: Story;
  editing: boolean;
  draft: StoryDraftApi;
  chapterCount: number;
  minutes: number;
  sampleLabel: string;
  onBegin: () => void;
  onPresent: () => void;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <article ref={ref} className="intro" aria-labelledby="story-title">
      {editing ? (
        <div className="intro-edit">
          <EditableText
            as="h1"
            id="story-title"
            className="intro-title-edit"
            value={story.title}
            editing
            singleLine
            label="Story title"
            onChange={(value) => draft.setStoryText('title', value)}
          />
        </div>
      ) : (
        <StoryTitle id="story-title" title={story.title} className="intro-title" />
      )}
      <EditableText
        className="intro-subtitle"
        value={story.subtitle}
        editing={editing}
        label="Story subtitle"
        onChange={(value) => draft.setStoryText('subtitle', value)}
      />
      <div className="intro-actions">
        <button type="button" className="stage-button stage-button-primary stage-button-large" onClick={onBegin}>
          Begin the story
        </button>
        <button type="button" className="stage-button stage-button-large" onClick={onPresent}>
          Present it
        </button>
      </div>
      <p className="intro-meta">
        <span>{chapterCount} chapters</span>
        <span aria-hidden>·</span>
        <span>{minutes} min read</span>
        <span aria-hidden>·</span>
        <span className="intro-meta-sample">{sampleLabel}</span>
      </p>
    </article>
  );
}

export function OutroArticle({ story, activeChapter, onJump, onReplay, onPresent, ref }: {
  story: Story;
  activeChapter: number | null;
  onJump: (chapterIndex: number) => void;
  onReplay: () => void;
  onPresent: () => void;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <article ref={ref} className="outro" aria-labelledby="story-outro-title">
      <h2 id="story-outro-title" className="outro-title">The whole line, end to end</h2>
      <ol className="line-diagram" aria-label="Chapters">
        {story.chapters.map((chapter, index) => (
          <li key={chapter.id} className="line-stop" data-current={activeChapter === index || undefined}>
            <button type="button" className="line-stop-button" onClick={() => onJump(index)}>
              <span className="line-stop-dot" aria-hidden />
              <span className="line-stop-eyebrow">{chapter.eyebrow}</span>
              <span className="line-stop-title">{chapter.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="intro-actions">
        <button type="button" className="stage-button stage-button-primary stage-button-large" onClick={onPresent}>
          Present the story
        </button>
        <button type="button" className="stage-button stage-button-large" onClick={onReplay}>
          Back to the start
        </button>
      </div>
      <p className="outro-note">
        Ridgeline Coffee is a fictional company. Every site, route, and figure here comes from the bundled
        sample network.
      </p>
    </article>
  );
}
