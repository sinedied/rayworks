import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { TripReport } from '../../rayfin/data/TripReport';

import { AppHeader } from '@/components/AppHeader';
import { getSharedReport } from '@/services/trips';

export function SharedReportPage() {
  const { shareId = '' } = useParams();
  const [report, setReport] = useState<TripReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSharedReport(shareId)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [shareId]);

  return (
    <div className="app-frame report-view">
      <AppHeader />
      <main>
        <Link className="back-link" to="/">← Ray|Trip</Link>
        {loading ? (
          <div className="loading-page">Opening report…</div>
        ) : report ? (
          <article className="shared-report">
            <header>
              <p className="eyebrow">Final trip report</p>
              <h1>{report.title}</h1>
              <p>
                Finalized{' '}
                {new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(
                  new Date(report.finalizedAt || report.generatedAt)
                )}
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
