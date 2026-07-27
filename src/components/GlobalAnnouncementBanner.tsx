import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Info, AlertTriangle, X, ExternalLink } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content?: string;
  type: 'info' | 'warning' | 'critical';
  created_at?: string;
  createdAt?: string;
}

export const GlobalAnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const timerSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements/active');
        if (res.ok) {
          const data = await res.json() as any;
          const list = data.announcements || data.data || (Array.isArray(data) ? data : []);
          if (Array.isArray(list)) {
            setAnnouncements(list);
          }
        }
      } catch (e) {
        // SaaS環境以外や通信失敗時は静かにスルー
      }
    };

    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 60000); // 1分ごとにチェック
    return () => clearInterval(interval);
  }, []);

  // 新しく取得された各お知らせについて、10秒の自動消去タイマーを設定
  useEffect(() => {
    announcements.forEach((ann) => {
      if (!timerSetRef.current.has(ann.id)) {
        timerSetRef.current.add(ann.id);
        setTimeout(() => {
          setDismissedIds((prev) => (prev.includes(ann.id) ? prev : [...prev, ann.id]));
        }, 10000); // 10秒後に自動消去
      }
    });
  }, [announcements]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (selectedAnnouncement?.id === id) {
      setSelectedAnnouncement(null);
    }
  };

  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.includes(a.id));

  if (visibleAnnouncements.length === 0 && !selectedAnnouncement) return null;

  return (
    <>
      {/* keyframeアニメーションスタイルの注入 */}
      <style>{`
        @keyframes toastSlideDown {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* 画面上部中央のトースト表示エリア */}
      {visibleAnnouncements.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: 'min(90vw, 500px)',
            pointerEvents: 'none'
          }}
        >
          {visibleAnnouncements.map((ann) => {
            const isCritical = ann.type === 'critical';
            const isWarning = ann.type === 'warning';

            const bg = isCritical
              ? 'rgba(239, 68, 68, 0.92)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.92)'
              : 'rgba(14, 165, 233, 0.92)';

            const accentColor = isCritical
              ? '#ef4444'
              : isWarning
              ? '#f59e0b'
              : '#0ea5e9';

            const hasContent = Boolean(ann.content && ann.content.trim().length > 0);

            return (
              <div
                key={ann.id}
                onClick={() => {
                  if (hasContent) {
                    setSelectedAnnouncement(ann);
                  }
                }}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${accentColor}40`,
                  borderLeft: `4px solid ${accentColor}`,
                  borderRadius: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                  overflow: 'hidden',
                  position: 'relative',
                  animation: 'toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  cursor: hasContent ? 'pointer' : 'default',
                  transition: 'transform 0.2s, boxShadow 0.2s'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        background: bg,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isCritical ? (
                        <AlertTriangle size={16} />
                      ) : isWarning ? (
                        <AlertCircle size={16} />
                      ) : (
                        <Info size={16} />
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {ann.title}
                      </span>
                      {hasContent && (
                        <span style={{ fontSize: '12px', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {ann.content}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {hasContent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnouncement(ann);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#e2e8f0',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background 0.2s'
                        }}
                      >
                        <span>詳細</span>
                        <ExternalLink size={12} />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDismiss(ann.id, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'color 0.2s, background 0.2s'
                      }}
                      title="閉じる"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* 10秒カウントダウンプログレスバー */}
                <div
                  style={{
                    height: '3px',
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: accentColor,
                      animation: 'toastProgress 10s linear forwards'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 詳細表示モーダル */}
      {selectedAnnouncement && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            pointerEvents: 'auto'
          }}
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              color: '#f8fafc'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background:
                      selectedAnnouncement.type === 'critical'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : selectedAnnouncement.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(14, 165, 233, 0.2)',
                    color:
                      selectedAnnouncement.type === 'critical'
                        ? '#f87171'
                        : selectedAnnouncement.type === 'warning'
                        ? '#fbbf24'
                        : '#38bdf8'
                  }}
                >
                  {selectedAnnouncement.type === 'critical'
                    ? '緊急告知'
                    : selectedAnnouncement.type === 'warning'
                    ? '重要お知らせ'
                    : '全体お知らせ'}
                </span>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700, lineHeight: 1.4, color: '#ffffff' }}>
              {selectedAnnouncement.title}
            </h3>

            {(selectedAnnouncement.created_at || selectedAnnouncement.createdAt) && (
              <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#64748b' }}>
                発行日時: {new Date(selectedAnnouncement.created_at || selectedAnnouncement.createdAt || '').toLocaleString('ja-JP')}
              </p>
            )}

            <div
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#cbd5e1',
                maxHeight: '360px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {selectedAnnouncement.content}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                style={{
                  padding: '8px 20px',
                  background: '#0ea5e9',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

