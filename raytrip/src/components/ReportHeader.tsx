import type { ReportCover } from '../../rayfin/report-cover';
import { formatTripDateRange } from '../../rayfin/functions/src/report-dates';
import { ReportCoverImage } from './ReportCoverImage';

export function ReportHeader({
  title, startDate, endDate, cover = null, coverError = '', headingLevel = 2,
}: {
  title: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  cover?: ReportCover | null;
  coverError?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const date = formatTripDateRange(startDate, endDate);
  return (
    <header className={`report-document-header${cover ? ' report-header-with-photo' : ''}`}>
      {cover && <ReportCoverImage cover={cover} />}
      {coverError && <p className="inline-error" role="alert">{coverError}</p>}
      <div className="shared-report-heading">
        <Heading className="report-document-title">{title}</Heading>
        {date && <p className="report-trip-date">{date}</p>}
      </div>
    </header>
  );
}
