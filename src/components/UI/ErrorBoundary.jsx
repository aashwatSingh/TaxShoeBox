import { Component } from 'react'

/**
 * Top-level error boundary. Catches render-time errors anywhere in the
 * tree so a single component crash shows a friendly recovery screen
 * instead of a blank white page in production.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // In production, forward this to an error-tracking service (Sentry, etc.)
    if (import.meta.env.DEV) {
      console.error('Uncaught error:', error, info)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false })
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-void px-4 text-center">
          <div className="panel w-full max-w-md p-8">
            <p className="label-wide">Error</p>
            <h1 className="display mt-3 text-2xl text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted">
              An unexpected error occurred. Reloading usually fixes it.
            </p>
            <button onClick={this.handleReset} className="btn btn-primary mt-6 w-full">
              Back to the overview
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
