import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle, ExternalLink, Download, CreditCard, FileText, Megaphone, Plus, Trash2, Calendar, Lock, Filter, ChevronDown, ChevronUp, X, Search, Check, Sparkles, Info } from 'lucide-react';
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

  // フィルタ状態
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI制御状態
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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

  // 利用可能なアクション一覧の自動抽出
  const availableActions = Array.from(
    new Set(auditLogs.map(log => log.action).filter(Boolean))
  );

  const toggleActionFilter = (action: string) => {
    setSelectedActions(prev =>
      prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
    );
  };

  const clearAllFilters = () => {
    setAuditSearchQuery('');
    setSelectedActions([]);
    setStartDate('');
    setEndDate('');
  };

  // CSVエクスポート（フィルタ後のデータを出力）
  const handleExportWorkspaceAuditLogs = () => {
    if (filteredAuditLogs.length === 0) return;
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

  // 複合検索フィルタリング
  const filteredAuditLogs = auditLogs.filter(log => {
    // 1. テキスト検索（操作名、ユーザー名、IPアドレス、詳細情報）
    const query = auditSearchQuery.trim().toLowerCase();
    const textMatch = !query || (
      (log.action && log.action.toLowerCase().includes(query)) ||
      (log.userName && log.userName.toLowerCase().includes(query)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(query)) ||
      (log.details && (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)).toLowerCase().includes(query))
    );

    // 2. アクション種別のマルチセレクト絞り込み
    const actionMatch = selectedActions.length === 0 || selectedActions.includes(log.action);

    // 3. 日付指定（From / To）
    let dateMatch = true;
    if (log.created_at) {
      const logTime = new Date(log.created_at).getTime();
      if (startDate) {
        const startMs = new Date(`${startDate}T00:00:00`).getTime();
        if (logTime < startMs) dateMatch = false;
      }
      if (endDate) {
        const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
        if (logTime > endMs) dateMatch = false;
      }
    }

    return textMatch && actionMatch && dateMatch;
  });

  // 7日以前の日時指定検知（プロモーション表示用）
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const isBefore7DaysSelected = startDate ? new Date(startDate) < sevenDaysAgo : false;

  // アクションバッジのカラー指定
  const getActionBadgeStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REVOKE') || act.includes('BAN')) {
      return { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' };
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('INVITE') || act.includes('JOIN')) {
      return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', color: '#10b981' };
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('ROLE') || act.includes('CHANGE')) {
      return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' };
    }
    return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6' };
  };

  const hasActiveFilters = Boolean(auditSearchQuery || selectedActions.length > 0 || startDate || endDate);

  return (
    <div className="settings-form-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 🔒 鍵マーク & 7日間制限プロモーション案内バッジ */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.08) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '13px',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Lock size={18} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{isEn ? 'Community Edition: 7-Day Log Retention' : 'コミュニティ版: 直近7日間の監査ログを表示中'}</span>
              <span style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', borderRadius: '4px', fontWeight: 700 }}>FREE</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isEn
                ? 'Search history over 7 days & unlimited retention are unlocked via GitHub Sponsor.'
                : '7日以上前の過去ログ検索・長期保存は GitHub スポンサー登録で無制限解放されます。'}
            </div>
          </div>
        </div>
        <a 
          href="https://github.com/sponsors" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            padding: '8px 14px',
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            color: '#fff',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(236, 72, 153, 0.25)',
            transition: 'transform 0.15s ease'
          }}
        >
          <Sparkles size={14} />
          <span>{isEn ? 'Unlock Full History' : 'GitHub Sponsor で解放'}</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* タイトルとCSVエクスポート */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{isEn ? 'Workspace Audit Logs' : '自社監査ログ'}</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            {filteredAuditLogs.length} / {auditLogs.length} {isEn ? 'entries' : '件'}
          </span>
        </div>
        <button 
          onClick={handleExportWorkspaceAuditLogs} 
          disabled={filteredAuditLogs.length === 0} 
          style={{ 
            padding: '6px 12px', 
            background: filteredAuditLogs.length === 0 ? 'rgba(148, 163, 184, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
            border: `1px solid ${filteredAuditLogs.length === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(16, 185, 129, 0.3)'}`, 
            color: filteredAuditLogs.length === 0 ? 'var(--text-muted)' : '#10b981', 
            borderRadius: '6px', 
            fontSize: '12px', 
            fontWeight: 500,
            cursor: filteredAuditLogs.length === 0 ? 'not-allowed' : 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px' 
          }}
        >
          <Download size={14} />
          <span>{isEn ? 'Export CSV' : 'CSV出力'}</span>
        </button>
      </div>

      {/* 絞り込みコントロールパネル */}
      <div style={{
        padding: '14px',
        background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* 行1: フリーワード検索 + アクションマルチセレクト */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* フリーワード検索 */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder={isEn ? "Search by user, action, IP, or details..." : "ユーザー、アクション、IP、詳細で検索..."} 
              value={auditSearchQuery} 
              onChange={(e) => setAuditSearchQuery(e.target.value)} 
              className="form-input"
              style={{ width: '100%', paddingLeft: '30px', fontSize: '12px', height: '36px' }}
            />
            {auditSearchQuery && (
              <X 
                size={14} 
                onClick={() => setAuditSearchQuery('')} 
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} 
              />
            )}
          </div>

          {/* アクション種別マルチセレクト */}
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <button
              type="button"
              onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                background: 'var(--bg-primary, #fff)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Filter size={14} color="var(--text-muted)" />
                <span>
                  {selectedActions.length === 0
                    ? (isEn ? 'All Actions' : 'すべてのアクション')
                    : (isEn ? `Selected (${selectedActions.length})` : `選択中 (${selectedActions.length}件)`)}
                </span>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {/* ドロップダウンメニュー */}
            {isActionDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '40px',
                left: 0,
                right: 0,
                background: 'var(--bg-primary, #1e293b)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                zIndex: 50,
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '6px'
              }}>
                <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{isEn ? 'Filter by Action' : 'アクション種別で絞り込み'}</span>
                  {selectedActions.length > 0 && (
                    <span onClick={() => setSelectedActions([])} style={{ color: '#3b82f6', cursor: 'pointer' }}>
                      {isEn ? 'Clear' : '解除'}
                    </span>
                  )}
                </div>
                {availableActions.length > 0 ? (
                  availableActions.map(act => {
                    const isSelected = selectedActions.includes(act);
                    const badge = getActionBadgeStyle(act);
                    return (
                      <div
                        key={act}
                        onClick={() => toggleActionFilter(act)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          fontSize: '12px',
                          marginBottom: '2px'
                        }}
                      >
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {act}
                        </span>
                        {isSelected && <Check size={14} color="#3b82f6" />}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {isEn ? 'No actions available' : '選択可能なアクションがありません'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 行2: 日時範囲指定（From / To） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Calendar size={14} />
            <span>{isEn ? 'Date Range:' : '期間指定:'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 280px' }}>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="form-input"
              style={{ fontSize: '12px', height: '34px', padding: '0 8px', flex: 1 }}
              title={isEn ? "Start Date (From)" : "開始日（〜から）"}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>〜</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="form-input"
              style={{ fontSize: '12px', height: '34px', padding: '0 8px', flex: 1 }}
              title={isEn ? "End Date (To)" : "終了日（〜まで）"}
            />
          </div>

          {/* フィルターリセットボタン */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{
                padding: '6px 10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <X size={12} />
              <span>{isEn ? 'Reset Filters' : '絞り込み解除'}</span>
            </button>
          )}
        </div>

        {/* 選択されたアクションのチップ表示 */}
        {selectedActions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isEn ? 'Actions:' : '選択中のアクション:'}</span>
            {selectedActions.map(act => (
              <span
                key={act}
                onClick={() => toggleActionFilter(act)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#3b82f6',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {act}
                <X size={10} />
              </span>
            ))}
          </div>
        )}

        {/* 💡 7日以前の日付選択時のインライン誘導バナー */}
        {isBefore7DaysSelected && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Info size={14} style={{ flexShrink: 0 }} />
            <span>
              {isEn
                ? 'Community Edition retains logs for 7 days. Selected start date exceeds 7 days. Upgrade to GitHub Sponsor to view full history.'
                : 'コミュニティ版の保持期間（7日間）を超える開始日が指定されています。7日以上前の全過去ログ表示には GitHub スポンサー登録が必要です。'}
            </span>
          </div>
        )}
      </div>

      {/* ログ一覧表示エリア */}
      <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
        {auditLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader className="animate-spin" size={24} style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '12px' }}>{isEn ? 'Loading audit logs...' : '監査ログを読み込み中...'}</div>
          </div>
        ) : filteredAuditLogs.length > 0 ? (
          filteredAuditLogs.map(log => {
            const badge = getActionBadgeStyle(log.action);
            const isExpanded = expandedLogId === log.id;
            const hasDetails = Boolean(log.details);

            return (
              <div 
                key={log.id} 
                style={{ 
                  borderBottom: '1px solid var(--border-light)', 
                  transition: 'background 0.15s ease'
                }}
              >
                {/* メインログ行 */}
                <div 
                  onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                  style={{ 
                    padding: '12px 14px', 
                    cursor: hasDetails ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        background: badge.bg, 
                        color: badge.color, 
                        border: `1px solid ${badge.border}` 
                      }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.userName || 'System'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </span>
                      {hasDetails && (
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0, cursor: 'pointer' }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>IP: {log.ip_address || 'N/A'}</span>
                      {typeof log.details === 'string' && log.details.length < 60 && (
                        <span style={{ color: 'var(--text-secondary)' }}>• {log.details}</span>
                      )}
                    </div>
                    {hasDetails && !isExpanded && (
                      <span style={{ fontSize: '11px', color: '#3b82f6' }}>
                        {isEn ? 'Click for details' : '詳細を表示'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 詳細情報アコーディオン展開 */}
                {isExpanded && hasDetails && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg-secondary, rgba(0,0,0,0.04))',
                    borderTop: '1px dashed var(--border-light)',
                    fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {isEn ? 'Event Payload Details:' : 'イベント詳細データ:'}
                    </div>
                    <pre style={{
                      margin: 0,
                      padding: '8px 10px',
                      background: 'var(--bg-primary, #0f172a)',
                      color: 'var(--text-primary, #f8fafc)',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontSize: '11px',
                      border: '1px solid var(--border-light)'
                    }}>
                      {typeof log.details === 'object'
                        ? JSON.stringify(log.details, null, 2)
                        : (() => {
                            try {
                              return JSON.stringify(JSON.parse(log.details), null, 2);
                            } catch {
                              return log.details;
                            }
                          })()}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div style={{ fontSize: '13px', fontWeight: 500 }}>
              {hasActiveFilters
                ? (isEn ? 'No audit logs matched your search criteria.' : '指定した絞り込み条件に一致するログが見つかりませんでした。')
                : (isEn ? 'No audit logs recorded.' : '監査ログが記録されていません。')}
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                style={{
                  marginTop: '10px',
                  padding: '4px 12px',
                  background: 'none',
                  border: '1px solid var(--border-light)',
                  color: '#3b82f6',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {isEn ? 'Clear filters' : '条件をクリア'}
              </button>
            )}
          </div>
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
