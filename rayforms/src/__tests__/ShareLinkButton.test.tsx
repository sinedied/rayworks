import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareLinkButton } from '../components/ShareLinkButton';

const toDataURL = vi.hoisted(() => vi.fn());
vi.mock('qrcode', () => ({ default: { toDataURL } }));

beforeEach(() => {
  toDataURL.mockReset().mockResolvedValue('data:image/png;base64,generated');
});
afterEach(() => { vi.restoreAllMocks(); });

describe('ShareLinkButton', () => {
  it('limits icon-button sizing to Close, not the modal copy action', async () => {
    const user = userEvent.setup();
    render(<ShareLinkButton shareToken="booth-token" formTitle="Feedback" />);
    await user.click(screen.getByRole('button', { name: 'Show QR code for Feedback' }));
    const dialog = screen.getByRole('dialog');
    const copyButton = within(dialog).getByRole('button', { name: 'Copy link' });
    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    expect(dialog).toHaveClass('[&>[data-slot=dialog-close]]:size-11');
    expect(dialog).not.toHaveClass('[&>button]:size-11');
    expect(closeButton).toHaveAttribute('data-slot', 'dialog-close');
    expect(copyButton).not.toHaveAttribute('data-slot', 'dialog-close');
    await user.click(copyButton);
    expect(copyButton).toHaveTextContent('Copied');
    expect(dialog).toBeInTheDocument();
  });

  it('retains one-click copying and only generates QR when opened', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<ShareLinkButton shareToken="booth-token" formTitle="Feedback" />);
    expect(toDataURL).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    const url = `${window.location.origin}/f/booth-token`;
    expect(writeText).toHaveBeenCalledWith(url);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Show QR code for Feedback' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Feedback' });
    expect(within(dialog).getByText(url)).toBeInTheDocument();
    expect(await within(dialog).findByRole('img')).toBeInTheDocument();
    expect(toDataURL).toHaveBeenCalledWith(url, expect.anything());
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });

  it('makes clipboard failures visible and keeps manual URL access', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));
    render(<ShareLinkButton shareToken="booth-token" formTitle="Feedback" />);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not copy');
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show QR code for Feedback' }));
    expect(screen.getByText(`${window.location.origin}/f/booth-token`)).toBeInTheDocument();
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });
});
