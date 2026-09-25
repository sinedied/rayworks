// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ReportWorkspace } from '../src/components/ReportWorkspace';
import { ReportMarkdown } from '../src/components/ReportMarkdown';
import type { TripReport } from '../rayfin/data/TripReport';

const api = vi.hoisted(() => ({
  saveTripReport: vi.fn(), finalizeTripReport: vi.fn(),
  generateTripReport: vi.fn(), getTripReport: vi.fn(),
}));
vi.mock('@/services/trips', () => api);
const report: TripReport = {
  id: 'report-1', trip_id: 'trip-1', owner_id: 'owner',
  title: 'Conference', content: '## Summary\nOriginal', shareId: 'shared',
  generatedAt: new Date('2026-09-25'), status: 'draft',
};
function mount(initialReport: TripReport | null = report) {
  const router = createMemoryRouter([{ path: '*', element: <ReportWorkspace tripId="trip-1" initialReport={initialReport} /> }]);
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

describe('report editing workflow', () => {
  it('preserves edits between edit and preview and finalizes current text', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '## Summary\nUpdated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview', exact: true }));
    expect(screen.getByText('Updated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('## Summary\nUpdated');
    fireEvent.click(screen.getByRole('button', { name: 'Save & finalize' }));
    await waitFor(() => expect(api.finalizeTripReport).toHaveBeenCalledWith('report-1', '## Summary\nUpdated'));
    expect(await screen.findByRole('button', { name: 'Copy share link' })).toBeTruthy();
  });
  it('keeps a failed save editable and does not publish', async () => {
    api.finalizeTripReport.mockRejectedValueOnce(new Error('Save failed'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Save & finalize' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Save failed');
    expect(screen.queryByRole('button', { name: 'Copy share link' })).toBeNull();
  });
  it('confirms regeneration and replaces controlled text with the saved result', async () => {
    api.getTripReport.mockResolvedValueOnce({ ...report, content: '## Summary\nRegenerated' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate', exact: true }));
    expect(api.generateTripReport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate report' }));
    expect(await screen.findByText('Regenerated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('## Summary\nRegenerated');
  });
  it('preserves over-limit finalized legacy reports without edit controls', () => {
    mount({ ...report, content: undefined, summary: 'L'.repeat(3000), keyTakeaways: 'Legacy takeaway', status: 'finalized' });
    expect(screen.getByText('L'.repeat(3000))).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull();
  });
  it('does not render raw HTML, unsafe URLs, or remote images', () => {
    const { container } = render(<ReportMarkdown content={'<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![private](https://example.com/track)\n\n[good](https://example.com)'} />);
    expect(container.querySelector('script,img')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'good' }).getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('renders important Markdown phrases as bold without emphasizing the entire bullet', () => {
    render(<ReportMarkdown content={'## Key takeaways\n- **Access approval is pending**, so the trial cannot start yet.'} />);
    expect(screen.getByText('Access approval is pending').tagName).toBe('STRONG');
    const bullet = screen.getByRole('listitem');
    expect(bullet.textContent).toBe('Access approval is pending, so the trial cannot start yet.');
    expect(bullet.querySelector('strong')?.textContent).toBe('Access approval is pending');
  });
});
