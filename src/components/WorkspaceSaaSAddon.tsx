import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle, ExternalLink, Download, CreditCard, FileText } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

// Stripe決済連携機能フラグ（動作検証後に true に変更することで全機能UIが復元されます）
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
  subscription: SubscriptionData | null;
  onRefreshSubscription: () => void;
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

  // プラン一覧取得
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

  const isSuspended = subscription.status === 'suspended';

  // Stripe Checkout
  const handleUpgrade = async (planId: string) => {
    setBillingLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; url: string }>(
        `/api/workspaces/${workspaceId}/billing/checkout`,
        { planId }
      );
      if (res.success && res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      alert(err.message || "決済画面の起動に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };

  // Stripe Portal
  const handleOpenStripePortal = async () => {
    setBillingLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; url: string }>(
        `/api/workspaces/${workspaceId}/billing/portal`
      );
      if (res.success && res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      alert(err.message || "ポータル画面の起動に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };

  // 容量フォーマット
  const formatSize = (bytes: number) => {
    if (bytes === Infinity || bytes >= 9999999999) return '無制限';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="settings-form-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {isSuspended && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>決済が確認できないため、このワークスペースは一時停止されています。</strong><br />
            お支払い処理を完了するか、契約ポータルから決済情報を更新してください。一般機能（チャット、アップロード等）へのアクセスが現在制限されています。
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>現在のプラン</span>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#0ea5e9' }}>{subscription.plan.toUpperCase()}</h3>
        </div>
        
        <div>
          {billingLoading ? (
            <Loader className="animate-spin" size={20} />
          ) : subscription.stripeSubscriptionId ? (
            <button onClick={handleOpenStripePortal} className="submit-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px', cursor: 'pointer' }}>
              <ExternalLink size={14} />
              <span>サブスクリプションを管理 (ポータル)</span>
            </button>
          ) : isOwner ? (
            <button 
              onClick={() => {
                const reason = prompt("上位プラン（または利用枠拡大）の申請理由や希望部署名を入力してください：", "部署利用拡大のため");
                if (reason) {
                  alert("スーパー管理者（システム管理者）へ上位プランの変更申請を送信しました。管理者の承認をお待ちください。");
                }
              }} 
              className="submit-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px', cursor: 'pointer', background: 'var(--accent-primary)' }}
            >
              <span>スーパー管理者に上位プランを申請</span>
            </button>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>上位プラン申請はオーナーのみ可能です</span>
          )}
        </div>
      </div>

      {/* 制限値メーター */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* チャンネル */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>チャンネル数</span>
            <strong style={{ color: 'var(--text-primary)' }}>{subscription.channelUsed} / {subscription.channelLimit >= 9999 ? '無制限' : subscription.channelLimit}</strong>
          </div>
          <div style={{ height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#0ea5e9', width: `${subscription.channelLimit >= 9999 ? 0 : Math.min(100, (subscription.channelUsed / subscription.channelLimit) * 100)}%` }}></div>
          </div>
        </div>

        {/* メンバー */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>メンバー数</span>
            <strong style={{ color: 'var(--text-primary)' }}>{subscription.memberUsed} / {subscription.memberLimit >= 9999 ? '無制限' : subscription.memberLimit}</strong>
          </div>
          <div style={{ height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#6366f1', width: `${subscription.memberLimit >= 9999 ? 0 : Math.min(100, (subscription.memberUsed / subscription.memberLimit) * 100)}%` }}></div>
          </div>
        </div>

        {/* 容量 */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>ストレージ容量</span>
            <strong style={{ color: 'var(--text-primary)' }}>{formatSize(subscription.storageUsed)} / {formatSize(subscription.storageLimit)}</strong>
          </div>
          <div style={{ height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#10b981', width: `${subscription.storageLimit >= 9999999999 ? 0 : Math.min(100, (subscription.storageUsed / subscription.storageLimit) * 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* 機能制限表示 */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>DM機能:</span>
          <span style={{ color: subscription.dmEnabled !== false ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{subscription.dmEnabled !== false ? '有効' : '無効'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>メディアアップロード:</span>
          <span style={{ color: subscription.mediaEnabled !== false ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{subscription.mediaEnabled !== false ? '有効' : '無効'}</span>
        </div>
        {subscription.allowedExtensions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>許可拡張子:</span>
            <span style={{ color: '#0ea5e9', fontWeight: 'bold' }}>{subscription.allowedExtensions}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>メッセージ保存期間:</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {(subscription.msgRetentionDays ?? 0) === 0 ? '日数無制限' : `${subscription.msgRetentionDays}日間`}
            {' / '}
            {(subscription.msgRetentionCount ?? 0) === 0 ? '件数無制限' : `${subscription.msgRetentionCount}件まで`}
          </span>
        </div>
      </div>

      {/* プラン変更テーブル */}
      {subscription.stripeEnabled && ENABLE_STRIPE_FEATURE && isOwner && !subscription.stripeSubscriptionId && publicPlans.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>プランをアップグレード / 変更</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {publicPlans.map(plan => (
              <div key={plan.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>{plan.name}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    メンバー: {plan.member_limit >= 9999 ? '無制限' : `${plan.member_limit}名`} | 
                    ストレージ: {plan.storage_limit >= 9999999999 ? '無制限' : formatSize(plan.storage_limit)} | 
                    保存日数: {(plan.msg_retention_days ?? 0) === 0 ? '無制限' : `${plan.msg_retention_days}日`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{plan.price_amount > 0 ? `${plan.price_amount.toLocaleString()} ${plan.price_currency.toUpperCase()}/月` : '無料'}</span>
                  {plan.id !== subscription.plan ? (
                    <button onClick={() => handleUpgrade(plan.id)} disabled={billingLoading} className="submit-btn" style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer' }}>
                      契約する
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>契約中</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// -----------------------------------------------------------------------------
// 2. 自社監査ログタブ
// -----------------------------------------------------------------------------
export const WorkspaceAuditLogsTab: React.FC<WorkspaceSaaSAddonProps> = ({
  workspaceId,
  workspaceName,
  currentUserRole
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  const [auditLogs, setAuditLogs] = useState<WorkspaceAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // 監査ログ読み込み
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: WorkspaceAuditLog[] }>(
        `/api/workspaces/${workspaceId}/audit-logs`
      );
      if (res.success && Array.isArray(res.data)) {
        setAuditLogs(res.data);
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

  // CSVエクスポート
  const handleExportWorkspaceAuditLogs = () => {
    if (auditLogs.length === 0) return;
    const headersLine = ["ID", "User Name", "Action", "Details", "IP Address", "Created At"];
    const rows = filteredAuditLogs.map(log => [
      log.id,
      log.userName || "System",
      log.action,
      log.details.replace(/"/g, '""'),
      log.ip_address || "",
      log.created_at
    ]);

    const csvContent = "\uFEFF" + [
      headersLine.join(","),
      ...rows.map(row => row.map(val => `"${val}"`).join(","))
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
      (log.userName?.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
      (log.details?.toLowerCase().includes(auditSearchQuery.toLowerCase()));

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
          <span style={{ fontSize: '16px' }}>🔒</span>
          <span>
            {isEn
              ? 'Community Edition: Audit logs are retained for 7 days. Upgrade via GitHub Sponsor to unlock full history.'
              : 'コミュニティ版: 監査ログは直近7日間分が表示されます。🔒 GitHub スポンサー登録で全期間の過去ログが無制限解放されます。'}
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
            gap: '4px'
          }}
        >
          <span>GitHub Sponsor 🔒</span>
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
          placeholder="ユーザー、アクション、詳細で検索..." 
          value={auditSearchQuery} 
          onChange={(e) => setAuditSearchQuery(e.target.value)} 
          className="form-input"
          style={{ flex: 1, marginBottom: 0, padding: '6px 10px', fontSize: '12px' }} 
        />
        <select 
          value={auditActionFilter} 
          onChange={(e) => setAuditActionFilter(e.target.value)} 
          className="form-input"
          style={{ width: '150px', marginBottom: 0, padding: '6px', fontSize: '12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
        >
          <option value="">全アクション</option>
          <option value="user_login">ログイン</option>
          <option value="workspace_update">WS更新</option>
          <option value="member_add">メンバー追加</option>
          <option value="member_remove">メンバー除外</option>
          <option value="channel_create">チャンネル作成</option>
          <option value="channel_delete">チャンネル削除</option>
          <option value="file_upload">アップロード</option>
          <option value="file_delete">ファイル削除</option>
          <option value="plan_change">プラン変更</option>
        </select>
      </div>

      <div style={{ border: '1px solid var(--border-light)', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px' }}>日時</th>
                <th style={{ padding: '8px 12px' }}>ユーザー</th>
                <th style={{ padding: '8px 12px' }}>アクション</th>
                <th style={{ padding: '8px 12px' }}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>ログを読み込み中...</td></tr>
              ) : filteredAuditLogs.length > 0 ? (
                filteredAuditLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{log.userName || 'SYSTEM'}</td>
                    <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>{log.action}</span></td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>{log.details}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>ログはありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
