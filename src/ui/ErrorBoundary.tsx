import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Egy alfa elhibázása (pl. WebGL context nem hozható létre) ne döntse le az egész appot. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="view-error">
            <strong>A nézet nem jeleníthető meg.</strong>
            <span className="muted small">{this.state.error.message}</span>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
