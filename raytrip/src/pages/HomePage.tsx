import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Trip } from '../../rayfin/data/Trip';

import { AppHeader } from '@/components/AppHeader';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/hooks/AuthContext';
import { formatDate } from '@/lib/dates';
import { createTrip, listTrips } from '@/services/trips';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTrips()
      .then(setTrips)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Could not load trips.')
      )
      .finally(() => setLoading(false));
  }, []);

  const nextTrip = useMemo(
    () =>
      trips.find(
        (trip) =>
          trip.status !== 'completed' &&
          new Date(trip.endDate).getTime() >= Date.now()
      ),
    [trips]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!user) { setError('Sign in again before creating a trip.'); return; }
    const form = new FormData(event.currentTarget);
    setError(null);
    setSaving(true);
    try {
      if (String(form.get('endDate')) < String(form.get('startDate'))) {
        throw new Error('The end date must be on or after the start date.');
      }
      const trip = await createTrip(
        {
          title: String(form.get('title')),
          destination: String(form.get('destination')),
          purpose: String(form.get('purpose')) || undefined,
          startDate: new Date(String(form.get('startDate'))),
          endDate: new Date(String(form.get('endDate'))),
        },
        user.id
      );
      if (!trip.id) {
        throw new Error('The trip was created without a valid identifier.');
      }
      navigate(`/trips/${trip.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not create the trip.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-frame">
      <AppHeader />
      <main className="dashboard">
        <section className="dashboard-intro">
          <div>
            <p className="eyebrow">Trip reporting</p>
            <h1>Your trips and reports</h1>
          </div>
          <div className="intro-aside">
            <p>
              Capture daily notes and photos, then prepare a concise report for
              review and sharing.
            </p>
            <button className="primary-button" onClick={() => setCreating(true)}>
              Create trip
            </button>
          </div>
        </section>

        {error && <div className="notice error-notice">{error}</div>}

        {nextTrip && (
          <button
            className="next-trip"
            onClick={() => navigate(`/trips/${nextTrip.id}`)}
          >
            <span className="next-label">Current trip</span>
            <strong>{nextTrip.title}</strong>
            <span>
              {nextTrip.destination} · {formatDate(nextTrip.startDate)} —{' '}
              {formatDate(nextTrip.endDate)}
            </span>
            <i aria-hidden="true">↗</i>
          </button>
        )}

        <section className="trip-library">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your archive</p>
              <h2>All trips</h2>
            </div>
            <span className="count-chip">{trips.length} total</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading your travel log…</div>
          ) : trips.length === 0 ? (
            <div className="empty-state">
              <span className="empty-index">+</span>
              <h3>No trips yet</h3>
              <p>Create a trip to start capturing daily notes and photos.</p>
              <button className="secondary-button" onClick={() => setCreating(true)}>
                Create your first trip
              </button>
            </div>
          ) : (
            <div className="trip-grid">
              {trips.map((trip, index) => (
                <button
                  className="trip-card"
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                >
                  <span className="trip-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`status-pill status-${trip.status}`}>
                    {trip.status}
                  </span>
                  <h3>{trip.title}</h3>
                  <p>{trip.destination}</p>
                  <time>
                    {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                  </time>
                  <span className="card-arrow">Open trip ↗</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {creating && (
        <Modal title="Create a trip" onClose={() => { if (!saving) { setCreating(false); setError(null); } }}>
            <form className="form-stack" onSubmit={(event) => void handleCreate(event)}>
              <label>
                Trip title
                <input name="title" required maxLength={160} placeholder="Build 2026" />
              </label>
              <label>
                Destination
                <input name="destination" required maxLength={160} placeholder="San Francisco" />
              </label>
              <label>
                Purpose
                <textarea
                  name="purpose"
                  maxLength={600}
                  rows={3}
                  placeholder="Conference goals, customer meetings, research…"
                />
              </label>
              <div className="form-row">
                <label>
                  Starts
                  <input name="startDate" required type="date" />
                </label>
                <label>
                  Ends
                  <input name="endDate" required type="date" />
                </label>
              </div>
              {error && <div className="inline-error" role="alert">{error}</div>}
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create trip'}
              </button>
            </form>
        </Modal>
      )}
    </div>
  );
}
