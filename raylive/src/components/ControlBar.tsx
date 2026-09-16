import { useState } from 'react';

import type { RoomControls } from '@/hooks/useRoomControls';

const SHORTCUTS: [string, string][] = [
  ['→ / space / n', 'Next activity'],
  ['← / p', 'Previous activity'],
  ['Enter', 'Start question, or open the next one'],
  ['e', 'End the current activity'],
  ['r', 'Reveal quiz answers'],
  ['j', 'Show or hide the join info'],
  ['l', 'Toggle the leaderboard'],
  ['?', 'This help'],
];

export interface ControlBarProps {
  controls: RoomControls;
  leaderboard: boolean;
  onToggleLeaderboard: () => void;
  helpOpen: boolean;
  onToggleHelp: () => void;
}

/**
 * Presenter controls overlaid on the projected view. Rendered only for the signed-in owner, so a
 * projected or embedded copy never shows them.
 */
export function ControlBar({
  controls,
  leaderboard,
  onToggleLeaderboard,
  helpOpen,
  onToggleHelp,
}: ControlBarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-20 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/80"
      >
        Controls
      </button>
    );
  }

  return (
    <>
      {helpOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-xl">
            <h2 className="text-lg font-bold">Keyboard shortcuts</h2>
            <dl className="mt-4 space-y-2">
              {SHORTCUTS.map(([keys, description]) => (
                <div key={keys} className="flex justify-between gap-6 text-sm">
                  <dt className="font-mono text-gray-500">{keys}</dt>
                  <dd className="text-right">{description}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={onToggleHelp}
              className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-2 bg-black/60 p-3 backdrop-blur print:hidden">
        <ControlButton
          onClick={() => void controls.previous()}
          disabled={!controls.hasPrevious || controls.busy}
          label="Previous activity"
        >
          ←
        </ControlButton>

        <ControlButton
          onClick={() => void controls.startOrAdvance()}
          disabled={
            controls.busy || (!controls.canStart && !controls.hasNext)
          }
          primary
          label={controls.canStart ? 'Start question' : 'Next activity'}
        >
          {controls.canStart ? 'Start question' : 'Next'}
        </ControlButton>

        <ControlButton
          onClick={() => void controls.next()}
          disabled={!controls.hasNext || controls.busy}
          label="Next activity"
        >
          →
        </ControlButton>

        <span className="mx-2 h-6 w-px bg-white/20" aria-hidden="true" />

        <ControlButton
          onClick={() => void controls.end()}
          disabled={!controls.current || controls.busy}
          label="End activity"
        >
          End
        </ControlButton>

        {controls.current?.kind === 'quiz' && (
          <ControlButton
            onClick={() => void controls.reveal()}
            disabled={controls.busy}
            label="Reveal answers"
          >
            Reveal
          </ControlButton>
        )}

        <ControlButton
          onClick={() => void controls.toggleJoinInfo()}
          disabled={controls.busy}
          label="Toggle join info"
        >
          {controls.showJoinInfo ? 'Hide join' : 'Show join'}
        </ControlButton>

        <ControlButton
          onClick={onToggleLeaderboard}
          label="Toggle leaderboard"
        >
          {leaderboard ? 'Results' : 'Leaderboard'}
        </ControlButton>

        <ControlButton onClick={onToggleHelp} label="Keyboard shortcuts">
          ?
        </ControlButton>

        <ControlButton onClick={() => setCollapsed(true)} label="Hide controls">
          ✕
        </ControlButton>

        {controls.error && (
          <p className="w-full text-center text-xs text-red-300">
            {controls.error}
          </p>
        )}
      </div>
    </>
  );
}

function ControlButton({
  onClick,
  disabled = false,
  primary = false,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-30 ${
        primary
          ? 'bg-white text-gray-900 hover:bg-gray-200'
          : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}
