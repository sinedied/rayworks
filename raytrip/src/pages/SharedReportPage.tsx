import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { TripReportRecord as TripReport } from '../../rayfin/data/TripReport';

import { AppHeader } from '@/components/AppHeader';
import { ReportMarkdown } from '@/components/ReportMarkdown';
import { reportDocument } from '@/lib/report';
import { getSharedReport } from '@/services/trips';
import { ReportHeader } from '@/components/ReportHeader';
import { readCoverState } from '@/lib/report-cover';

export function SharedReportPage() {
  const { shareId = '' } = useParams();
  const [report, setReport] = useState<TripReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cover = useMemo(() => readCoverState(report), [report]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setReport(null);
    getSharedReport(shareId)
      .then(value => { if (active) setReport(value); })
      .catch((reason: unknown) =>
        active && setError(
          reason instanceof Error ? reason.message : 'Could not open the report.'
        )
      )
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shareId]);

  return (
    <div className="app-frame report-view">
      <AppHeader />
      <main>
        <Link className="back-link" to="/">← Ray|Trip</Link>
        {loading ? (
          <div className="page-state">Opening report…</div>
        ) : error ? (
          <div className="page-state" role="alert">
            <h1>We could not open this report.</h1>
            <p>{error}</p>
            <Link className="button button-primary" to="/">
              Back to trips
            </Link>
          </div>
        ) : report ? (
          <article className="shared-report">
            <ReportHeader title={report.title} startDate={report.tripStartDate} endDate={report.tripEndDate}
              cover={cover.cover} coverError={cover.error} headingLevel={1} />
            <ReportMarkdown content={reportDocument(report)} />
            <footer>
              Shared securely with authenticated Ray|Trip users · ID {report.shareId}
            </footer>
          </article>
        ) : (
          <div className="empty-state">
            <h2>This report is unavailable.</h2>
            <p>The link may be incorrect, or the owner has not finalized it.</p>
          </div>
        )}
      </main>
    </div>
  );
}
