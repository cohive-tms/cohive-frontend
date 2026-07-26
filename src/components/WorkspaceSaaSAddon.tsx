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
          {isEn ? 'Basic resources are unlimited for self-host. Sponsor features unlocked via GitHub Sponsor.' : 'セルフホスト環境のため基本データ容量は完全無料・無制限です。🔒 マークの限定機能は GitHub スポンサー登録で解放されます。'}
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

  // フォームステート
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);

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
      setErrorMsg(err.message || '全体告知メッセージの追加に失敗しました。');
    } finally {
      setSubmitting(false);
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

  const isAnnLimitReached = announcements.length >= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 🔒 1件制限バッジ */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} color="#f59e0b" />
          <span>
            {isEn
              ? 'Community Edition: Max 1 active announcement allowed. Upgrade via GitHub Sponsor for unlimited announcements.'
              : 'コミュニティ版: 全体告知メッセージの同時登録は最大 1 件までです。GitHub スポンサー登録で無制限作成できます。'}
          </span>
        </div>
        <a 
          href="https://github.com/sponsors" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            padding: '6px 12px',
            background: '#f59e0b',
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

      {errorMsg && (
        <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 新規登録フォーム (掲載期間設定付き) */}
      <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>新規全体告知作成 (掲載期間設定)</h4>
          {isAnnLimitReached && (
            <span style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} />
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
          className="form-input" 
          style={{ fontSize: '12px' }} 
        />

        <textarea 
          placeholder="告知本文 (任意)" 
          value={content} 
          onChange={e => setContent(e.target.value)} 
          className="form-input" 
          style={{ fontSize: '12px', height: '60px', resize: 'vertical' }} 
        />

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>掲載開始日時 (指定なしで即時)</label>
            <input 
              type="datetime-local" 
              value={startAt} 
              onChange={e => setStartAt(e.target.value)} 
              className="form-input" 
              style={{ fontSize: '11px' }} 
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>掲載終了日時 (指定なしで無期限)</label>
            <input 
              type="datetime-local" 
              value={endAt} 
              onChange={e => setEndAt(e.target.value)} 
              className="form-input" 
              style={{ fontSize: '11px' }} 
            />
          </div>
          <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>タイプ</label>
            <select value={type} onChange={e => setType(e.target.value)} className="form-input" style={{ fontSize: '11px' }}>
              <option value="info">通常</option>
              <option value="warning">警告</option>
              <option value="critical">緊急</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting} 
          className="submit-btn" 
          style={{ 
            padding: '8px 16px', 
            fontSize: '12px', 
            alignSelf: 'flex-end', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            background: isAnnLimitReached ? 'var(--bg-tertiary)' : undefined,
            color: isAnnLimitReached ? 'var(--text-muted)' : undefined
          }}
        >
          {submitting ? <Loader className="animate-spin" size={14} /> : isAnnLimitReached ? <Lock size={14} color="#f59e0b" /> : <Plus size={14} />}
          <span>{isAnnLimitReached ? '全体告知を登録 (スポンサー限定)' : '全体告知を配信'}</span>
        </button>
      </form>

      {/* お知らせ一覧 */}
      <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}><Loader className="animate-spin" size={20} /></div>
        ) : announcements.length > 0 ? (
          announcements.map(ann => (
            <div key={ann.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{ann.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  掲載期間: {ann.startAt ? new Date(ann.startAt).toLocaleString() : '即時'} 〜 {ann.endAt ? new Date(ann.endAt).toLocaleString() : '無期限'}
                </div>
              </div>
              <button onClick={() => handleDelete(ann.id)} style={{ padding: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>登録されている全体告知メッセージはありません。</div>
        )}
      </div>
    </div>
  );
};
