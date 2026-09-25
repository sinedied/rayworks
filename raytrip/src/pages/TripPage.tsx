import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import type { TripReport } from '../../rayfin/data/TripReport';
import { AppHeader } from '@/components/AppHeader';
import { Modal } from '@/components/Modal';
import { ReportWorkspace } from '@/components/ReportWorkspace';
import { useAuth } from '@/hooks/AuthContext';
import { formatDate, toDateInputValue, toValidDate } from '@/lib/dates';
import {
  deleteTripDay, deleteTripPhoto, getTrip, getTripPhotoUrl, getTripReport,
  listTripDays, listTripPhotos, saveTripDay, updateTrip, uploadTripPhoto,
} from '@/services/trips';

function PhotoTile({ photo, disabled, onDelete }: {
  photo: TripPhoto; disabled: boolean; onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    let started = false;
    setUrl(null);
    setError('');
    const load = () => {
      if (started || cancelled) return;
      started = true;
      getTripPhotoUrl(photo).then(value => {
        if (cancelled) URL.revokeObjectURL(value);
        else { objectUrl = value; setUrl(value); }
      }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load the photo.'); });
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) load();
    }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => { cancelled = true; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo, attempt]);
  return (
    <figure className="photo-tile" ref={container}>
      {url ? <img src={url} alt={photo.caption || 'Trip attachment'} /> : (
        <div className="photo-placeholder" role={error ? 'alert' : 'status'}>
          {error || 'Loading image…'}
          {!!error && <button className="text-button" onClick={() => setAttempt(value => value + 1)}>Retry preview</button>}
        </div>
      )}
      <figcaption>
        <span>{photo.caption || 'Trip photo'}</span>
        <button className="text-button danger" disabled={disabled} onClick={onDelete}>Remove</button>
      </figcaption>
    </figure>
  );
}

export function TripPage() {
  const { tripId = '' } = useParams();
  const location = useLocation();
  // A fresh workspace per history entry keeps late async work out of subsequent visits.
  return <TripWorkspace key={`${location.key}:${tripId}`} tripId={tripId} />;
}

