import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ray|Trip route failed to render.', error, info);
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="route-error" role="alert">
        <div className="route-error-card">
          <p className="section-label">Something went wrong</p>
          <h1>We could not display this page.</h1>
          <p>
            Your data is still safe. Reload the page or return to your trips and
            try again.
          </p>
          <div className="button-row">
            <button
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <a className="button button-secondary" href="/">
              Back to trips
            </a>
          </div>
        </div>
      </main>
    );
  }
}
