// ErrorBoundary.js (perf/first-load) — a PLAIN React class error boundary. It replaced
// Sentry.ErrorBoundary at the app root (main.jsx) and per screen (ScreenBoundary.jsx) so
// @sentry/react (88 KB raw) is no longer a static import of the boot bundle: the error is
// forwarded through lib/analytics captureException(), which queues until Sentry is lazily
// initialised and then flushes — a crash before init is still reported.
//
// Plain .js (React.createElement, no JSX) so the node unit tests can import it directly.
//
// Props:
//   fallback        — a node, or a render fn ({ error, reset, resetError }) => node.
//                     (`resetError` mirrors Sentry.ErrorBoundary's fallback prop shape.)
//   onError         — optional (error, info) => void, called before the report.
//   captureContext  — optional Sentry CaptureContext for the report (e.g. { tags: { screen } }).
import React from 'react';
import { captureException } from '../lib/analytics.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = () => this.setState({ error: null });
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      if (typeof this.props.onError === 'function') this.props.onError(error, info);
    } catch {
      /* a failing onError never masks the report */
    }
    captureException(error, this.props.captureContext);
  }

  render() {
    const { error } = this.state;
    if (error) {
      const fb = this.props.fallback;
      if (typeof fb === 'function') return fb({ error, reset: this.reset, resetError: this.reset });
      return fb === undefined ? null : fb;
    }
    return this.props.children === undefined ? null : this.props.children;
  }
}
