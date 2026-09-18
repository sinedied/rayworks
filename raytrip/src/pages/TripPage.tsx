import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import type { TripReport } from '../../rayfin/data/TripReport';

import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/hooks/AuthContext';
import { formatDate, toDateInputValue, toValidDate } from '@/lib/dates';
import {
  deleteTripDay,
  deleteTripPhoto,
  finalizeTripReport,
  generateTripReport,
  getTrip,
  getTripPhotoUrl,
  getTripReport,
  listTripDays,
  listTripPhotos,
  saveTripDay,
  saveTripReport,
  updateTrip,
  uploadTripPhoto,
} from '@/services/trips';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';

function PhotoTile({
  photo,
  onDelete,
}: {
  photo: TripPhoto;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    setLoadFailed(false);
    getTripPhotoUrl(photo)
      .then((loaded) => {
        objectUrl = loaded;
        setUrl(loaded);
      })
      .catch(() => setLoadFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  return (
    <figure className="photo-tile">
      {url ? (
        <img src={url} alt={photo.caption || 'Trip attachment'} />
      ) : (
        <div className="photo-placeholder">
          {loadFailed ? 'Preview unavailable' : 'Loading image…'}
        </div>
      )}
      <figcaption>
        <span>{photo.caption || 'Untitled field photo'}</span>
        <button className="text-button danger" onClick={onDelete}>
          Remove
        </button>
      </figcaption>
    </figure>
  );
}

export function TripPage() {
  const { tripId = '' } = useParams();
  const { key: routeKey } = useLocation();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [report, setReport] = useState<TripReport | null>(null);
  const [editingDay, setEditingDay] = useState<TripDay | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const loadRequest = useRef(0);
  const activeRoute = useRef({ tripId, routeKey, generation: 0 });

  useLayoutEffect(() => {
    activeRoute.current = {
      tripId,
      routeKey,
      generation: activeRoute.current.generation + 1,
    };
  }, [routeKey, tripId]);

  function isCurrentRoute(
    routeTripId: string,
    expectedRouteKey: string,
    expectedGeneration: number
  ) {
    return (
      activeRoute.current.tripId === routeTripId &&
      activeRoute.current.routeKey === expectedRouteKey &&
      activeRoute.current.generation === expectedGeneration
    );
  }

  const refresh = useCallback(async (showLoading = false) => {
    const requestId = ++loadRequest.current;
    const requestedTripId = tripId;
    const requestedRouteKey = routeKey;
    const requestedGeneration = activeRoute.current.generation;
    if (showLoading) {
      setPageState('loading');
      setTrip(null);
      setDays([]);
      setPhotos([]);
      setReport(null);
    }
    setError(null);

    try {
      const nextTrip = await getTrip(requestedTripId);
      if (
        requestId !== loadRequest.current ||
        !isCurrentRoute(
          requestedTripId,
          requestedRouteKey,
          requestedGeneration
        )
      ) {
        return;
      }
      if (!nextTrip) {
        setTrip(null);
        setPageState('not-found');
        return;
      }

      setTrip(nextTrip);

      const [daysResult, photosResult, reportResult] = await Promise.allSettled([
        listTripDays(requestedTripId),
        listTripPhotos(requestedTripId),
        getTripReport(requestedTripId),
      ]);
      if (
        requestId !== loadRequest.current ||
        !isCurrentRoute(
          requestedTripId,
          requestedRouteKey,
          requestedGeneration
        )
      ) {
        return;
      }
      const sectionFailures: string[] = [];

      if (daysResult.status === 'fulfilled') {
        setDays(daysResult.value);
      } else {
        setDays([]);
        sectionFailures.push('Daily notes could not be loaded.');
      }
      if (photosResult.status === 'fulfilled') {
        setPhotos(photosResult.value);
      } else {
        setPhotos([]);
        sectionFailures.push('Photos could not be loaded.');
      }
      if (reportResult.status === 'fulfilled') {
        setReport(reportResult.value);
      } else {
        setReport(null);
        sectionFailures.push('The report draft could not be loaded.');
      }

      if (sectionFailures.length) setError(sectionFailures.join(' '));
      setPageState('ready');
    } catch (reason) {
      if (
        requestId !== loadRequest.current ||
        !isCurrentRoute(
          requestedTripId,
          requestedRouteKey,
          requestedGeneration
        )
      ) {
        return;
      }
      setTrip(null);
      setError(
        reason instanceof Error ? reason.message : 'Could not load this trip.'
      );
      setPageState('error');
    }
  }, [routeKey, tripId]);

  useEffect(() => {
    setBusy(false);
    setAddingDay(false);
    setEditingDay(null);
    void refresh(true);
  }, [refresh]);

  const tripProgress = useMemo(() => {
    if (!trip) return 0;
    const start = toValidDate(trip.startDate)?.getTime();
    const end = toValidDate(trip.endDate)?.getTime();
    if (start === undefined || end === undefined) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round(((Date.now() - start) / (end - start || 1)) * 100))
    );
  }, [trip]);

  async function handleDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const mutationTripId = tripId;
    const mutationRouteKey = routeKey;
    const mutationGeneration = activeRoute.current.generation;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await saveTripDay(
        tripId,
        user.id,
        {
          day: new Date(String(form.get('day'))),
          title: String(form.get('title')) || undefined,
          notes: String(form.get('notes')),
        },
        editingDay?.id
      );
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setAddingDay(false);
        setEditingDay(null);
        await refresh();
      }
    } catch (reason) {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setError(
          reason instanceof Error ? reason.message : 'Could not save note.'
        );
      }
    } finally {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setBusy(false);
      }
    }
  }

  async function handlePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const mutationTripId = tripId;
    const mutationRouteKey = routeKey;
    const mutationGeneration = activeRoute.current.generation;
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    setError(null);
    try {
      await uploadTripPhoto(
        tripId,
        user.id,
        file,
        String(form.get('caption')) || undefined,
        String(form.get('tripDayId')) || undefined
      );
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        event.currentTarget.reset();
        await refresh();
      }
    } catch (reason) {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setError(
          reason instanceof Error ? reason.message : 'Could not upload photo.'
        );
      }
    } finally {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setBusy(false);
      }
    }
  }

  async function handleGenerate() {
    const mutationTripId = tripId;
    const mutationRouteKey = routeKey;
    const mutationGeneration = activeRoute.current.generation;
    setBusy(true);
    setError(null);
    try {
      await generateTripReport(tripId);
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        await refresh();
      }
    } catch (reason) {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not generate the report.'
        );
      }
    } finally {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setBusy(false);
      }
    }
  }

  async function handleReportSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report) return;
    const mutationTripId = tripId;
    const mutationRouteKey = routeKey;
    const mutationGeneration = activeRoute.current.generation;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await saveTripReport(report.id, {
        summary: String(form.get('summary')),
        keyTakeaways: String(form.get('keyTakeaways')),
      });
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        await refresh();
      }
    } catch (reason) {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setError(
          reason instanceof Error ? reason.message : 'Could not save the report.'
        );
      }
    } finally {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setBusy(false);
      }
    }
  }

  async function runMutation(
    action: () => Promise<void>,
    failureMessage: string
  ) {
    const mutationTripId = tripId;
    const mutationRouteKey = routeKey;
    const mutationGeneration = activeRoute.current.generation;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        await refresh();
      }
    } catch (reason) {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setError(reason instanceof Error ? reason.message : failureMessage);
      }
    } finally {
      if (
        isCurrentRoute(
          mutationTripId,
          mutationRouteKey,
          mutationGeneration
        )
      ) {
        setBusy(false);
      }
    }
  }

  if (pageState === 'loading') {
    return (
      <div className="app-frame">
        <AppHeader />
        <main className="page-state">
          <div className="spinner" aria-hidden="true" />
          <h1>Loading trip</h1>
          <p>Retrieving your notes, photos, and report.</p>
        </main>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="app-frame">
        <AppHeader />
        <main className="page-state" role="alert">
          <h1>We could not load this trip.</h1>
          <p>{error}</p>
          <div className="button-row">
            <button
              className="button button-primary"
              onClick={() => void refresh(true)}
            >
              Try again
            </button>
            <Link className="button button-secondary" to="/">
              Back to trips
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (pageState === 'not-found' || !trip) {
    return (
      <div className="app-frame">
        <AppHeader />
        <main className="page-state">
          <h1>Trip not found</h1>
          <p>This trip may have been removed or belongs to another user.</p>
          <Link className="button button-primary" to="/">
            Back to trips
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <AppHeader />
      <main className="trip-page">
        <Link className="back-link" to="/">← All trips</Link>
        <section className="trip-masthead">
          <div>
            <span className={`status-pill status-${trip.status}`}>{trip.status}</span>
            <h1>{trip.title}</h1>
            <p>{trip.destination}</p>
          </div>
          <div className="trip-dates">
            <span>{formatDate(trip.startDate)}</span>
            <i />
            <span>{formatDate(trip.endDate)}</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${tripProgress}%` }} />
          </div>
        </section>

        {error && <div className="notice error-notice">{error}</div>}

        <div className="trip-columns">
          <section className="journal-column">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Chronology</p>
                <h2>Daily field notes</h2>
              </div>
              <button className="secondary-button" onClick={() => setAddingDay(true)}>
                Add day
              </button>
            </div>

            <div className="timeline">
              {days.length === 0 && (
                <div className="empty-inline">No notes yet. Capture the first signal.</div>
              )}
              {days.map((entry) => (
                <article className="day-entry" key={entry.id}>
                  <time>{formatDate(entry.day)}</time>
                  <div>
                    <h3>{entry.title || 'Daily notes'}</h3>
                    <p>{entry.notes}</p>
                    <div className="entry-actions">
                      <button className="text-button" onClick={() => setEditingDay(entry)}>
                        Edit
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() =>
                          void runMutation(
                            () => deleteTripDay(entry.id),
                            'Could not delete the daily note.'
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="trip-sidebar">
            <section className="side-card">
              <p className="eyebrow">Assignment brief</p>
              <p className="purpose-copy">{trip.purpose || 'No purpose added yet.'}</p>
              <label>
                Trip state
                <select
                  value={trip.status}
                  onChange={(event) =>
                    void runMutation(
                      () =>
                        updateTrip(trip.id, {
                          status: event.target.value as Trip['status'],
                        }),
                      'Could not update the trip status.'
                    )
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </section>

            <section className="side-card photo-upload">
              <p className="eyebrow">Visual evidence</p>
              <h3>Add a field photo</h3>
              <form onSubmit={(event) => void handlePhoto(event)}>
                <input name="photo" type="file" accept="image/*" required />
                <input name="caption" maxLength={500} placeholder="What should you remember?" />
                <select name="tripDayId" defaultValue="">
                  <option value="">General trip photo</option>
                  {days.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {toDateInputValue(entry.day)} — {entry.title || 'Daily notes'}
                    </option>
                  ))}
                </select>
                <button className="secondary-button" disabled={busy} type="submit">
                  Upload photo
                </button>
              </form>
            </section>
          </aside>
        </div>

        {photos.length > 0 && (
          <section className="photo-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Contact sheet</p>
                <h2>{photos.length} captured moments</h2>
              </div>
            </div>
            <div className="photo-grid">
              {photos.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  onDelete={() =>
                    void runMutation(
                      () => deleteTripPhoto(photo),
                      'Could not remove the photo.'
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section className="report-studio">
          <div className="report-intro">
            <p className="eyebrow">Report studio</p>
            <h2>Turn the trail into a brief.</h2>
            <p>
              Your daily notes and photo captions become a focused draft you can
              review before sharing.
            </p>
            {report?.status !== 'finalized' && (
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void handleGenerate()}
              >
                {report ? 'Regenerate draft' : 'Generate report'}
              </button>
            )}
          </div>

          {report ? (
            <form className="report-paper" onSubmit={(event) => void handleReportSave(event)}>
              <div className="report-paper-head">
                <span>{report.status === 'finalized' ? 'Final report' : 'Working draft'}</span>
                <time>{formatDate(report.generatedAt)}</time>
              </div>
              <h3>{report.title}</h3>
              <label>
                Executive summary
                <textarea
                  name="summary"
                  rows={9}
                  maxLength={4000}
                  defaultValue={report.summary}
                  readOnly={report.status === 'finalized'}
                />
              </label>
              <label>
                Key takeaways
                <textarea
                  name="keyTakeaways"
                  rows={7}
                  maxLength={4000}
                  defaultValue={report.keyTakeaways}
                  readOnly={report.status === 'finalized'}
                />
              </label>
              <div className="report-actions">
                {report.status === 'draft' ? (
                  <>
                    <button className="secondary-button" disabled={busy} type="submit">
                      Save edits
                    </button>
                    <button
                      className="primary-button"
                      disabled={busy}
                      type="button"
                      onClick={() =>
                        void runMutation(
                          () => finalizeTripReport(report.id),
                          'Could not finalize the report.'
                        )
                      }
                    >
                      Finalize & share
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="secondary-button" to={`/reports/${report.shareId}`}>
                      Open shared report
                    </Link>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/reports/${report.shareId}`
                        )
                      }
                    >
                      Copy share link
                    </button>
                  </>
                )}
              </div>
            </form>
          ) : (
            <div className="report-placeholder">
              <span>AI draft</span>
              <p>Complete your notes, then generate a structured summary here.</p>
            </div>
          )}
        </section>
      </main>

      {(addingDay || editingDay) && (
        <div className="modal-backdrop">
          <section className="modal-card wide" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="Close"
              onClick={() => {
                setAddingDay(false);
                setEditingDay(null);
              }}
            >
              ×
            </button>
            <p className="eyebrow">{editingDay ? 'Revise entry' : 'New field note'}</p>
            <h2>What stood out today?</h2>
            <form className="form-stack" onSubmit={(event) => void handleDay(event)}>
              <div className="form-row">
                <label>
                  Day
                  <input
                    name="day"
                    type="date"
                    required
                    defaultValue={
                      editingDay
                        ? toDateInputValue(editingDay.day)
                        : toDateInputValue(trip.startDate)
                    }
                  />
                </label>
                <label>
                  Headline
                  <input
                    name="title"
                    maxLength={160}
                    defaultValue={editingDay?.title}
                    placeholder="The recurring theme"
                  />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  name="notes"
                  required
                  maxLength={4000}
                  rows={12}
                  defaultValue={editingDay?.notes}
                  placeholder="Conversations, observations, decisions, follow-ups…"
                />
              </label>
              <button className="primary-button" disabled={busy} type="submit">
                Save field note
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
