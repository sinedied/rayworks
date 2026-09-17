import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import type { TripReport } from '../../rayfin/data/TripReport';

import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/hooks/AuthContext';
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

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function inputDate(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function PhotoTile({
  photo,
  onDelete,
}: {
  photo: TripPhoto;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    getTripPhotoUrl(photo).then((loaded) => {
      objectUrl = loaded;
      setUrl(loaded);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  return (
    <figure className="photo-tile">
      {url ? <img src={url} alt={photo.caption || 'Trip attachment'} /> : <div />}
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
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [report, setReport] = useState<TripReport | null>(null);
  const [editingDay, setEditingDay] = useState<TripDay | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextTrip, nextDays, nextPhotos, nextReport] = await Promise.all([
      getTrip(tripId),
      listTripDays(tripId),
      listTripPhotos(tripId),
      getTripReport(tripId),
    ]);
    setTrip(nextTrip);
    setDays(nextDays);
    setPhotos(nextPhotos);
    setReport(nextReport);
  }, [tripId]);

  useEffect(() => {
    refresh().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Could not load trip.')
    );
  }, [refresh]);

  const tripProgress = useMemo(() => {
    if (!trip) return 0;
    const start = new Date(trip.startDate).getTime();
    const end = new Date(trip.endDate).getTime();
    return Math.max(
      0,
      Math.min(100, Math.round(((Date.now() - start) / (end - start || 1)) * 100))
    );
  }, [trip]);

  async function handleDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
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
      setAddingDay(false);
      setEditingDay(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save note.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
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
      event.currentTarget.reset();
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not upload photo.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      await generateTripReport(tripId);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not generate the report.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReportSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await saveTripReport(report.id, {
        summary: String(form.get('summary')),
        keyTakeaways: String(form.get('keyTakeaways')),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!trip) {
    return (
      <div className="app-frame">
        <AppHeader />
        <main className="loading-page">{error || 'Loading field notes…'}</main>
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
                          void deleteTripDay(entry.id).then(refresh)
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
                    void updateTrip(trip.id, {
                      status: event.target.value as Trip['status'],
                    }).then(refresh)
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
                      {inputDate(entry.day)} — {entry.title || 'Daily notes'}
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
                  onDelete={() => void deleteTripPhoto(photo).then(refresh)}
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
                      onClick={() => void finalizeTripReport(report.id).then(refresh)}
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
                      editingDay ? inputDate(editingDay.day) : inputDate(trip.startDate)
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
