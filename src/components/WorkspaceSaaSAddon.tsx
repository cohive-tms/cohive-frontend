import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle, ExternalLink, Download, CreditCard, FileText, Megaphone, Plus, Trash2, Calendar, Lock, Filter, ChevronDown, ChevronUp, X, Search, Check, Sparkles, Info } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';



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
  local_ip?: string;
  computer_name?: string;
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
    </div>
  );
};


// -----------------------------------------------------------------------------
// 2. 自社監査ログタブ
// -----------------------------------------------------------------------------
export const WorkspaceAuditLogsTab: React.FC<WorkspaceSaaSAddonProps> = ({
  workspaceId,
  workspaceName,
  currentUserRole,
  subscription,
  onRefreshSubscription
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  const [auditLogs, setAuditLogs] = useState<WorkspaceAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  
  // 複合検索条件
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);

  // プラン判定 (GitHub スポンサー状態)
  const isSponsored = subscription?.plan === 'sponsored' || subscription?.isSponsored === true;

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

  // アクションの一覧を動的に抽出
  const availableActions = Array.from(new Set(auditLogs.map(log => log.action))).filter(Boolean);

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

  // CSVエクスポート
  const handleExportWorkspaceAuditLogs = () => {
    if (filteredAuditLogs.length === 0) return;
    const headersLine = ["ID", "User Name", "Action", "Global IP", "Local IP", "Computer Name", "Details", "Created At"];
    const rows = filteredAuditLogs.map(log => [
      log.id,
      log.userName || "System",
      log.action,
      log.ip_address || "N/A",
      log.local_ip || "N/A",
      log.computer_name || "N/A",
      typeof log.details === 'string' ? log.details.replace(/"/g, '""') : JSON.stringify(log.details),
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

  // 複合検索フィルタリング
  const filteredAuditLogs = auditLogs.filter(log => {
    // 1. テキスト検索（操作名、ユーザー名、グローバルIP、ローカルIP、PC名、詳細情報）
    const query = auditSearchQuery.trim().toLowerCase();
    const localIp = (log.local_ip || 'N/A').toLowerCase();
    const compName = (log.computer_name || 'N/A').toLowerCase();

    const textMatch = !query || (
      (log.action && log.action.toLowerCase().includes(query)) ||
      (log.userName && log.userName.toLowerCase().includes(query)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(query)) ||
      localIp.includes(query) ||
      compName.includes(query) ||
      (log.details && (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)).toLowerCase().includes(query))
    );

    // 2. アクション種別のマルチセレクト絞り込み
    const actionMatch = selectedActions.length === 0 || selectedActions.includes(log.action);

    // 3. 日付指定（From / To、片方のみも可）
    let dateMatch = true;
    const rawDate = log.created_at || (log as any).createdAt;
    if (rawDate) {
      let sanitized = rawDate.trim();
      if (!sanitized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(sanitized)) {
        sanitized = sanitized.replace(' ', 'T') + 'Z';
      }
      const logTime = new Date(sanitized).getTime();
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

  // 7日以前の日時指定検知（通常版プロモーション表示用）
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
              style={{ width: '100%', paddingLeft: '30px', fontSize: '12px', height: '36px', marginBottom: 0 }}
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
                background: 'var(--bg-primary, #1e293b)',
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
              style={{ fontSize: '12px', height: '34px', padding: '0 8px', flex: 1, marginBottom: 0 }}
              title={isEn ? "Start Date (From)" : "開始日（〜から）"}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>〜</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="form-input"
              style={{ fontSize: '12px', height: '34px', padding: '0 8px', flex: 1, marginBottom: 0 }}
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

        {/* 監査ログ一覧テーブル */}
      <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary, rgba(255,255,255,0.02))', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'Date' : '日時'}</th>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'User' : 'ユーザー'}</th>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'Action' : 'アクション'}</th>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'Global IP' : 'グローバルIP'}</th>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'Local IP' : 'ローカルIP'}</th>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'Computer Name' : 'コンピュータ名'}</th>
                <th style={{ padding: '10px 12px' }}>{isEn ? 'Details' : '詳細'}</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Loader className="animate-spin" size={16} />
                      <span>{isEn ? 'Loading logs...' : 'ログを読み込み中...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAuditLogs.length > 0 ? (
                filteredAuditLogs.map(log => {
                  const badge = getActionBadgeStyle(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)', transition: 'background-color 0.15s ease' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{log.userName || 'SYSTEM'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.ip_address || '-'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.local_ip || '-'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{log.computer_name || '-'}</td>
                      <td 
                        style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                        title={log.details}
                      >
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {isEn ? 'No logs found matching filters.' : '条件に合致する監査ログはありません。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
