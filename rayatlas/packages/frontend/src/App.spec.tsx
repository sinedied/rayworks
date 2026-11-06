import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sampleNetwork } from '@/data/sample-network';
import type { UseNetworkResult } from '@/hooks/use-network';
import type { StoryMapProps } from '@/map/StoryMap';
import { sampleStory } from '@/story/sampleStory';

vi.mock('@/hooks/auth.context', () => ({
  useAuth: () => ({
    session: { user: { email: 'alex@example.com' }, isAuthenticated: true, isAnonymous: false },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/theme.context', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

const retry = vi.fn();
let networkResult: UseNetworkResult;
vi.mock('@/hooks/use-network', () => ({
  useNetwork: () => networkResult,
}));

const mapCamera = { center: [12.345678, 48.765432] as [number, number], zoom: 6.789, bearing: 10, pitch: 40 };
const mapProps: { current: StoryMapProps | null } = { current: null };
const returnToScene = vi.fn();

// jsdom has no WebGL: the map is replaced by a stub that records what the story asks of it.
vi.mock('@/map/StoryMap', () => ({
  StoryMap: (props: StoryMapProps) => {
    mapProps.current = props;
    useImperativeHandle(props.ref, () => ({ getCamera: () => mapCamera, returnToScene }), []);
    return <div data-testid="story-map" data-scene={props.scene.key} data-interactive={String(props.interactive)} />;
  },
}));

import App from '@/App';

/** Pretend the article with `id` sits on the reading line so it becomes the active chapter. */
function placeOnReadingLine(id: string) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const active = this.id === id;
    return { top: active ? 300 : 5000, bottom: active ? 500 : 5200, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  act(() => { window.dispatchEvent(new Event('scroll')); });
}

describe('Ray|Atlas story app', () => {
  beforeEach(() => {
    MotionGlobalConfig.skipAnimations = true;
    retry.mockClear();
    returnToScene.mockClear();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    networkResult = { network: sampleNetwork, status: 'ready', error: null, isRefreshing: false, source: 'sample', retry };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    MotionGlobalConfig.skipAnimations = false;
  });

  it('renders the story in reading order with a sample data label', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ridgeline Coffee: From ridge to cup' })).toBeVisible();
    const chapterTitles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(chapterTitles.slice(0, sampleStory.chapters.length)).toEqual(sampleStory.chapters.map((chapter) => chapter.title));
    expect(screen.getAllByText('Sample data').length).toBeGreaterThan(0);
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Story chapters' })).toBeInTheDocument();
    expect(screen.getByTestId('story-map')).toHaveAttribute('data-interactive', 'false');
    expect(screen.getAllByText('23').length).toBeGreaterThan(0);
  });

  it('shows loading and error states', () => {
    networkResult = { ...networkResult, network: null, status: 'loading' };
    const { rerender } = render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the story map');

    networkResult = { ...networkResult, status: 'error', error: 'Access denied.' };
    rerender(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('jumps chapters from the rail', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Chapter 4: Ocean freight/ }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.contexts.at(-1)).toHaveAttribute('id', 'crossing');
  });

  it('edits text and camera, autosaves, copies a prompt, and resets', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit story' }));
    expect(screen.getByTestId('story-map')).toHaveAttribute('data-interactive', 'true');
    expect(screen.getByRole('textbox', { name: 'Story title' })).toHaveValue(sampleStory.title);

    placeOnReadingLine('origins');
    const origins = screen.getAllByRole('article').find((article) => article.id === 'origins')!;
    const title = within(origins).getByRole('textbox', { name: 'Chapter title' });
    fireEvent.change(title, { target: { value: 'High and slow' } });
    expect(title).toHaveValue('High and slow');

    const useView = within(origins).getByRole('button', { name: 'Use current view' });
    await waitFor(() => expect(useView).toBeEnabled());
    fireEvent.click(useView);
    expect(within(origins).getByText(/Custom view · 48\.77° N, 12\.35° E · zoom 6\.79/)).toBeInTheDocument();
    fireEvent.click(within(origins).getByRole('button', { name: 'Return to saved view' }));
    expect(returnToScene).toHaveBeenCalled();

    await waitFor(() => expect(window.localStorage.getItem('rayatlas.story.ridgeline-coffee.v1')).toContain('High and slow'));

    fireEvent.click(screen.getByRole('button', { name: /Saved locally\. Open save menu/ }));
    expect(screen.getByText(/2 edited fields/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy changes as prompt' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const prompt = writeText.mock.calls[0][0];
    expect(prompt).toContain('"chapterId": "origins"');
    expect(prompt).toContain('"replacement": "High and slow"');
    expect(prompt).toContain('12.34568');
    expect(await screen.findByText('Prompt copied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset sample story' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset story' }));
    expect(window.localStorage.getItem('rayatlas.story.ridgeline-coffee.v1')).toBeNull();
    expect(within(origins).getByRole('textbox', { name: 'Chapter title' })).toHaveValue(sampleStory.chapters[1].title);
  });

  it('presents chapter by chapter from the keyboard and exits with Escape', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Present' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Present in this window' }));

    const presentation = await screen.findByRole('region', { name: sampleStory.title });
    expect(within(presentation).getByText('Press → or Space to begin')).toBeInTheDocument();
    expect(screen.getByTestId('story-map')).toHaveAttribute('data-scene', 'intro');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(await within(presentation).findByRole('heading', { name: sampleStory.chapters[0].title })).toBeInTheDocument();
    expect(screen.getByTestId('story-map')).toHaveAttribute('data-scene', 'overview');

    fireEvent.keyDown(window, { key: ' ' });
    expect(await within(presentation).findByRole('heading', { name: sampleStory.chapters[1].title })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'PageUp' });
    expect(await within(presentation).findByRole('heading', { name: sampleStory.chapters[0].title })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'End' });
    expect(await within(presentation).findByRole('heading', { name: 'The whole line, end to end' })).toBeInTheDocument();
    expect(screen.getByTestId('story-map')).toHaveAttribute('data-scene', 'outro');
    fireEvent.keyDown(window, { key: 'Home' });
    expect(screen.getByTestId('story-map')).toHaveAttribute('data-scene', 'intro');

    fireEvent.click(within(presentation).getByRole('button', { name: 'Autoplay' }));
    expect(within(presentation).getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(within(presentation).getByRole('button', { name: 'Autoplay' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('region', { name: sampleStory.title })).toBeNull());
    expect(screen.getByRole('button', { name: 'Present' })).toHaveFocus();
  });
});