function TripWorkspace({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [report, setReport] = useState<TripReport | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [view, setView] = useState<'notes' | 'report'>('notes');
  const [editingDay, setEditingDay] = useState<TripDay | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoProgress, setPhotoProgress] = useState('');
  const uploadController = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const mutation = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; uploadController.current?.abort(); };
  }, []);

  const refresh = useCallback(async () => {
    const id = ++request.current;
    const current = () => mounted.current && request.current === id;
    setError(null);
    try {
      const nextTrip = await getTrip(tripId);
      if (!current()) return;
      if (!nextTrip) { setPageState('not-found'); return; }
      setTrip(nextTrip);
      const results = await Promise.allSettled([
        listTripDays(tripId), listTripPhotos(tripId), getTripReport(tripId),
      ]);
      if (!current()) return;
      const failures: string[] = [];
      if (results[0].status === 'fulfilled') setDays(results[0].value);
      else failures.push('Daily notes could not be loaded.');
      if (results[1].status === 'fulfilled') setPhotos(results[1].value);
      else failures.push('Photos could not be loaded.');
      if (results[2].status === 'fulfilled') { setReport(results[2].value); setReportLoaded(true); }
      else failures.push('The report could not be loaded.');
      if (failures.length) setError(failures.join(' '));
      setPageState('ready');
    } catch (reason) {
      if (!current()) return;
      setError(reason instanceof Error ? reason.message : 'Could not load this trip.');
      setPageState('error');
    }
  }, [tripId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function runMutation(
    action: () => Promise<void>,
    failure: (message: string | null) => void = setError,
    success?: () => void
  ) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    failure(null);
    try {
      await action();
      if (!mounted.current) return;
      success?.();
      await refresh();
    } catch (reason) {
      if (mounted.current) failure(reason instanceof Error ? reason.message : 'Could not save changes.');
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function handleDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setNoteError('Sign in again before saving.'); return; }
    const form = new FormData(event.currentTarget);
    void runMutation(() => saveTripDay(tripId, user.id, {
      day: new Date(String(form.get('day'))),
      title: String(form.get('title')) || undefined,
      notes: String(form.get('notes')),
    }, editingDay?.id), setNoteError, () => { setAddingDay(false); setEditingDay(null); });
  }

  function handlePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setPhotoError('Sign in again before uploading.'); return; }
    const element = event.currentTarget;
    const form = new FormData(element);
    const file = form.get('photo');
    if (!(file instanceof File) || !file.size) { setPhotoError('Choose a photo to upload.'); return; }
    if (mutation.current) return;
    const controller = new AbortController();
    uploadController.current = controller;
    void runMutation(() => uploadTripPhoto(
      tripId, user.id, file, String(form.get('caption')) || undefined,
      String(form.get('tripDayId')) || undefined,
      { signal: controller.signal, onProgress: message => { if (mounted.current) setPhotoProgress(message); } }
    ), message => {
      setPhotoError(message);
      if (message) { setPhotoProgress(''); void refresh(); }
    }, () => element.reset());
  }

  const readyPhotos = photos.filter(photo => photo.storageBackend === 'sql-v1' && photo.uploadState === 'ready');
  const pendingPhotos = photos.filter(photo => photo.storageBackend !== 'sql-v1' || photo.uploadState !== 'ready');
  const start = toValidDate(trip?.startDate)?.getTime();
  const end = toValidDate(trip?.endDate)?.getTime();
  const progress = start === undefined || end === undefined ? 0
    : Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start || 1)) * 100)));

  return (
    <div className="app-frame">
      <AppHeader />
      {pageState !== 'ready' || !trip ? (
        <main className="page-state" role={pageState === 'error' ? 'alert' : undefined}>
          <h1>{pageState === 'loading' ? 'Loading trip' : pageState === 'not-found' ? 'Trip not found' : 'We could not load this trip.'}</h1>
          <p>{pageState === 'error' ? error : pageState === 'not-found' ? 'It may have been removed or belongs to another user.' : 'Retrieving your notes, photos, and report.'}</p>
          <div className="button-row">
            {pageState === 'error' && <button className="button button-primary" onClick={() => void refresh()}>Try again</button>}
            {pageState !== 'loading' && <Link className="button button-secondary" to="/">Back to trips</Link>}
          </div>
        </main>
      ) : (
        <main className="trip-page">
          <Link className="back-link" to="/">← All trips</Link>
          <section className="trip-masthead">
            <div>
              <span className={`status-pill status-${trip.status}`}>{trip.status}</span>
              <h1>{trip.title}</h1>
              <p>{trip.destination}</p>
            </div>
            <div className="trip-dates"><span>{formatDate(trip.startDate)}</span><span aria-hidden="true">—</span><span>{formatDate(trip.endDate)}</span></div>
            <div className="progress-track" role="progressbar" aria-label="Trip timeline" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          </section>
          <div className="trip-view-tabs" role="tablist" aria-label="Trip views">
            {(['notes', 'report'] as const).map((name, index) => (
              <button
                key={name} type="button" id={`tab-${name}`} role="tab"
                aria-selected={view === name} aria-controls={`panel-${name}`}
                tabIndex={view === name ? 0 : -1}
                onClick={() => setView(name)}
                onKeyDown={event => {
                  const next = event.key === 'Home' ? 'notes' : event.key === 'End' ? 'report'
                    : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (index ? 'notes' : 'report') : null;
                  if (next) { event.preventDefault(); setView(next); document.getElementById(`tab-${next}`)?.focus(); }
                }}
              >{name === 'notes' ? 'Notes & photos' : 'Report'}</button>
            ))}
          </div>
          {error && <div className="notice error-notice" role="alert">{error} <button className="text-button" onClick={() => void refresh()}>Retry</button></div>}
          <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" hidden={view !== 'notes'}>
            <div className="trip-columns">
              <section className="journal-column">
                <div className="section-heading">
                  <h2>Daily notes</h2>
                  <button className="secondary-button" disabled={busy} onClick={() => { setNoteError(null); setAddingDay(true); }}>Add day</button>
                </div>
                <div className="timeline">
                  {!days.length && <div className="empty-inline">Add a note to capture what mattered today.</div>}
                  {days.map(day => (
                    <article className="day-entry" key={day.id}>
                      <time>{formatDate(day.day)}</time>
                      <div>
                        <h3>{day.title || 'Daily notes'}</h3><p>{day.notes}</p>
                        <div className="entry-actions">
                          <button className="text-button" disabled={busy} onClick={() => { setNoteError(null); setEditingDay(day); }}>Edit</button>
                          <button className="text-button danger" disabled={busy} onClick={() => void runMutation(() => deleteTripDay(day.id))}>Delete</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="trip-sidebar">
                <section className="side-card">
                  <h2>Trip details</h2><p className="purpose-copy">{trip.purpose || 'No purpose added yet.'}</p>
                  <label>Trip state
                    <select value={trip.status} disabled={busy} onChange={event => {
                      const status = event.target.value;
                      if (status === 'draft' || status === 'active' || status === 'completed') {
                        void runMutation(() => updateTrip(tripId, { status }));
                      }
                    }}>
                      <option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option>
                    </select>
                  </label>
                </section>
                <section className="side-card photo-upload">
                  <h2>Add a photo</h2>
                  <p className="report-meta">Up to 20 MiB. We save an optimized JPEG copy up to 1,600px and 512 KiB, not the original.</p>
                  <form onSubmit={handlePhoto}>
                    <label>Photo<input name="photo" type="file" accept="image/*" required disabled={busy} /></label>
                    <label>Caption<input name="caption" maxLength={500} placeholder="What should you remember?" disabled={busy} /></label>
                    <label>Associate with a day<select name="tripDayId" defaultValue="" disabled={busy}>
                      <option value="">General trip photo</option>
                      {days.map(day => <option key={day.id} value={day.id}>{toDateInputValue(day.day)} — {day.title || 'Daily notes'}</option>)}
                    </select></label>
                    {photoError && <p className="inline-error" role="alert">{photoError}</p>}
                    {!!photoProgress && <p role="status" className="report-meta">{photoProgress}</p>}
                    <button className="secondary-button" disabled={busy} type="submit">Upload photo</button>
                  </form>
                </section>
              </aside>
            </div>
            {!!pendingPhotos.length && (
              <section className="photo-section">
                <h2>Photos needing attention</h2>
                {pendingPhotos.map(photo => (
                  <div className="side-card" key={photo.id}>
                    <p>{photo.caption || photo.fileName || 'Photo'}</p>
                    <p>{photo.storageBackend !== 'sql-v1'
                      ? 'This legacy photo used native storage, which is unavailable on Fabric. Re-upload your original image.'
                      : photo.uploadState === 'deleting' ? 'Removal did not finish. Retry to remove the remaining data.'
                        : 'This upload is incomplete. Discard it, then select the image to upload again.'}</p>
                    <button className="secondary-button" disabled={busy} onClick={() => void runMutation(() => deleteTripPhoto(photo))}>
                      {photo.uploadState === 'deleting' ? 'Retry removal' : 'Discard photo record'}
                    </button>
                  </div>
                ))}
              </section>
            )}
            {!!readyPhotos.length && (
              <section className="photo-section">
                <div className="section-heading"><h2>Trip photos ({readyPhotos.length})</h2></div>
                <div className="photo-grid">{readyPhotos.map(photo => (
                  <PhotoTile key={photo.id} photo={photo} disabled={busy} onDelete={() => void runMutation(() => deleteTripPhoto(photo))} />
                ))}</div>
              </section>
            )}
          </div>
          <div id="panel-report" role="tabpanel" aria-labelledby="tab-report" hidden={view !== 'report'}>
            {reportLoaded ? <ReportWorkspace tripId={tripId} initialReport={report} /> : (
              <div className="page-state" role="alert"><h2>Report unavailable</h2><p>Load the saved report before generating a new one.</p><button className="secondary-button" onClick={() => void refresh()}>Retry report loading</button></div>
            )}
          </div>
          {(addingDay || editingDay) && (
            <Modal title={editingDay ? 'Edit daily note' : 'Add daily note'} wide onClose={() => { if (!busy) { setAddingDay(false); setEditingDay(null); } }}>
              <form className="form-stack" onSubmit={handleDay}>
                <div className="form-row">
                  <label>Day<input name="day" type="date" required defaultValue={toDateInputValue(editingDay?.day || trip.startDate)} disabled={busy} /></label>
                  <label>Headline<input name="title" maxLength={160} defaultValue={editingDay?.title} disabled={busy} /></label>
                </div>
                <label>Notes<textarea name="notes" required maxLength={4000} rows={10} defaultValue={editingDay?.notes} disabled={busy} /></label>
                {noteError && <div className="inline-error" role="alert">{noteError}</div>}
                <button className="primary-button" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save note'}</button>
              </form>
            </Modal>
          )}
        </main>
      )}
    </div>
  );
}
