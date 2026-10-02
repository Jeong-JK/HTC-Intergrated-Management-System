import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              오류가 발생했습니다
            </h1>
            <p className="text-slate-600 mb-6">
              예기치 않은 오류가 발생했습니다. 페이지를 새로고침하거나 홈으로 이동해주세요.
            </p>
            {this.state.error && (
              <details className="text-left mb-6 p-3 bg-slate-100 rounded-lg">
                <summary className="cursor-pointer text-sm text-slate-500">오류 상세</summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                새로고침
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
