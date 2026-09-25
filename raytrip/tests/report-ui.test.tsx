// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ReportWorkspace } from '../src/components/ReportWorkspace';
import { ReportMarkdown } from '../src/components/ReportMarkdown';
import type { TripReportRecord as TripReport } from '../rayfin/data/TripReport';
import { TripPhotoCacheProvider } from '../src/components/TripPhotoCache';

const api = vi.hoisted(() => ({
  saveTripReport: vi.fn(), finalizeTripReport: vi.fn(),
  generateTripReport: vi.fn(), getTripReport: vi.fn(),
  reopenTripReport: vi.fn(),
  getTripPhotoUrl: vi.fn(),
}));
vi.mock('@/services/trips', () => api);
const report: TripReport = {
  id: 'report-1', trip_id: 'trip-1', owner_id: 'owner',
  title: 'Conference', content: '## Summary\nOriginal', shareId: 'shared',
  generatedAt: new Date('2026-09-25'), status: 'draft',
};
function mount(initialReport: TripReport | null = report) {
  const router = createMemoryRouter([{ path: '*', element: <ReportWorkspace tripId="trip-1" initialReport={initialReport} /> }]);
  render(<TripPhotoCacheProvider><RouterProvider router={router} /></TripPhotoCacheProvider>);
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
    await waitFor(() => expect(api.finalizeTripReport).toHaveBeenCalledWith('report-1', '## Summary\nUpdated', null));
    expect(await screen.findByRole('button', { name: 'Copy share link' })).toBeTruthy();
  });
  it('keeps a failed save editable and does not publish', async () => {
    api.finalizeTripReport.mockRejectedValueOnce(new Error('Save failed'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Save & finalize' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Save failed');
    expect(screen.queryByRole('button', { name: 'Copy share link' })).toBeNull();
  });
  it('keeps report photo sharing off for existing reports and clears an invalid cover on opt-out', async () => {
    mount();
    expect(screen.getByRole('checkbox', { name: 'Include photo header in shared report' })).toHaveProperty('checked', false);
    expect(api.getTripPhotoUrl).not.toHaveBeenCalled();
    cleanup();
    mount({ ...report, includePhotoHeader: true, headerImageHash: 'invalid' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include photo header in shared report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.saveTripReport).toHaveBeenCalledWith('report-1', report.content, null));
    expect(screen.getByRole('checkbox', { name: 'Include photo header in shared report' })).toHaveProperty('checked', false);
  });
  it('requires an actual snapshot when photo sharing is enabled', async () => {
    mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include photo header in shared report' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Choose one to six header photos first.');
    expect(screen.getByRole('button', { name: 'Save & finalize' })).toHaveProperty('disabled', true);
    expect(api.finalizeTripReport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include photo header in shared report' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save & finalize' })).toHaveProperty('disabled', false);
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

  describe('reopening a finalized report', () => {
    function openConfirmation(initial: TripReport = { ...report, status: 'finalized', finalizedAt: new Date('2026-09-25') }) {
      mount(initial);
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Reopen for editing' }));
      return screen.getByRole('dialog', { name: 'Reopen this report?' });
    }

    it.each(['Keep finalized', 'Close dialog'])('does not update the report when choosing %s', label => {
      const dialog = openConfirmation();
      expect(within(dialog).getByText(/shared link will be unavailable/)).toBeTruthy();
      expect(api.reopenTripReport).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: label }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(api.reopenTripReport).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'Open shared report' }).getAttribute('href')).toBe('/reports/shared');
    });

    it('opens the unchanged Markdown in Edit and can finalize the same link again', async () => {
      const dialog = openConfirmation();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen for editing' }));
      await waitFor(() => expect(api.reopenTripReport).toHaveBeenCalledExactlyOnceWith('report-1'));
      const editor = await screen.findByRole('textbox');
      expect((editor as HTMLTextAreaElement).value).toBe(report.content);
      expect(screen.getByRole('status').textContent).toContain('Sharing is paused');
      expect(screen.queryByRole('link', { name: 'Open shared report' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Save changes' })).toHaveProperty('disabled', true);
      expect(api.generateTripReport).not.toHaveBeenCalled();
      expect(api.saveTripReport).not.toHaveBeenCalled();

      fireEvent.change(editor, { target: { value: 'Revised report.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save & finalize' }));
      await waitFor(() => expect(api.finalizeTripReport).toHaveBeenCalledWith('report-1', 'Revised report.', null));
      expect((await screen.findByRole('link', { name: 'Open shared report' })).getAttribute('href')).toBe('/reports/shared');
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('keeps the report finalized and shows failures inside the confirmation', async () => {
      api.reopenTripReport.mockRejectedValueOnce(new Error('Could not unpublish'));
      const dialog = openConfirmation();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen for editing' }));
      expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'Could not unpublish');
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep finalized' }));
      expect(screen.getByRole('link', { name: 'Open shared report' })).toBeTruthy();
    });

    it('waits for persisted success, blocks duplicate submissions and prevents closing while pending', async () => {
      let finish!: () => void;
      api.reopenTripReport.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
      const dialog = openConfirmation();
      const confirm = within(dialog).getByRole('button', { name: 'Reopen for editing' });
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      expect(api.reopenTripReport).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(within(dialog).getByRole('button', { name: 'Close dialog' })).toHaveProperty('disabled', true);
      expect(within(dialog).getByRole('button', { name: 'Keep finalized' })).toHaveProperty('disabled', true);
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.getByRole('dialog')).toBeTruthy();
      await act(async () => finish());
      expect(await screen.findByRole('textbox')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('cancels with the dialog Escape event before submission', () => {
      const dialog = openConfirmation();
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(api.reopenTripReport).not.toHaveBeenCalled();
    });

    it('reopens long legacy text without truncating it or applying save validation', async () => {
      const dialog = openConfirmation({
        ...report, content: undefined, summary: 'L'.repeat(3000),
        keyTakeaways: 'Legacy takeaway', status: 'finalized',
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen for editing' }));
      const editor = await screen.findByRole('textbox');
      expect((editor as HTMLTextAreaElement).value).toContain('L'.repeat(3000));
      expect((editor as HTMLTextAreaElement).value).toContain('Legacy takeaway');
      expect(screen.getByRole('button', { name: 'Save & finalize' })).toHaveProperty('disabled', true);
      expect(api.saveTripReport).not.toHaveBeenCalled();
    });
  });
});
