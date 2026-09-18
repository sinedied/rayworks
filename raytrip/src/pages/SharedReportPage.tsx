import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { TripReport } from '../../rayfin/data/TripReport';

import { AppHeader } from '@/components/AppHeader';
import { formatDate } from '@/lib/dates';
import { getSharedReport } from '@/services/trips';

export function SharedReportPage() {
  const { shareId = '' } = useParams();
  const [report, setReport] = useState<TripReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSharedReport(shareId)
      .then(setReport)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : 'Could not open the report.'
        )
      )
      .finally(() => setLoading(false));
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
            <header>
              <p className="eyebrow">Final trip report</p>
              <h1>{report.title}</h1>
              <p>
                Finalized {formatDate(report.finalizedAt || report.generatedAt, {
                  dateStyle: 'long',
                })}
              </p>
            </header>
            <section>
              <span className="report-section-number">01</span>
              <div>
                <h2>Executive summary</h2>
                <p className="report-prose">{report.summary}</p>
              </div>
            </section>
            <section>
              <span className="report-section-number">02</span>
              <div>
                <h2>Key takeaways</h2>
                <p className="report-prose">{report.keyTakeaways}</p>
              </div>
            </section>
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
