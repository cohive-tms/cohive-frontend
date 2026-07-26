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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // 新規全体告知作成
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setAnnError(null);

    try {
      const res = await apiClient.post<{ success: boolean; error?: string }>('/api/admin/announcements', {
        title,
        content,
        type,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      });

      if (res.success) {
        setTitle('');
        setContent('');
        setStartAt('');
        setEndAt('');
        loadAnnouncements();
      }
    } catch (err: any) {
      setAnnError(err.message || '全体告知メッセージの登録に失敗しました。');
    } finally {
      setSubmitting(false);
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

      {/* 1. 全体告知管理 タブ (MAX 1件制限 & 掲載期間指定) */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 制限案内バッジ (未スポンサー時) */}
          <div style={{ padding: '14px 18px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b' }}>
              <Lock size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                コミュニティ版: 全体告知メッセージは最大 1 件まで登録可能です（現在 {announcements.length} / 1 件）。GitHub スポンサー登録で無制限作成できます。
              </span>
            </div>
            <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', background: '#f59e0b', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} />
              <span>GitHub Sponsor 解放</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {annError && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} />
              <span>{annError}</span>
            </div>
          )}

          {/* 新規全体告知登録フォーム */}
          <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#38bdf8' }}>新規全体告知メッセージ作成 (掲載期間設定)</h3>
              {isAnnLimitReached && (
                <span style={{ fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={14} />
                  <span>登録上限到達 (MAX 1件)</span>
                </span>
              )}
            </div>

            <input 
              type="text" 
              placeholder="告知タイトル *" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px' }} 
            />

            <textarea 
              placeholder="告知本文（任意）" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', height: '70px', resize: 'vertical' }} 
            />

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>掲載開始日時 (指定なしで即時)</label>
                <input 
                  type="datetime-local" 
                  value={startAt} 
                  onChange={e => setStartAt(e.target.value)} 
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px' }} 
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>掲載終了日時 (指定なしで無期限)</label>
                <input 
                  type="datetime-local" 
                  value={endAt} 
                  onChange={e => setEndAt(e.target.value)} 
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px' }} 
                />
              </div>

              <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>タイプ</label>
                <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px' }}>
                  <option value="info">通常お知らせ</option>
                  <option value="warning">重要警告</option>
                  <option value="critical">緊急告知</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              style={{ 
                padding: '10px 20px', 
                background: isAnnLimitReached ? '#334155' : '#0ea5e9', 
                color: isAnnLimitReached ? '#94a3b8' : '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: submitting ? 'not-allowed' : 'pointer', 
                fontWeight: 700, 
                alignSelf: 'flex-end', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              {submitting ? <Loader className="animate-spin" size={16} /> : isAnnLimitReached ? <Lock size={16} color="#f59e0b" /> : <Plus size={16} />}
              <span>{isAnnLimitReached ? '全体告知を登録 (スポンサー限定)' : '全体告知を配信'}</span>
            </button>
          </form>

          {/* 全体告知メッセージ一覧 */}
          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '14px', color: '#94a3b8' }}>
              登録済み全体告知メッセージ一覧
            </div>
            {annLoading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}><Loader className="animate-spin" size={24} /></div>
            ) : announcements.length > 0 ? (
              announcements.map(ann => (
                <div key={ann.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{ann.title}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      掲載期間: {ann.startAt ? new Date(ann.startAt).toLocaleString() : '即時開始'} 〜 {ann.endAt ? new Date(ann.endAt).toLocaleString() : '無期限'}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteAnnouncement(ann.id)} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Trash2 size={14} />
                    <span>削除</span>
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>配信中の全体告知メッセージはありません。</div>
            )}
          </div>
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

      {/* 3. 管理者アカウント タブ (MAX 1名制限) */}
      {activeTab === 'admins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '14px 18px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399' }}>
              <Lock size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                コミュニティ版: 管理者アカウントは最大 1 名まで設定可能です。GitHub スポンサー登録で複数管理者を解禁できます。
              </span>
            </div>
            <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', background: '#10b981', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} />
              <span>GitHub Sponsor 解放</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
