import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Lock, LogOut, FileText, Plus, Trash2, Megaphone, ExternalLink, Loader, CheckCircle2, AlertTriangle, Sparkles, Edit3, X, Calendar, Clock
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

  // 編集モーダルステート
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState('info');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

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

  // 告知編集モーダルを開く
  const openEditModal = (ann: Announcement) => {
    setEditingAnn(ann);
    setEditTitle(ann.title);
    setEditContent(ann.content || '');
    setEditType(ann.type || 'info');
    const formatForInput = (isoStr?: string | null) => {
      if (!isoStr) return '';
      try {
        const d = new Date(isoStr);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return '';
      }
    };
    setEditStartAt(formatForInput(ann.startAt));
    setEditEndAt(formatForInput(ann.endAt));
  };

  // 告知更新実行
  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnn || !editTitle.trim()) return;

    setSubmittingEdit(true);
    try {
      const res = await apiClient.put<{ success: boolean; error?: string }>(`/api/admin/announcements/${editingAnn.id}`, {
        title: editTitle,
        content: editContent,
        type: editType,
        startAt: editStartAt ? new Date(editStartAt).toISOString() : null,
        endAt: editEndAt ? new Date(editEndAt).toISOString() : null,
      });

      if (res.success) {
        setEditingAnn(null);
        loadAnnouncements();
      }
    } catch (err: any) {
      alert(err.message || '告知の更新に失敗しました。');
    } finally {
      setSubmittingEdit(false);
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

  // 掲載状態判定ヘルパー
  const getAnnouncementStatus = (ann: Announcement) => {
    if (!ann.isActive) return { label: '非アクティブ', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.2)' };
    const now = new Date();
    const start = ann.startAt ? new Date(ann.startAt) : null;
    const end = ann.endAt ? new Date(ann.endAt) : null;

    if (start && now < start) {
      return { label: '掲載予約中', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.2)' };
    }
    if (end && now > end) {
      return { label: '掲載終了 (期限切れ)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' };
    }
    return { label: '配信中', color: '#34d399', bg: 'rgba(16, 185, 129, 0.2)' };
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Shield size={28} color="#0ea5e9" />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>CoHive SaaS 管理コンソール</h2>
          
          {/* スポンサー状態バッジ（常時視認性を確保） */}
          {isSponsored ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
              <CheckCircle2 size={14} />
              GitHub Sponsor Pro (全機能無制限解放中)
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.5)', color: '#fbbf24', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
              <Lock size={14} color="#f59e0b" />
              🔒 コミュニティ版 (一部機能制限あり)
            </span>
          )}
        </div>

        <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={14} />
          <span>ログアウト</span>
        </button>
      </div>

      {/* タブナビゲーション (常時鍵マーク🔒テキストを表示) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #1e293b', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('announcements')} 
          style={{ padding: '10px 20px', borderRadius: '8px', border: activeTab === 'announcements' ? '1px solid #0ea5e9' : '1px solid #334155', background: activeTab === 'announcements' ? '#0ea5e9' : '#0f172a', color: activeTab === 'announcements' ? '#fff' : '#cbd5e1', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Megaphone size={16} />
          <span>📢 全体告知管理</span>
          {!isSponsored && (
            <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(245, 158, 11, 0.25)', color: '#fef08a', border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}>
              🔒 MAX 1件
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('audit')} 
          style={{ padding: '10px 20px', borderRadius: '8px', border: activeTab === 'audit' ? '1px solid #0ea5e9' : '1px solid #334155', background: activeTab === 'audit' ? '#0ea5e9' : '#0f172a', color: activeTab === 'audit' ? '#fff' : '#cbd5e1', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} />
          <span>📄 監査ログ</span>
          {!isSponsored && (
            <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.25)', color: '#bfdbfe', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}>
              🔒 直近1週間
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('admins')} 
          style={{ padding: '10px 20px', borderRadius: '8px', border: activeTab === 'admins' ? '1px solid #0ea5e9' : '1px solid #334155', background: activeTab === 'admins' ? '#0ea5e9' : '#0f172a', color: activeTab === 'admins' ? '#fff' : '#cbd5e1', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={16} />
          <span>👥 管理者アカウント</span>
          {!isSponsored && (
            <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', border: '1px solid rgba(16, 185, 129, 0.5)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}>
              🔒 MAX 1名
            </span>
          )}
        </button>
      </div>

      {/* 1. 全体告知管理 タブ (MAX 1件制限 & 掲載期間指定) */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 制限案内バッジ (未スポンサー時に常時カード表示) */}
          {!isSponsored ? (
            <div style={{ padding: '18px 22px', background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.1) 100%)', border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#fbbf24' }}>
                <Lock size={26} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔒 コミュニティ版 制限適用中：全体告知メッセージ MAX 1 件まで</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#fcd34d', marginTop: '4px', lineHeight: 1.4 }}>
                    現在 **{announcements.length} / 1 件** 使用中。GitHub スポンサーに登録すると、告知メッセージを**無制限に作成・配信**できます。
                  </div>
                </div>
              </div>
              <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '9px 18px', background: '#f59e0b', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)' }}>
                <Sparkles size={15} />
                <span>🔒 GitHub Sponsor で無制限解放</span>
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
          <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#0f172a', padding: '22px', borderRadius: '10px', border: isAnnLimitReached ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid #1e293b', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>新規全体告知メッセージ作成 (掲載期間設定)</span>
                {!isSponsored && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', background: isAnnLimitReached ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.2)', color: isAnnLimitReached ? '#fca5a5' : '#fbbf24', border: isAnnLimitReached ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '4px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> {isAnnLimitReached ? '🔒 制限中 (上限 1 件到達)' : '🔒 コミュニティ制限: MAX 1件'}
                  </span>
                )}
              </h3>
            </div>

            {isAnnLimitReached && (
              <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.15)', border: '1px dashed rgba(245, 158, 11, 0.5)', color: '#fef08a', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                <Lock size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span>🔒 コミュニティ版では告知メッセージは最大1件までです。登録済みの告知を削除するか、GitHubスポンサーに登録してください。</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    <span>掲載開始日時 (指定なしで即時配信)</span>
                  </label>
                  {startAt && (
                    <button type="button" onClick={() => setStartAt('')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0 }}>クリア</button>
                  )}
                </div>
                <input 
                  type="datetime-local" 
                  value={startAt} 
                  onChange={e => setStartAt(e.target.value)} 
                  disabled={isAnnLimitReached}
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px', opacity: isAnnLimitReached ? 0.5 : 1 }} 
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>掲載終了日時 (任意・指定なしで無期限)</span>
                  </label>
                  {endAt && (
                    <button type="button" onClick={() => setEndAt('')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0 }}>無期限にする</button>
                  )}
                </div>
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

          {/* 全体告知メッセージ一覧 (掲載期間表示・編集機能付き) */}
          <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', fontWeight: 700, fontSize: '14px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>登録済み全体告知メッセージ一覧</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>件数: {announcements.length} {!isSponsored && '/ 1件'}</span>
            </div>
            {annLoading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}><Loader className="animate-spin" size={24} /></div>
            ) : announcements.length > 0 ? (
              announcements.map(ann => {
                const status = getAnnouncementStatus(ann);
                return (
                  <div key={ann.id} style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>{ann.title}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: status.bg, color: status.color, fontWeight: 700 }}>
                          {status.label}
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(51, 65, 85, 0.5)', color: '#94a3b8' }}>
                          タイプ: {ann.type === 'critical' ? '緊急' : ann.type === 'warning' ? '警告' : '通常'}
                        </span>
                      </div>

                      {ann.content && <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{ann.content}</div>}

                      {/* 掲載期間のわかりやすい表示 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#38bdf8', marginTop: '10px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 12px', borderRadius: '6px', width: 'fit-content', border: '1px solid #1e293b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} />
                          <span>開始: {ann.startAt ? new Date(ann.startAt).toLocaleString('ja-JP') : '即時開始'}</span>
                        </span>
                        <span>〜</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} />
                          <span>終了: {ann.endAt ? new Date(ann.endAt).toLocaleString('ja-JP') : '無期限'}</span>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openEditModal(ann)} style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Edit3 size={14} />
                        <span>掲載期間・内容編集</span>
                      </button>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
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
        </div>
      )}

      {/* 告知編集モーダル */}
      {editingAnn && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <form onSubmit={handleUpdateAnnouncement} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} />
                <span>全体告知アイテムの編集 (掲載期間設定)</span>
              </h3>
              <button type="button" onClick={() => setEditingAnn(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>告知タイトル *</label>
              <input 
                type="text" 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)} 
                required 
                style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px' }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>告知本文</label>
              <textarea 
                value={editContent} 
                onChange={e => setEditContent(e.target.value)} 
                style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', height: '80px', resize: 'vertical' }} 
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} />
                    <span>掲載開始日時 (指定なしで即時)</span>
                  </label>
                  {editStartAt && (
                    <button type="button" onClick={() => setEditStartAt('')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0 }}>即時にする</button>
                  )}
                </div>
                <input 
                  type="datetime-local" 
                  value={editStartAt} 
                  onChange={e => setEditStartAt(e.target.value)} 
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px' }} 
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} />
                    <span>掲載終了日時 (任意・指定なしで無期限)</span>
                  </label>
                  {editEndAt && (
                    <button type="button" onClick={() => setEditEndAt('')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0 }}>無期限にする</button>
                  )}
                </div>
                <input 
                  type="datetime-local" 
                  value={editEndAt} 
                  onChange={e => setEditEndAt(e.target.value)} 
                  style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px' }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>お知らせタイプ</label>
              <select value={editType} onChange={e => setEditType(e.target.value)} style={{ padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '12px' }}>
                <option value="info">通常お知らせ</option>
                <option value="warning">重要警告</option>
                <option value="critical">緊急告知</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setEditingAnn(null)} style={{ padding: '8px 16px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                キャンセル
              </button>
              <button type="submit" disabled={submittingEdit} style={{ padding: '8px 20px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: submittingEdit ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {submittingEdit ? <Loader className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                <span>変更内容を保存</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. 監査ログ タブ (直近7日間制限) */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isSponsored ? (
            <div style={{ padding: '16px 20px', background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.18) 0%, rgba(37, 99, 235, 0.1) 100%)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#93c5fd' }}>
                <Lock size={26} color="#3b82f6" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#dbeafe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔒 コミュニティ版 制限適用中：全社監査ログ閲覧 直近 7 日間のみ</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#bfdbfe', marginTop: '4px', lineHeight: 1.4 }}>
                    現在直近 1 週間分のみ表示されています。GitHub スポンサーに登録すると、過去ログを**全期間無制限閲覧**できます。
                  </div>
                </div>
              </div>
              <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '9px 18px', background: '#3b82f6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)' }}>
                <Sparkles size={15} />
                <span>🔒 GitHub Sponsor で全期間解放</span>
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
            <div style={{ padding: '18px 22px', background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.5)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#6ee7b7' }}>
                <Lock size={26} color="#10b981" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔒 コミュニティ版 制限適用中：管理者アカウント MAX 1 名まで</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#6ee7b7', marginTop: '4px', lineHeight: 1.4 }}>
                    現在 **{admins.length} / 1 名** 使用中。GitHub スポンサーに登録すると、副管理者を**無制限に登録・追加**できます。
                  </div>
                </div>
              </div>
              <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" style={{ padding: '9px 18px', background: '#10b981', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)' }}>
                <Sparkles size={15} />
                <span>🔒 GitHub Sponsor で管理者無制限</span>
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
          <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#0f172a', padding: '22px', borderRadius: '10px', border: isAdminLimitReached ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid #1e293b', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>新規管理者アカウントの追加</span>
                {!isSponsored && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', background: isAdminLimitReached ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.2)', color: isAdminLimitReached ? '#fca5a5' : '#34d399', border: isAdminLimitReached ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '4px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> {isAdminLimitReached ? '🔒 制限中 (上限 1 名到達)' : '🔒 コミュニティ制限: MAX 1名'}
                  </span>
                )}
              </h3>
            </div>

            {isAdminLimitReached && (
              <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px dashed rgba(16, 185, 129, 0.5)', color: '#a7f3d0', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                <Lock size={16} color="#10b981" style={{ flexShrink: 0 }} />
                <span>🔒 コミュニティ版では管理者は1名までです。GitHubスポンサーに登録すると複数管理者を解禁できます。</span>
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
