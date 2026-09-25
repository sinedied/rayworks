import { useEffect, useRef, useState } from 'react';
import { Link, useBeforeUnload, useBlocker } from 'react-router-dom';
import type { TripReport } from '../../rayfin/data/TripReport';
import { formatDate } from '@/lib/dates';
import { reportDocument, REPORT_MAX_LENGTH, validateReportContent } from '@/lib/report';
import { finalizeTripReport, generateTripReport, getTripReport, saveTripReport } from '@/services/trips';
import { Modal } from './Modal';
import { ReportMarkdown } from './ReportMarkdown';

export function ReportWorkspace({ tripId, initialReport }: {
  tripId: string;
  initialReport: TripReport | null;
}) {
  const [report, setReport] = useState(initialReport);
  const [saved, setSaved] = useState(initialReport ? reportDocument(initialReport) : '');
  const [content, setContent] = useState(saved);
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const [pending, setPending] = useState<'generate' | 'save' | 'finalize' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const finalized = report?.status === 'finalized';
  const dirty = !finalized && content !== saved;
  const blocker = useBlocker(dirty || pending !== null);
  useBeforeUnload(event => {
    if (dirty || pending) { event.preventDefault(); event.returnValue = ''; }
  });
  const invalid = !content.trim() || content.trim().length > REPORT_MAX_LENGTH;

  async function perform(action: 'generate' | 'save' | 'finalize') {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(action);
    setError(null);
    setNotice('');
    try {
      if (action === 'generate') {
        await generateTripReport(tripId);
        const next = await getTripReport(tripId);
        if (!next) throw new Error('The report was generated but could not be loaded. Reload the trip before trying again.');
        if (!alive.current) return;
        const text = reportDocument(next);
        setReport(next);
        setSaved(text);
        setContent(text);
        setMode('preview');
        setNotice('Draft generated and saved. Review it before finalizing.');
      } else {
        if (!report) throw new Error('Generate a report first.');
        const text = validateReportContent(content);
        if (action === 'save') await saveTripReport(report.id, text);
        else await finalizeTripReport(report.id, text);
        if (!alive.current) return;
        setReport({ ...report, content: text, ...(action === 'finalize' ? { status: 'finalized', finalizedAt: new Date() } : {}) });
        setSaved(text);
        setContent(text);
        if (action === 'finalize') setMode('preview');
        setNotice(action === 'save' ? 'Changes saved.' : 'Report finalized. It is ready to share.');
      }
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : 'The report could not be updated.');
    } finally {
      inFlight.current = false;
      if (alive.current) setPending(null);
    }
  }

  async function copyLink() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(new URL(`/reports/${report.shareId}`, window.location.origin).href);
      if (alive.current) { setError(null); setNotice('Share link copied. Viewers need Fabric app access.'); }
    } catch {
      if (alive.current) setError('Could not copy the link. Open the shared report and copy its address.');
    }
  }

  return (
    <section className="report-workspace" aria-labelledby="report-title" aria-busy={pending !== null}>
      <header className="report-toolbar">
        <div>
          <h2 id="report-title">Trip report</h2>
          <p className="report-meta">{report ? `${finalized ? 'Finalized' : 'Draft'} · ${formatDate(finalized ? report.finalizedAt : report.generatedAt)}` : 'A concise brief from your notes and photo captions.'}</p>
        </div>
        {report && !finalized && (
          <button className="button button-secondary" disabled={!!pending} onClick={() => setConfirmRegenerate(true)}>
            Regenerate
          </button>
        )}
      </header>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="report-feedback" role="status">
        {pending === 'generate' ? 'Generating your brief. Your previous draft is kept until the new one is saved.' : pending === 'save' ? 'Saving changes…' : pending === 'finalize' ? 'Saving and finalizing…' : notice}
      </div>
      {!report ? (
        <div className="report-empty">
          <h3>Bring the trip together</h3>
          <p>Generate a 250–300-word report with a brief summary, 2–3 key takeaways, and next steps when there are any. Ready to review and edit.</p>
          <button className="button button-primary" disabled={!!pending} onClick={() => void perform('generate')}>
            {pending ? 'Generating…' : 'Generate trip report'}
          </button>
        </div>
      ) : (
        <>
          {!finalized && (
            <div className="editor-toolbar">
              <div className="view-switch" aria-label="Report display">
                <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Edit</button>
                <button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>Preview</button>
              </div>
              <span className={content.trim().length > REPORT_MAX_LENGTH ? 'danger' : 'report-meta'}>
                {content.trim().length.toLocaleString('en')} / 2,500 characters{dirty ? ' · Unsaved' : ''}
              </span>
            </div>
          )}
          {!finalized && content.trim().length > REPORT_MAX_LENGTH && (
            <p className="inline-error" role="alert">This report is preserved in full. Shorten it to 2,500 characters before saving a revision or finalizing.</p>
          )}
          {mode === 'edit' && !finalized ? (
            <label className="report-editor">
              Report (Markdown)
              <textarea
                aria-describedby="markdown-help"
                rows={16}
                value={content}
                disabled={!!pending}
                onChange={event => setContent(event.target.value)}
              />
              <span id="markdown-help">Use headings, lists, and links. The limit includes Markdown formatting.</span>
            </label>
          ) : <ReportMarkdown content={content} />}
          <footer className="report-actions">
            {finalized ? (
              <>
                <button className="button button-primary" onClick={() => void copyLink()}>Copy share link</button>
                <Link className="button button-secondary" to={`/reports/${report.shareId}`}>Open shared report</Link>
              </>
            ) : (
              <>
                <button className="button button-secondary" disabled={!!pending || invalid || !dirty} onClick={() => void perform('save')}>Save changes</button>
                <button className="button button-primary" disabled={!!pending || invalid} onClick={() => void perform('finalize')}>Save & finalize</button>
              </>
            )}
          </footer>
        </>
      )}
      {confirmRegenerate && (
        <Modal title="Replace this draft?" onClose={() => setConfirmRegenerate(false)}>
          <p>Generating again replaces the saved report{dirty ? ' and your unsaved edits' : ''}. The current draft is kept if generation fails.</p>
          <div className="button-row">
            <button className="button button-secondary" onClick={() => setConfirmRegenerate(false)}>Keep draft</button>
            <button className="button button-primary" onClick={() => { setConfirmRegenerate(false); void perform('generate'); }}>Regenerate report</button>
          </div>
        </Modal>
      )}
      {blocker.state === 'blocked' && (
        <Modal title="Leave this trip?" onClose={() => blocker.reset()}>
          <p>{pending ? 'An update is still running. Leaving will not cancel a server operation.' : 'Your unsaved report edits will be lost.'}</p>
          <div className="button-row">
            <button className="button button-secondary" onClick={() => blocker.reset()}>Stay</button>
            <button className="button button-primary" onClick={() => blocker.proceed()}>Leave trip</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
