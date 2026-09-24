import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QrCode } from '../components/QrCode';

const toDataURL = vi.hoisted(() => vi.fn());
vi.mock('qrcode', () => ({ default: { toDataURL } }));

beforeEach(() => {
  toDataURL.mockReset().mockResolvedValue('data:image/png;base64,generated');
});
afterEach(() => { vi.restoreAllMocks(); });

describe('QrCode', () => {
  it('generates the exact URL locally with a scan-safe quiet zone', async () => {
    render(<QrCode url="https://forms.example/f/test" title="Feedback" />);
    expect(screen.getByRole('status')).toHaveTextContent('Generating');
    expect(await screen.findByRole('img', { name: 'QR code to open Feedback' }))
      .toHaveAttribute('src', 'data:image/png;base64,generated');
    expect(toDataURL).toHaveBeenCalledWith('https://forms.example/f/test', {
      width: 512, margin: 4, color: { dark: '#000000', light: '#ffffff' },
    });
  });

  it('reports failures and supports retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    toDataURL.mockRejectedValueOnce(new Error('Encoder unavailable'));
    render(<QrCode url="https://forms.example/f/test" title="Feedback" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not generate');
    await user.click(screen.getByRole('button', { name: 'Retry QR code' }));
    expect(await screen.findByRole('img')).toBeInTheDocument();
    expect(toDataURL).toHaveBeenCalledTimes(2);
  });

  it('ignores stale results when the URL changes', async () => {
    let finishOld: (data: string) => void = () => {};
    toDataURL.mockImplementationOnce(() => new Promise<string>((resolve) => { finishOld = resolve; }));
    const { rerender } = render(<QrCode url="https://forms.example/f/old" title="Old" />);
    await waitFor(() => expect(toDataURL).toHaveBeenCalledTimes(1));
    rerender(<QrCode url="https://forms.example/f/new" title="New" />);
    await screen.findByRole('img', { name: 'QR code to open New' });
    await act(async () => { finishOld('data:image/png;base64,old'); });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,generated');
  });
});
