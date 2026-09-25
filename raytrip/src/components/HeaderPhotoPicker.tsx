import { useEffect, useRef, useState } from 'react';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import { HEADER_PHOTO_LIMIT } from '../../rayfin/report-cover';
import { Modal } from './Modal';
import { PhotoMosaic } from './PhotoMosaic';
import { useTripPhoto } from '@/hooks/useTripPhotos';

function Choice({ photo, checked, disabled, onChange }: {
  photo: TripPhoto; checked: boolean; disabled: boolean; onChange: () => void;
}) {
  const ref = useRef<HTMLLabelElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: '100px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const { url, error } = useTripPhoto(photo, visible);
  return (
    <label ref={ref} className={`header-photo-choice${checked ? ' is-selected' : ''}`}>
      {url ? <img src={url} alt="" loading="lazy" /> : <span>{error || 'Loading…'}</span>}
      <span><input type="checkbox" aria-label={photo.caption || photo.fileName || 'Trip photo'} checked={checked} disabled={disabled} onChange={onChange} />{photo.caption || photo.fileName || 'Trip photo'}</span>
    </label>
  );
}

export function HeaderPhotoPicker({ photos, selected, onSave, onClose }: {
  photos: readonly TripPhoto[]; selected: readonly string[];
  onSave: (ids: string[]) => Promise<void>; onClose: () => void;
}) {
  const [ids, setIds] = useState(() => selected.filter(id => photos.some(photo => photo.id === id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const chosen = ids.flatMap(id => photos.filter(photo => photo.id === id));
  return (
    <Modal title="Choose header photos" wide closeDisabled={saving} onClose={onClose}>
      <p>Choose up to six photos. Selection order determines their placement. Remove all to use a plain header.</p>
      <p className="report-meta" role="status">{ids.length} / {HEADER_PHOTO_LIMIT} selected</p>
      {!!chosen.length && <div className="mosaic-picker-preview"><PhotoMosaic photos={chosen} /></div>}
      <div className="header-photo-choices">
        {photos.map(photo => <Choice key={photo.id} photo={photo} checked={ids.includes(photo.id)}
          disabled={saving || (!ids.includes(photo.id) && ids.length >= HEADER_PHOTO_LIMIT)}
          onChange={() => setIds(current => current.includes(photo.id) ? current.filter(id => id !== photo.id) : [...current, photo.id])} />)}
      </div>
      {!photos.length && <p>Upload a photo first. Only completed uploads can be selected.</p>}
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="button-row">
        <button className="button button-secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={saving} onClick={async () => {
          setSaving(true); setError('');
          try { await onSave(ids); onClose(); }
          catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save header photos.'); }
          finally { setSaving(false); }
        }}>{saving ? 'Saving…' : 'Save header photos'}</button>
      </div>
    </Modal>
  );
}
