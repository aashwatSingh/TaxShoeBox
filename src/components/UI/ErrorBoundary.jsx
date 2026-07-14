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
        <div className="bg-app min-h-screen flex flex-col items-center justify-center px-4 text-center">
          <div className="surface max-w-md w-full p-8">
            <div className="text-4xl mb-4">🗂️</div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-zinc-500 dark:text-white/50 mb-6">
              An unexpected error occurred. Reloading usually fixes it.
            </p>
            <button onClick={this.handleReset} className="btn-primary w-full">
              Back to safety
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
