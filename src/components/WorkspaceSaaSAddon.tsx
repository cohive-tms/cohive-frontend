import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle, ExternalLink, Download, CreditCard, FileText, Megaphone, Plus, Trash2, Calendar, Lock } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

const ENABLE_STRIPE_FEATURE = false;

interface PublicPlan {
  id: string;
  name: string;
  member_limit: number;
  channel_limit: number;
  storage_limit: number;
  allowed_extensions?: string;
  msg_retention_days?: number;
  msg_retention_count?: number;
  price_amount: number;
  price_currency: string;
}

interface WorkspaceAuditLog {
  id: string;
  workspace_id: string;
  userName: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
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

interface SubscriptionData {
  plan: string;
  storageLimit: number;
  storageUsed: number;
  memberLimit: number;
  memberUsed: number;
  channelLimit: number;
  channelUsed: number;
  dmEnabled?: boolean;
  mediaEnabled?: boolean;
  allowedExtensions?: string;
  msgRetentionDays?: number;
  msgRetentionCount?: number;
  stripeEnabled?: boolean;
  stripePublishableKey?: string;
  stripeSubscriptionId?: string;
  status?: string;
}

interface WorkspaceSaaSAddonProps {
  workspaceId: string;
  workspaceName: string;
  currentUserRole: 'owner' | 'group_admin' | 'member' | 'guest';
  subscription?: SubscriptionData | null;
  onRefreshSubscription?: () => void;
}

// -----------------------------------------------------------------------------
// 1. サブスクリプション(プラン & 制限)タブ
// -----------------------------------------------------------------------------
export const WorkspaceSubscriptionTab: React.FC<WorkspaceSaaSAddonProps> = ({
  workspaceId,
  workspaceName,
  currentUserRole,
  subscription,
  onRefreshSubscription
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';
  const isOwner = currentUserRole === 'owner';

  const [publicPlans, setPublicPlans] = useState<PublicPlan[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    const loadPublicPlans = async () => {
      try {
        const res = await fetch('/api/plans');
        if (res.ok) {
          const data = await res.json() as any;
          if (data.success) setPublicPlans(data.plans);
        }
      } catch (e) {
        console.error("Failed to load public plans:", e);
      }
    };
    loadPublicPlans();
  }, []);

  if (!subscription) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px 0' }}>現在のプラン: {subscription.plan || 'Free Community'}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          {isEn ? 'Basic resources and admin features are unlimited for self-host. Historical audit logs over 7 days are unlocked via GitHub Sponsor.' : 'セルフホスト環境のため基本機能・管理者機能は完全無料・無制限です。全期間の過去監査ログ表示のみ GitHub スポンサー登録で解放されます。'}
        </p>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2. 自社監査ログタブ 🔒
// -----------------------------------------------------------------------------
export const WorkspaceAuditLogsTab: React.FC<WorkspaceSaaSAddonProps> = ({
  workspaceId,
  workspaceName
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  const [auditLogs, setAuditLogs] = useState<WorkspaceAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; logs: WorkspaceAuditLog[] }>(
        `/api/workspaces/${workspaceId}/audit-logs`
      );
      if (res.success && Array.isArray(res.logs)) {
        setAuditLogs(res.logs);
      }
    } catch (e) {
      console.error("Failed to load workspace audit logs:", e);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [workspaceId]);

  const handleExportWorkspaceAuditLogs = () => {
    if (auditLogs.length === 0) return;
    const headersLine = ["ID", "User Name", "Action", "Details", "IP Address", "Created At"];
    const rows = filteredAuditLogs.map(log => [
      log.id,
      log.userName || "System",
      log.action,
      typeof log.details === 'string' ? log.details.replace(/"/g, '""') : JSON.stringify(log.details),
      log.ip_address || "",
      log.created_at
    ]);

    const csvContent = "\uFEFF" + [
      headersLine.join(","),
      ...rows.map(e => e.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${workspaceName || 'ws'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const textMatch = 
      (log.action?.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
      (log.userName?.toLowerCase().includes(auditSearchQuery.toLowerCase()));

    const actionMatch = auditActionFilter ? log.action === auditActionFilter : true;
    return textMatch && actionMatch;
  });

  return (
    <div className="settings-form-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 🔒 鍵マーク & 7日間制限案内バッジ */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} color="#3b82f6" />
          <span>
            {isEn
              ? 'Community Edition: Audit logs are retained for 7 days. Upgrade via GitHub Sponsor to unlock full history.'
              : 'コミュニティ版: 監査ログは直近7日間分が表示されます。GitHub スポンサー登録で全期間の過去ログが無制限解放されます。'}
          </span>
        </div>
        <a 
          href="https://github.com/sponsors" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            padding: '6px 12px',
            background: 'var(--accent-color, #3b82f6)',
            color: '#fff',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Lock size={12} />
          <span>GitHub Sponsor 解放</span>
          <ExternalLink size={12} />
        </a>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>自社監査ログ</h3>
        <button onClick={handleExportWorkspaceAuditLogs} disabled={filteredAuditLogs.length === 0} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', borderRadius: '4px', fontSize: '11px', cursor: filteredAuditLogs.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Download size={12} />
          <span>CSV出力</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="ユーザー、アクションで検索..." 
          value={auditSearchQuery} 
          onChange={(e) => setAuditSearchQuery(e.target.value)} 
          className="form-input"
          style={{ flex: 1, fontSize: '12px' }}
        />
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
        {auditLoading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}><Loader className="animate-spin" size={20} /></div>
        ) : filteredAuditLogs.length > 0 ? (
          filteredAuditLogs.map(log => (
            <div key={log.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-color, #3b82f6)' }}>{log.action}</span>
                <span style={{ color: 'var(--text-muted)' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>{log.userName || 'System'} ({log.ip_address || 'IP N/A'})</div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>ログがありません。</div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3. 一斉送信お知らせ/全体告知タブ 🔒 (掲載期間 startAt / endAt 設定対応)
// -----------------------------------------------------------------------------
export const WorkspaceAnnouncementsTab: React.FC<WorkspaceSaaSAddonProps> = () => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 共通モーダルステート（新規作成 / 編集）
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

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; announcements: Announcement[] }>('/api/admin/announcements');
      if (res.success && Array.isArray(res.announcements)) {
        setAnnouncements(res.announcements);
      }
    } catch (e) {
      console.error("Failed to load admin announcements:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

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
  };lient.put<{ success: boolean; error?: string }>(`/api/admin/announcements/${editingAnnouncement.id}`, {
        title: editTitle,
        content: editContent,
        type: editType,
        startAt: finalStartAt,
        endAt: finalEndAt,
      });

      if (res.success) {
        setEditingAnnouncement(null);
        loadAnnouncements();
      }
    } catch (err: any) {
      alert(err.message || '全体告知メッセージの更新に失敗しました。');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この告知メッセージを削除しますか？')) return;
    try {
      await apiClient.delete(`/api/admin/announcements/${id}`);
      loadAnnouncements();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {errorMsg && (
        <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ヘッダーおよび新規告知作成ボタン */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>登録済み全体告知メッセージ一覧</h4>
        <button 
          onClick={handleOpenCreateModal}
          style={{ 
            padding: '6px 14px', 
            fontSize: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            background: 'var(--accent-color)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <Plus size={14} />
          <span>+ 新規告知を配信</span>
        </button>
      </div>

      {/* お知らせ一覧 */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}><Loader className="animate-spin" size={20} /></div>
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
              <div key={ann.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{ann.title}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: statusColor }}>
                      {statusText}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    掲載期間: {startVal ? new Date(startVal).toLocaleString('ja-JP') : '即時'} 〜 {endVal ? new Date(endVal).toLocaleString('ja-JP') : '無期限'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => handleOpenEditModal(ann)} style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Edit3 size={12} />
                    <span>編集</span>
                  </button>
                  <button onClick={() => handleDelete(ann.id)} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Trash2 size={12} />
                    <span>削除</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>登録されている全体告知メッセージはありません。</div>
        )}
      </div>

      {/* 共通モーダル (新規作成 / 編集) */}
      {isAnnModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '10px', width: '500px', maxWidth: '90vw', padding: '20px', boxShadow: '0 15px 25px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {annModalMode === 'create' ? <Globe size={16} color="var(--accent-color)" /> : <Edit3 size={16} color="var(--accent-color)" />}
                <span>{annModalMode === 'create' ? '新規全体告知作成' : '全体告知メッセージの編集'}</span>
              </h4>
              <button onClick={() => setIsAnnModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '12px' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleAnnFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>📢 この全体告知を公開する (配信有効)</span>
                </label>
                <span style={{ fontSize: '10px', color: formIsActive ? '#4ade80' : 'var(--text-muted)', fontWeight: 'bold' }}>
                  {formIsActive ? '● 公開中' : '○ 非公開(下書き)'}
                </span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: 'var(--text-muted)' }}>告知タイトル *</label>
                <input
                  type="text"
                  placeholder="例: 【重要】サービスメンテナンスのお知らせ"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: 'var(--text-muted)' }}>タイプ</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="info">通常</option>
                  <option value="warning">警告</option>
                  <option value="critical">緊急</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: 'var(--text-muted)' }}>告知本文 (任意)</label>
                <textarea
                  placeholder="詳細メッセージ"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px', height: '60px', resize: 'vertical' }}
                />
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-color)' }}>📅 掲載期間の設定</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>開始日時 (空欄で即時)</label>
                    <input
                      type="datetime-local"
                      value={formStartAt}
                      onChange={e => setFormStartAt(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>終了日時 (空欄で無期限)</label>
                    <input
                      type="datetime-local"
                      value={formEndAt}
                      onChange={e => setFormEndAt(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', fontSize: '11px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsAnnModalOpen(false)}
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="submit-btn"
                  style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {formSubmitting ? <Loader className="animate-spin" size={12} /> : annModalMode === 'create' ? <Plus size={14} /> : <Save size={12} />}
                  <span>{annModalMode === 'create' ? '告知を配信' : '保存する'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
