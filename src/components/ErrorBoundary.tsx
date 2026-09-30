import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CoHive Uncaught Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('cohive_last_view');
      localStorage.removeItem('cohive_push_banner_dismissed_until');
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          width: '100vw',
          backgroundColor: '#0f1115',
          color: '#f3f4f6',
          padding: '24px',
          boxSizing: 'border-box',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: 'rgba(24, 28, 37, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '36px 28px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>
              画面の表示中にエラーが発生しました
            </h2>

            <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#9ca3af', margin: '0 0 20px 0' }}>
              ブラウザ環境またはキャッシュデータとの不整合が発生した可能性があります。
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px',
                maxHeight: '80px',
                wordBreak: 'break-all'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px 20px',
                  background: '#0ea5e9',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
                <span>画面を再読み込み</span>
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  width: '100%',
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                キャッシュをリセットして再起動
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
