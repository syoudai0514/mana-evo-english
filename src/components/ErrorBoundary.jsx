// 画面の途中でエラーが起きても真っ白にしない。ログに残して、ホームへもどれるようにする
import React from 'react'
import { reportLiveProblem } from '../lib/live.js'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    reportLiveProblem({ step: 'render-error', message: `${error?.message || error} @${(info?.componentStack || '').split('\n')[1]?.trim() || ''}`.slice(0, 300) })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 48 }}>🙇</div>
          <p style={{ fontWeight: 900, marginTop: 8 }}>うまく ひょうじ できなかったよ</p>
          <button className="press cta" style={{ marginTop: 18, height: 56, fontSize: 18 }} onClick={() => { this.setState({ error: null }); this.props.onReset?.() }}>ホームへ もどる</button>
        </div>
      </div>
    )
  }
}
