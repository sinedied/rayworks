import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Trip } from '../../rayfin/data/Trip';

import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/hooks/AuthContext';
import { createTrip, listTrips } from '@/services/trips';

function dateValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
    if (!user) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
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
      navigate(`/trips/${trip.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not create the trip.'
      );
    }
  }

  return (
    <div className="app-frame">
      <AppHeader />
      <main className="dashboard">
        <section className="dashboard-intro">
          <div>
            <p className="eyebrow">Travel intelligence, captured daily</p>
            <h1>Keep the signal.<br />Lose the paperwork.</h1>
          </div>
          <div className="intro-aside">
            <p>
              Record the moments that matter while they are fresh. Ray|Trip
              turns the trail into a polished report when you return.
            </p>
            <button className="primary-button" onClick={() => setCreating(true)}>
              Start a trip
            </button>
          </div>
        </section>

        {error && <div className="notice error-notice">{error}</div>}

        {nextTrip && (
          <button
            className="next-trip"
            onClick={() => navigate(`/trips/${nextTrip.id}`)}
          >
            <span className="next-label">Continue your field notes</span>
            <strong>{nextTrip.title}</strong>
            <span>
              {nextTrip.destination} · {dateValue(nextTrip.startDate)} —{' '}
              {dateValue(nextTrip.endDate)}
            </span>
            <i aria-hidden="true">↗</i>
          </button>
        )}

        <section className="trip-library">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your archive</p>
              <h2>Trips and reports</h2>
            </div>
            <span className="count-chip">{trips.length} total</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading your travel log…</div>
          ) : trips.length === 0 ? (
            <div className="empty-state">
              <span className="empty-index">01</span>
              <h3>Your first report starts with one note.</h3>
              <p>Create a trip, then add daily observations and photos.</p>
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
                    {dateValue(trip.startDate)} — {dateValue(trip.endDate)}
                  </time>
                  <span className="card-arrow">Open trip ↗</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {creating && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="Close"
              onClick={() => setCreating(false)}
            >
              ×
            </button>
            <p className="eyebrow">New assignment</p>
            <h2>Where are you headed?</h2>
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
              <button className="primary-button" type="submit">
                Create trip
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
