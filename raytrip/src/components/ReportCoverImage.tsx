import { useEffect, useState } from 'react';
import type { ReportCover } from '../../rayfin/report-cover';
import { coverBlob } from '@/lib/report-cover';

export function ReportCoverImage({ cover, onError }: { cover: ReportCover; onError?: (error: string) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setUrl(''); setError('');
    coverBlob(cover).then(blob => {
      if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(reason => {
      if (active) {
        const message = reason instanceof Error ? reason.message : 'Report photo header could not be loaded.';
        setError(message); onError?.(message);
      }
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [cover, onError]);
  return error ? <p className="inline-error" role="alert">{error}</p>
    : <div className="report-cover-image">{url ? <img src={url} alt="Selected trip photos" /> : <span role="status">Loading photo header…</span>}</div>;
}
