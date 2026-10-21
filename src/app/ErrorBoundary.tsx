import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State { return { hasError: true } }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {}

  render(): ReactNode { return this.state.hasError ? this.props.fallback : this.props.children }
}
