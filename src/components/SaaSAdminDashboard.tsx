import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Server, HardDrive, Key, Globe, Lock, LogOut, Check, 
  RefreshCw, Clipboard, CreditCard, FileText, Plus, Trash2, Edit3, Save, X, Download, AlertCircle, Megaphone, ExternalLink, Loader
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

export interface SaaSAdminDashboardProps {
  currentPath: string;
  adminSetupRequired: boolean;
  onAdminSetupComplete: () => void;
  onLogoutAdmin: () => void;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  isActive: boolean | number;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
}

interface AuditLog {
  id: string;
  workspaceId?: string;
  userName?: string;
  action: string;
  details: any;
  ipAddress?: string;
  createdAt: string;
}

export const SaaSAdminDashboard: React.FC<SaaSAdminDashboardProps> = ({
  currentPath,
  adminSetupRequired,
  onAdminSetupComplete,
  onLogoutAdmin,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  const [activeTab, setActiveTab] = useState<'announcements' | 'audit' | 'admins' | 'settings'>('announcements');
  const [token, setToken] = useState<string | null>(localStorage.getItem('cohive_admin_token'));

  // アナウンスステート
  // アナウンス状態
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);

  // アナウンス共通モーダル状態（新規作成 / 編集）
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [annModalMode, setAnnModalMode] = useState<'create' | 'edit'>('create');
  const [targetAnnId, setTargetAnnId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('info');
  const [formStartAt, setFormStartAt] = useState('');
  const [formEndAt, setFormEndAt] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 監査ログステート
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('cohive_admin_token');
    setToken(null);
    onLogoutAdmin();
  };

  // 全体告知メッセージ取得
  const loadAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; announcements: Announcement[] }>('/api/admin/announcements');
      if (res.success && Array.isArray(res.announcements)) {
        setAnnouncements(res.announcements);
      }
    } catch (e) {
      console.error("Failed to load announcements:", e);
    } finally {
      setAnnLoading(false);
    }
  };

  // 監査ログ取得
  const loadAuditLogs = async () => {
    setLogLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'announcements') loadAnnouncements();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  const handleOpenCreateModal = () => {
    setAnnModalMode('create');
    setTargetAnnId(null);
    setFormTitle('');
    setFormContent('');
    setFormType('info');
    setFormStartAt('');
    setFormEndAt('');
    setFormIsActive(true);
    setFormError(null);
    setIsAnnModalOpen(true);
  };

  const handleOpenEditModal = (ann: Announcement) => {
    setAnnModalMode('edit');
    setTargetAnnId(ann.id);
    setFormTitle(ann.title || '');
    setFormContent(ann.content || '');
    setFormType(ann.type || 'info');
    setFormIsActive(ann.isActive === 1 || ann.isActive === true || (ann as any).is_active === 1 || (ann as any).is_active === true);
    setFormError(null);

    const formatForInput = (str?: string | null) => {
      if (!str) return '';
      try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return '';
      }
    };

    setFormStartAt(formatForInput(ann.startAt || (ann as any).start_at));
    setFormEndAt(formatForInput(ann.endAt || (ann as any).end_at));
    setIsAnnModalOpen(true);
  };

  const handleAnnFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const finalStartAt = formStartAt ? new Date(formStartAt).toISOString() : null;
      const finalEndAt = formEndAt ? new Date(formEndAt).toISOString() : null;

      if (annModalMode === 'create') {
        const res = await apiClient.post<{ success: boolean; error?: string }>('/api/admin/announcements', {
          title: formTitle,
          content: formContent,
          type: formType,
          startAt: finalStartAt,
          endAt: finalEndAt,
          isActive: formIsActive
        });
        if (res.success) {
          setIsAnnModalOpen(false);
          loadAnnouncements();
        }
      } else {
        const res = await apiClient.put<{ success: boolean; error?: string }>(`/api/admin/announcements/${targetAnnId}`, {
          title: formTitle,
          content: formContent,
          type: formType,
          startAt: finalStartAt,
          endAt: finalEndAt,
          isActive: formIsActive
        });
        if (res.success) {
          setIsAnnModalOpen(false);
          loadAnnouncements();
        }
      }
    } catch (err: any) {
      setFormError(err.message || '処理に失敗しました。');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('この告知メッセージを削除しますか？')) return;
    try {
      await apiClient.delete(`/api/admin/announcements/${id}`);
      loadAnnouncements();
    } catch (e) {
      console.error(e);
    }
  };

  const isAnnLimitReached = announcements.length >= 1;

  return (
    <div style={{ padding: '24px 32px', color: '#f8fafc', background: '#090d16', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={28} color="#0ea5e9" />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>CoHive SaaS 管理コンソール</h2>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={14} />
          <span>ログアウト</span>
        </button>
      </div>

      {/* タブナビゲーション */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
        <button 
          onClick={() => setActiveTab('announcements')} 
          style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', background: activeTab === 'announcements' ? '#0ea5e9' : 'transparent', color: activeTab === 'announcements' ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Megaphone size={16} />
          <span>全体告知管理</span>
        </button>

        <button 
          onClick={() => setActiveTab('audit')} 
          style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', background: activeTab === 'audit' ? '#0ea5e9' : 'transparent', color: activeTab === 'audit' ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} />
          <span>監査ログ</span>
        </button>

        <button 
          onClick={() => setActiveTab('admins')} 
          style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', background: activeTab === 'admins' ? '#0ea5e9' : 'transparent', color: activeTab === 'admins' ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={16} />
          <span>管理者アカウント</span>
        </button>
      </div>

      {/* 1. 全体告知管理 タブ (掲載期間指定対応) */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {annError && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} />
              <span>{annError}</span>
            </div>
          )}

          {/* 全体告知メッセージ一覧 */}
          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#94a3b8' }}>登録済み全体告知メッセージ一覧</span>
              <button 
                onClick={handleOpenCreateModal}
                style={{ 
                  padding: '8px 16px', 
                  background: '#0ea5e9', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: 700, 
                  fontSize: '12px',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}
              >
                <Plus size={14} />
                <span>+ 新規全体告知を作成</span>
              </button>
            </div>
            {annLoading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}><Loader className="animate-spin" size={24} /></div>
            ) : announcements.length > 0 ? (
              announcements.map(ann => {
                const isActive = ann.isActive === 1 || ann.isActive === true || (ann as any).is_active === 1 || (ann as any).is_active === true;
                const now = new Date().getTime();
                const startVal = ann.startAt || (ann as any).start_at;
                const endVal = ann.endAt || (ann as any).end_at;
                const startTime = startVal ? new Date(startVal).getTime() : null;
                const endTime = endVal ? new Date(endVal).getTime() : null;

                let statusText = '○ 非公開';
                let statusColor = '#94a3b8';

                if (isActive) {
                  if (startTime && startTime > now) {
                    statusText = '⏰ 予約中';
                    statusColor = '#fbbf24';
                  } else if (endTime && endTime < now) {
                    statusText = '✖ 期間終了';
                    statusColor = '#f87171';
                  } else {
                    statusText = '● 配信中';
                    statusColor = '#4ade80';
                  }
                }

                return (
                  <div key={ann.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{ann.title}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: statusColor }}>
                          {statusText}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        掲載期間: {startVal ? new Date(startVal).toLocaleString('ja-JP') : '即時開始'} 〜 {endVal ? new Date(endVal).toLocaleString('ja-JP') : '無期限'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => handleOpenEditModal(ann)} style={{ padding: '6px 12px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit3 size={14} />
                        <span>編集</span>
                      </button>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={14} />
                        <span>削除</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>配信中の全体告知メッセージはありません。</div>
            )}
          </div>

          {/* 共通モーダルダイアログ (新規作成 / 編集) */}
          {isAnnModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', width: '550px', maxWidth: '90vw', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {annModalMode === 'create' ? <Globe size={18} color="#0ea5e9" /> : <Edit3 size={18} color="#38bdf8" />}
                    <span>{annModalMode === 'create' ? '新規全体告知の作成' : '全体告知メッセージの編集'}</span>
                  </h3>
                  <button onClick={() => setIsAnnModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                {formError && (
                  <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '6px', fontSize: '12px' }}>
                    ⚠️ {formError}
                  </div>
                )}

                <form onSubmit={handleAnnFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '10px 14px', borderRadius: '6px', border: '1px solid #334155' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={e => setFormIsActive(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0ea5e9' }}
                      />
                      <span>📢 この全体告知を公開する (配信有効)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: formIsActive ? '#4ade80' : '#94a3b8', fontWeight: 'bold' }}>
                      {formIsActive ? '● 公開中' : '○ 非公開(下書き)'}
                    </span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>告知タイトル *</label>
                    <input
                      type="text"
                      placeholder="例: 【メンテナンス通知】サービス一時停止のお知らせ"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>重要度 (通知タイプ)</label>
                    <select
                      value={formType}
                      onChange={e => setFormType(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
                    >
                      <option value="info">通常お知らせ</option>
                      <option value="warning">重要警告</option>
                      <option value="critical">緊急告知</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>メッセージ本文 (任意)</label>
                    <textarea
                      placeholder="【任意】詳細ダイアログに表示するメッセージ本文"
                      value={formContent}
                      onChange={e => setFormContent(e.target.value)}
                      rows={3}
                      style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>📅 掲載期間の設定</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>掲載開始日時 (空欄で即時)</label>
                        <input
                          type="datetime-local"
                          value={formStartAt}
                          onChange={e => setFormStartAt(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>掲載終了日時 (空欄で無期限)</label>
                        <input
                          type="datetime-local"
                          value={formEndAt}
                          onChange={e => setFormEndAt(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsAnnModalOpen(false)}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      style={{ padding: '8px 20px', background: '#0ea5e9', border: 'none', color: '#fff', borderRadius: '6px', cursor: formSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {formSubmitting ? <Loader className="animate-spin" size={14} /> : annModalMode === 'create' ? <Plus size={15} /> : <Save size={14} />}
                      <span>{annModalMode === 'create' ? '告知を作成' : '保存する'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. 監査ログ タブ (直近7日間制限) */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '14px 18px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#60a5fa' }}>
              <Lock size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                コミュニティ版: 全社監査ログは直近 7 日間分が表示されます。GitHub スポンサー登録で過去ログが無制限解放されます。
              </span>
            </div>
            <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} />
              <span>GitHub Sponsor 解放</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', maxHeight: '450px', overflowY: 'auto' }}>
            {logLoading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}><Loader className="animate-spin" size={24} /></div>
            ) : logs.length > 0 ? (
              logs.map(log => (
                <div key={log.id} style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', fontWeight: 600 }}>
                    <span>{log.action}</span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ color: '#cbd5e1', marginTop: '4px' }}>ユーザー: {log.userName || 'System'} | IP: {log.ipAddress || 'N/A'}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>ログデータがありません。</div>
            )}
          </div>
        </div>
      )}

      {/* 3. 管理者アカウント タブ */}
      {activeTab === 'admins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        </div>
      )}
    </div>
  );
};
