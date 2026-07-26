import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Lock, LogOut, FileText, Plus, Trash2, Megaphone, ExternalLink, Loader, CheckCircle2, AlertTriangle, Sparkles
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

interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt?: string;
}

export const SaaSAdminDashboard: React.FC<SaaSAdminDashboardProps> = ({
  currentPath,
  adminSetupRequired,
  onAdminSetupComplete,
  onLogoutAdmin,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'announcements' | 'audit' | 'admins'>('announcements');
  const [token, setToken] = useState<string | null>(localStorage.getItem('cohive_admin_token'));

  // GitHub スポンサー状態
  const [isSponsored, setIsSponsored] = useState<boolean>(false);

  // アナウンスステート
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [submittingAnn, setSubmittingAnn] = useState(false);

  // 監査ログステート
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // 管理者アカウントステート
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('cohive_admin_token');
    setToken(null);
    onLogoutAdmin();
  };

  // 全体告知メッセージ取得
  const loadAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; announcements: Announcement[]; isSponsored?: boolean }>('/api/admin/announcements');
      if (res.success && Array.isArray(res.announcements)) {
        setAnnouncements(res.announcements);
        if (typeof res.isSponsored === 'boolean') {
          setIsSponsored(res.isSponsored);
        }
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
        if (data.success && Array.isArray(data.logs || data.data)) {
          setLogs(data.logs || data.data);
          if (typeof data.isSponsored === 'boolean') {
            setIsSponsored(data.isSponsored);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setLogLoading(false);
    }
  };

  // 管理者アカウント一覧取得
  const loadAdmins = async () => {
    setAdminLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; accounts: AdminAccount[]; isSponsored?: boolean }>('/api/admin/accounts');
      if (res.success && Array.isArray(res.accounts)) {
        setAdmins(res.accounts);
        if (typeof res.isSponsored === 'boolean') {
          setIsSponsored(res.isSponsored);
        }
      }
    } catch (e) {
      console.error("Failed to load admin accounts:", e);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'announcements') loadAnnouncements();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'admins') loadAdmins();
  }, [activeTab]);

  // 新規全体告知作成
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmittingAnn(true);
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
      setSubmittingAnn(false);
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

  // 新規管理者アカウント作成
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim() || !adminDisplayName.trim()) return;

    setSubmittingAdmin(true);
    setAdminError(null);

    try {
      const res = await apiClient.post<{ success: boolean; error?: string }>('/api/admin/accounts', {
        email: adminEmail,
        password: adminPassword,
        displayName: adminDisplayName,
      });

      if (res.success) {
        setAdminEmail('');
        setAdminPassword('');
        setAdminDisplayName('');
        loadAdmins();
      }
    } catch (err: any) {
      setAdminError(err.message || '管理者アカウントの追加に失敗しました。');
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm('この管理者アカウントを削除しますか？')) return;
    try {
      await apiClient.delete('/api/admin/accounts', { id });
      loadAdmins();
    } catch (e: any) {
      alert(e.message || '管理者の削除に失敗しました。');
    }
  };

  const isAnnLimitReached = !isSponsored && announcements.length >= 1;
  const isAdminLimitReached = !isSponsored && admins.length >= 1;

  return (
    <div style={{ padding: '24px 32px', color: '#f8fafc', background: '#090d16', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={28} color="#0ea5e9" />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>CoHive SaaS 管理コンソール</h2>
          {isSponsored ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
              <CheckCircle2 size={13} />
              GitHub Sponsor Pro (全機能無制限)
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#f59e0b', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
              <Lock size={12} />
              コミュニティ版 (一部機能制限あり)
            </span>
          )}
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={14} />
          <span>ログアウト</span>
        </button>
      </div>

      {/* タブナビゲーション */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
        <button 
          onClick={() => setActiveTab('announcements')} 
          style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', background: activeTab === 'announcements' ? '#0ea5e9' : '#1e293b', color: activeTab === 'announcements' ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}
        >
          <Megaphone size={16} />
          <span>全体告知管理</span>
          {!isSponsored && (
            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
              <Lock size={10} /> MAX 1件
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('audit')} 
          style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', background: activeTab === 'audit' ? '#0ea5e9' : '#1e293b', color: activeTab === 'audit' ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} />
          <span>監査ログ</span>
          {!isSponsored && (
            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
              <Lock size={10} /> 1週間分
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('admins')} 
          style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', background: activeTab === 'admins' ? '#0ea5e9' : '#1e293b', color: activeTab === 'admins' ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={16} />
          <span>管理者アカウント</span>
          {!isSponsored && (
            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
              <Lock size={10} /> MAX 1名
            </span>
          )}
        </button>
      </div>

      {/* 1. 全体告知管理 タブ (MAX 1件制限 & 掲載期間指定) */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 制限案内バッジ */}
          {!isSponsored ? (
            <div style={{ padding: '16px 20px', background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fbbf24' }}>
                <Lock size={22} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fef08a' }}>🔒 コミュニティ版 制限適用中：全体告知メッセージ MAX 1 件まで</div>
                  <div style={{ fontSize: '12px', color: '#fcd34d', marginTop: '2px' }}>
                    現在 **{announcements.length} / 1 件** 登録済みです。GitHub スポンサーに登録すると、告知メッセージを**無制限に作成・配信**できます。
                  </div>
                </div>
              </div>
              <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: '#f59e0b', color: '#0f172a', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Sparkles size={14} />
                <span>GitHub Sponsor で無制限解放</span>
                <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                GitHub Sponsor Pro: 全体告知メッセージを無制限に作成・配信可能です。
              </span>
            </div>
          )}

          {annError && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{annError}</span>
            </div>
          )}

          {/* 新規全体告知登録フォーム */}
          <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#0f172a', padding: '22px', borderRadius: '10px', border: isAnnLimitReached ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #1e293b', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>新規全体告知メッセージ作成 (掲載期間設定)</span>
                {isAnnLimitReached && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '4px', fontWeight: 700 }}>
                    🔒 制限中 (上限 1 件到達)
                  </span>
                )}
              </h3>
            </div>

            {isAnnLimitReached && (
              <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.12)', border: '1px dashed rgba(245, 158, 11, 0.4)', color: '#fcd34d', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={14} color="#f59e0b" />
                <span>コミュニティ版では告知メッセージは最大1件までです。既存の告知を削除するか、GitHubスポンサーに登録してください。</span>
              </div>
            )}

            <input 
              type="text" 
              placeholder="告知タイトル *" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              disabled={isAnnLimitReached}
              required 
              style={{ padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', opacity: isAnnLimitReached ? 0.5 : 1 }} 
            />

            <textarea 
              placeholder="告知本文（任意）" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              disabled={isAnnLimitReached}
              style={{ padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', height: '70px', resize: 'vertical', opacity: isAnnLimitReached ? 0.5 : 1 }} 
            />

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>掲載開始日時 (指定なしで即時)</label>
                <input 
                  type="datetime-local" 
                  value={startAt} 
                  onChange={e => setStartAt(e.target.value)} 
                  disabled={isAnnLimitReached}
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px', opacity: isAnnLimitReached ? 0.5 : 1 }} 
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>掲載終了日時 (指定なしで無期限)</label>
                <input 
                  type="datetime-local" 
                  value={endAt} 
                  onChange={e => setEndAt(e.target.value)} 
                  disabled={isAnnLimitReached}
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px', opacity: isAnnLimitReached ? 0.5 : 1 }} 
                />
              </div>

              <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>タイプ</label>
                <select value={type} onChange={e => setType(e.target.value)} disabled={isAnnLimitReached} style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px', opacity: isAnnLimitReached ? 0.5 : 1 }}>
                  <option value="info">通常お知らせ</option>
                  <option value="warning">重要警告</option>
                  <option value="critical">緊急告知</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submittingAnn || isAnnLimitReached} 
              style={{ 
                padding: '10px 20px', 
                background: isAnnLimitReached ? '#334155' : '#0ea5e9', 
                color: isAnnLimitReached ? '#94a3b8' : '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: (submittingAnn || isAnnLimitReached) ? 'not-allowed' : 'pointer', 
                fontWeight: 700, 
                alignSelf: 'flex-end', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              {submittingAnn ? <Loader className="animate-spin" size={16} /> : isAnnLimitReached ? <Lock size={16} color="#f59e0b" /> : <Plus size={16} />}
              <span>{isAnnLimitReached ? '🔒 スポンサー限定 (MAX 1件到達)' : '全体告知を配信'}</span>
            </button>
          </form>

          {/* 全体告知メッセージ一覧 */}
          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '14px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>登録済み全体告知メッセージ一覧</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>件数: {announcements.length} {!isSponsored && '/ 1件'}</span>
            </div>
            {annLoading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}><Loader className="animate-spin" size={24} /></div>
            ) : announcements.length > 0 ? (
              announcements.map(ann => (
                <div key={ann.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{ann.title}</div>
                    {ann.content && <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>{ann.content}</div>}
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
          {!isSponsored ? (
            <div style={{ padding: '16px 20px', background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.08) 100%)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#93c5fd' }}>
                <Lock size={22} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#dbeafe' }}>🔒 コミュニティ版 制限適用中：全社監査ログ閲覧 直近 7 日間のみ</div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe', marginTop: '2px' }}>
                    現在直近 1 週間分のみ表示されています。GitHub スポンサーに登録すると、過去ログを**全期間無制限閲覧**できます。
                  </div>
                </div>
              </div>
              <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Sparkles size={14} />
                <span>GitHub Sponsor で全期間解放</span>
                <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                GitHub Sponsor Pro: 全期間の全社監査ログが無制限閲覧可能です。
              </span>
            </div>
          )}

          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', maxHeight: '500px', overflowY: 'auto' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!isSponsored ? (
            <div style={{ padding: '16px 20px', background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#6ee7b7' }}>
                <Lock size={22} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#a7f3d0' }}>🔒 コミュニティ版 制限適用中：管理者アカウント MAX 1 名まで</div>
                  <div style={{ fontSize: '12px', color: '#6ee7b7', marginTop: '2px' }}>
                    現在 **{admins.length} / 1 名** 登録済みです。GitHub スポンサーに登録すると、副管理者を**無制限に登録・追加**できます。
                  </div>
                </div>
              </div>
              <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: '#10b981', color: '#0f172a', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Sparkles size={14} />
                <span>GitHub Sponsor で管理者無制限</span>
                <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                GitHub Sponsor Pro: 管理者アカウントを無制限に作成・管理可能です。
              </span>
            </div>
          )}

          {adminError && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{adminError}</span>
            </div>
          )}

          {/* 新規管理者登録フォーム */}
          <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#0f172a', padding: '22px', borderRadius: '10px', border: isAdminLimitReached ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #1e293b', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>新規管理者アカウントの追加</span>
                {isAdminLimitReached && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '4px', fontWeight: 700 }}>
                    🔒 制限中 (上限 1 名到達)
                  </span>
                )}
              </h3>
            </div>

            {isAdminLimitReached && (
              <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.12)', border: '1px dashed rgba(16, 185, 129, 0.4)', color: '#6ee7b7', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={14} color="#10b981" />
                <span>コミュニティ版では管理者は1名までです。GitHubスポンサーに登録すると複数管理者を解禁できます。</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="管理者表示名 *" 
                value={adminDisplayName} 
                onChange={e => setAdminDisplayName(e.target.value)} 
                disabled={isAdminLimitReached}
                required 
                style={{ flex: 1, minWidth: '180px', padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', opacity: isAdminLimitReached ? 0.5 : 1 }} 
              />
              <input 
                type="email" 
                placeholder="メールアドレス *" 
                value={adminEmail} 
                onChange={e => setAdminEmail(e.target.value)} 
                disabled={isAdminLimitReached}
                required 
                style={{ flex: 1, minWidth: '220px', padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', opacity: isAdminLimitReached ? 0.5 : 1 }} 
              />
              <input 
                type="password" 
                placeholder="パスワード *" 
                value={adminPassword} 
                onChange={e => setAdminPassword(e.target.value)} 
                disabled={isAdminLimitReached}
                required 
                style={{ flex: 1, minWidth: '180px', padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', opacity: isAdminLimitReached ? 0.5 : 1 }} 
              />
            </div>

            <button 
              type="submit" 
              disabled={submittingAdmin || isAdminLimitReached} 
              style={{ 
                padding: '10px 20px', 
                background: isAdminLimitReached ? '#334155' : '#0ea5e9', 
                color: isAdminLimitReached ? '#94a3b8' : '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: (submittingAdmin || isAdminLimitReached) ? 'not-allowed' : 'pointer', 
                fontWeight: 700, 
                alignSelf: 'flex-end', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              {submittingAdmin ? <Loader className="animate-spin" size={16} /> : isAdminLimitReached ? <Lock size={16} color="#f59e0b" /> : <Plus size={16} />}
              <span>{isAdminLimitReached ? '🔒 スポンサー限定 (MAX 1名到達)' : '管理者を追加'}</span>
            </button>
          </form>

          {/* 管理者一覧 */}
          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '14px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>登録済み管理者アカウント一覧</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>人数: {admins.length} {!isSponsored && '/ 1名'}</span>
            </div>
            {adminLoading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}><Loader className="animate-spin" size={24} /></div>
            ) : admins.length > 0 ? (
              admins.map(adm => (
                <div key={adm.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{adm.displayName}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: adm.role === 'owner' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(148, 163, 184, 0.2)', color: adm.role === 'owner' ? '#38bdf8' : '#cbd5e1' }}>
                        {adm.role === 'owner' ? 'オーナー' : '管理者'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {adm.email} {adm.createdAt && `| 作成日: ${new Date(adm.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  {adm.role !== 'owner' && (
                    <button onClick={() => handleDeleteAdmin(adm.id)} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Trash2 size={14} />
                      <span>削除</span>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>管理者アカウントが存在しません。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
