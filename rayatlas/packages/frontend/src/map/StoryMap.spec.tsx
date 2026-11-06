import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { sampleNetwork } from '@/data/sample-network';
import { sampleStory } from '@/story/sampleStory';
import { buildScenes } from '@/story/scenes';

vi.mock('./webgl', () => ({ supportsWebGL: () => false }));

import { StoryMap } from './StoryMap';

describe('StoryMap', () => {
  it('explains a missing WebGL context without blocking the story', () => {
    render(
      <StoryMap
        network={sampleNetwork}
        scene={buildScenes(sampleStory)[0]}
        padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        interactive={false}
        reducedMotion
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('WebGL is turned off or unavailable');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
