"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-red-600 mb-4">组件渲染出错</h2>
          <pre className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-sm overflow-auto whitespace-pre-wrap text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
            {this.state.error?.message}
          </pre>
          <p className="mt-4 text-sm text-muted-foreground">
            {this.state.error?.stack?.split("\n").slice(1, 4).join("\n")}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-black/[0.05] dark:bg-white/[0.08] rounded-lg text-sm cursor-pointer border-0"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
