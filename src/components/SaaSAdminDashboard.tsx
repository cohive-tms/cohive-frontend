import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Server, HardDrive, Key, Globe, Lock, LogOut, Check, 
  RefreshCw, Clipboard, CreditCard, FileText, Plus, Trash2, Edit3, Save, X, Download, AlertCircle, ToggleLeft, ToggleRight, Mail, Search, Building, BarChart3, Loader,
  Filter, ChevronDown, ChevronUp, Sparkles, Calendar, Info, ExternalLink
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';
import { GlobalAnnouncementBanner } from './GlobalAnnouncementBanner';

const MEDIA_PRESETS = [
  { id: 'image', name: '画像', exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'] },
  { id: 'video', name: '動画', exts: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'] },
  { id: 'audio', name: '音声', exts: ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'] },
  { id: 'document', name: '書類', exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md', 'json'] },
  { id: 'archive', name: '圧縮ファイル', exts: ['zip', '7z', 'rar', 'tar', 'gz'] },
];

// Stripe決済連携機能フラグ（動作検証後に true に変更することで全機能UIが復元されます）
const ENABLE_STRIPE_FEATURE = false;

// UTC日時文字列を閲覧者のブラウザ環境（ローカルタイムゾーン）に合わせた形式に自動変換するヘルパー関数
const formatLocalDateTime = (dateStr: string | null | undefined, includeTime: boolean = true): string => {
  if (!dateStr) return '-';
  try {
    let sanitized = dateStr.trim();
    // UTC表記 (Z や +XX:XX) が含まれていない場合、末尾に 'Z' を補完してUTCであることを明示
    if (!sanitized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(sanitized)) {
      sanitized = sanitized.replace(' ', 'T') + 'Z';
    }
    const d = new Date(sanitized);
    if (isNaN(d.getTime())) return dateStr;
    
    if (includeTime) {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } else {
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
  } catch {
    return dateStr;
  }
};

interface WorkspaceDetail {
  id: string;
  name: string;
  plan: string;
  status: string;
  memberCount: number;
  channelCount: number;
  storageUsed: number;
}

interface UserWorkspaceInfo {
  id: string;
  name: string;
  role: string;
}

interface UserDetail {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status?: string;
  createdAt: string | null;
  lastActiveAt: string | null;
  workspaces: UserWorkspaceInfo[];
}

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  planDistribution: { plan: string; count: number }[];
  totalStorage: number;
  workspaces: WorkspaceDetail[];
  users?: UserDetail[];
}

interface SaaSPlan {
  id: string;
  name: string;
  member_limit: number;
  channel_limit: number;
  storage_limit: number; // bytes
  dm_enabled: number; // 0 or 1
  media_enabled: number; // 0 or 1
  allowed_extensions: string;
  msg_retention_days: number;
  msg_retention_count: number;
  price_id: string;
  price_amount: number;
  price_currency: string;
  max_file_size_mb?: number;
}

interface AuditLog {
  id: string;
  workspace_id: string | null;
  workspaceName: string | null;
  user_id: string | null;
  userName: string | null;
  action: string;
  details: string;
  ip_address: string | null;
  local_ip?: string | null;
  computer_name?: string | null;
  created_at: string;
  isSaaSAdmin?: number;
}

interface SaaSAdminDashboardProps {
  currentPath: string;
  adminSetupRequired: boolean;
  onAdminSetupComplete: () => void;
  onLogoutAdmin: () => void;
}

export const SaaSAdminDashboard: React.FC<SaaSAdminDashboardProps> = ({
  currentPath,
  adminSetupRequired,
  onAdminSetupComplete,
  onLogoutAdmin,
}) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  // 認証と初期化状態
  const [token, setToken] = useState<string | null>(localStorage.getItem('cohive_admin_token'));
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState(!adminSetupRequired);
  
  // ログインフォーム状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tempSessionId, setTempSessionId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // タブ切り替え ('stats' | 'workspaces' | 'users' | 'plans' | 'settings' | 'mail' | 'audit_logs' | 'admins' | 'announcements')
  const [activeTab, setActiveTab] = useState<'stats' | 'workspaces' | 'users' | 'plans' | 'settings' | 'mail' | 'audit_logs' | 'admins' | 'announcements'>('stats');

  // アナウンス状態
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // アナウンス共通モーダル状態（新規作成 / 編集）
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [annModalMode, setAnnModalMode] = useState<'create' | 'edit'>('create');
  const [targetAnnId, setTargetAnnId] = useState<string | null>(null);
  const [annFormTitle, setAnnFormTitle] = useState('');
  const [annFormContent, setAnnFormContent] = useState('');
  const [annFormType, setAnnFormType] = useState<'info' | 'warning' | 'critical'>('info');
  const [annFormStartAt, setAnnFormStartAt] = useState('');
  const [annFormEndAt, setAnnFormEndAt] = useState('');
  const [annFormIsActive, setAnnFormIsActive] = useState(true);
  const [annFormSubmitting, setAnnFormSubmitting] = useState(false);
  const [annFormError, setAnnFormError] = useState<string | null>(null);

  // 検索状態
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // データ状態
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [clientIp, setClientIp] = useState('');

  // 管理者管理の状態
  const [adminAccounts, setAdminAccounts] = useState<any[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // 新規管理者登録フォーム
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 操作通知メッセージ（success / error）の5秒自動消去タイマー
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 環境設定用状態
  const [allowedIps, setAllowedIps] = useState('');
  const [customPath, setCustomPath] = useState(currentPath);
  const [defaultSaasPlan, setDefaultSaasPlan] = useState('free');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  // ヘッダープロフィールメニューと編集対象管理者アカウント状態
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // SaaS全体メール設定 (SMTP)
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('CoHive Enterprise');
  const [smtpMfaEnabled, setSmtpMfaEnabled] = useState(false);
  const [smtpTestRecipient, setSmtpTestRecipient] = useState('');

  // プラン編集・作成状態
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<SaaSPlan>>({
    id: '',
    name: '',
    member_limit: 10,
    channel_limit: 5,
    storage_limit: 524288000, // 500MB
    dm_enabled: 1,
    media_enabled: 1,
    allowed_extensions: 'jpg,jpeg,png,gif,webp,txt,csv,md,json,pdf,doc,docx,xls,xlsx,ppt,pptx',
    msg_retention_days: 30,
    msg_retention_count: 1000,
    price_id: '',
    price_amount: 0,
    price_currency: 'jpy',
    max_file_size_mb: 100
  });

  // 監査ログ検索状態
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isSponsored, setIsSponsored] = useState(false);

  // 認証失効時の共通トークンクリア処理
  const handleUnauthorized = () => {
    localStorage.removeItem('cohive_admin_token');
    setToken(null);
    setAdminUser(null);
  };

  // 1. 初期ロード処理
  useEffect(() => {
    if (token) {
      loadStats();
      loadPlans();
      loadSmtpSettings();
      loadAuditLogs();
      loadAdminAccounts();
      loadAnnouncements();
      fetchMe();
    }
  }, [token]);

  const loadAnnouncements = async () => {
    try {
      const res = await fetch('/api/admin/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) {
          setAnnouncements(data.announcements || []);
        }
      }
    } catch (e) {
      console.error("Failed to load announcements:", e);
    }
  };

  const handleOpenCreateModal = () => {
    setAnnModalMode('create');
    setTargetAnnId(null);
    setAnnFormTitle('');
    setAnnFormContent('');
    setAnnFormType('info');
    setAnnFormStartAt('');
    setAnnFormEndAt('');
    setAnnFormIsActive(true);
    setAnnFormError(null);
    setIsAnnModalOpen(true);
  };

  const handleOpenEditModal = (ann: any) => {
    setAnnModalMode('edit');
    setTargetAnnId(ann.id);
    setAnnFormTitle(ann.title || '');
    setAnnFormContent(ann.content || '');
    setAnnFormType(ann.type || 'info');
    setAnnFormIsActive(ann.is_active === 1 || ann.is_active === true || ann.isActive === 1 || ann.isActive === true);
    setAnnFormError(null);

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

    setAnnFormStartAt(formatForInput(ann.startAt || ann.start_at));
    setAnnFormEndAt(formatForInput(ann.endAt || ann.end_at));
    setIsAnnModalOpen(true);
  };

  const handleAnnFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annFormTitle.trim()) return;

    setAnnFormSubmitting(true);
    setAnnFormError(null);

    try {
      const finalStartAt = annFormStartAt ? new Date(annFormStartAt).toISOString() : null;
      const finalEndAt = annFormEndAt ? new Date(annFormEndAt).toISOString() : null;

      const url = annModalMode === 'create' ? '/api/admin/announcements' : `/api/admin/announcements/${targetAnnId}`;
      const method = annModalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: annFormTitle,
          content: annFormContent,
          type: annFormType,
          startAt: finalStartAt,
          endAt: finalEndAt,
          isActive: annFormIsActive
        })
      });

      if (res.ok) {
        setIsAnnModalOpen(false);
        setSuccess(annModalMode === 'create' ? '全体告知を作成しました。' : '全体告知を更新しました。');
        setError('');
        loadAnnouncements();
      } else {
        const data = await res.json() as any;
        setAnnFormError(data.error || '処理に失敗しました。');
      }
    } catch (e: any) {
      setAnnFormError(e.message || '通信エラーが発生しました。');
    } finally {
      setAnnFormSubmitting(false);
    }
  };

  const handleToggleAnnouncement = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAnnouncements();
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("この告知を削除してもよろしいですか？")) return;
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccess('告知を削除しました。');
        loadAnnouncements();
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePurgeWorkspace = async (workspaceId: string, workspaceName: string) => {
    const confirmText = window.prompt(`🚨【注意】ワークスペース「${workspaceName}」に関連するすべてのD1データおよびR2添付ファイルを永久削除します。\n\n本当に削除する場合は、確認のためワークスペース名「${workspaceName}」を入力してください:`);
    if (confirmText !== workspaceName) {
      if (confirmText !== null) {
        setError("ワークスペース名が一致しないため、完全削除をキャンセルしました。");
      }
      return;
    }

    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/purge`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess(`ワークスペース「${workspaceName}」のすべてのデータとファイルを完全削除しました。`);
        await loadStats();
      } else {
        setError(data.error || "データ削除に失敗しました。");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) {
          setAdminUser(data.admin);
          if (data.settings) {
            setAllowedIps(data.settings.allowedIps || '');
            setCustomPath(data.settings.customPath || currentPath);
            setDefaultSaasPlan(data.settings.defaultSaasPlan || 'free');
            setStripeEnabled(data.settings.stripeEnabled || false);
            if (data.settings.stripeSettings) {
              setStripeSecretKey(data.settings.stripeSettings.secretKey ? '********' : '');
              setStripePublishableKey(data.settings.stripeSettings.publishableKey || '');
              setStripeWebhookSecret(data.settings.stripeSettings.webhookSecret ? '********' : '');
            }
          }
          if (data.clientIp) {
            setClientIp(data.clientIp);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch admin user:", e);
    }
  };

  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [isRefreshingPlans, setIsRefreshingPlans] = useState(false);
  const [isRefreshingAuditLogs, setIsRefreshingAuditLogs] = useState(false);
  const [isRefreshingAdmins, setIsRefreshingAdmins] = useState(false);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const handleRefreshStats = async () => {
    setIsRefreshingStats(true);
    await loadStats();
    setTimeout(() => {
      setIsRefreshingStats(false);
    }, 400);
  };

  const handleRefreshPlans = async () => {
    setIsRefreshingPlans(true);
    await loadPlans();
    setTimeout(() => setIsRefreshingPlans(false), 400);
  };

  const handleRefreshAuditLogs = async () => {
    setIsRefreshingAuditLogs(true);
    await loadAuditLogs();
    setTimeout(() => setIsRefreshingAuditLogs(false), 400);
  };

  const handleRefreshAdmins = async () => {
    setIsRefreshingAdmins(true);
    await loadAdminAccounts();
    setTimeout(() => setIsRefreshingAdmins(false), 400);
  };

  const loadPlans = async () => {
    try {
      const res = await fetch('/api/admin/plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) setPlans(data.plans);
      }
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  };

  const loadSmtpSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings/smtp', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json() as any;
        if (data.settings) {
          setSmtpHost(data.settings.host || '');
          setSmtpPort(String(data.settings.port || '465'));
          setSmtpUser(data.settings.user || '');
          setSmtpPass(data.settings.pass ? '********' : '');
          setSmtpFromName(data.settings.fromName || 'CoHive SaaS');
          setSmtpMfaEnabled(data.settings.mfaEnabled || false);
        }
      }
    } catch (err) {
      console.error("Failed to load SMTP settings:", err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) {
          const logsData = data.logs || data.data || [];
          setAuditLogs(logsData);
          if (data.isSponsored !== undefined) {
            setIsSponsored(data.isSponsored);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    }
  };

  const loadAdminAccounts = async () => {
    setAdminsLoading(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success) setAdminAccounts(data.accounts);
      }
    } catch (err) {
      console.error("Failed to load admin accounts:", err);
    } finally {
      setAdminsLoading(false);
    }
  };

  // 2. 運営初期登録 (Setup)
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setIsInitialized(true);
        setSuccess("初期管理者の登録が完了しました。ログインしてください。");
        setPassword('');
      } else {
        setError(data.error || "セットアップに失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 3. ログイン処理
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        if (data.mfaRequired) {
          setTempSessionId(data.sessionId);
        } else if (data.token) {
          localStorage.setItem('cohive_admin_token', data.token);
          setToken(data.token);
          setAdminUser(data.admin);
          setSuccess("ログインしました。");
        }
      } else {
        setError(data.error || "ログインに失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 4. MFA検証処理
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempSessionId || !mfaCode) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: tempSessionId, code: mfaCode })
      });
      const data = await res.json() as any;
      if (res.ok && data.success && data.token) {
        localStorage.setItem('cohive_admin_token', data.token);
        setToken(data.token);
        setAdminUser(data.admin);
        setTempSessionId(null);
        setMfaCode('');
        setSuccess("ログインしました。");
      } else {
        setError(data.error || "認証コードが正しくありません。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 5. ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem('cohive_admin_token');
    setToken(null);
    setAdminUser(null);
    setTempSessionId(null);
    setSuccess(isEn ? 'Logged out.' : 'ログアウトしました。');
    onLogoutAdmin();
  };

  // 6. テナント状態の更新 (プラン割当・利用停止・再開)
  const handleUpdateTenantStatus = async (workspaceId: string, action: 'suspend' | 'activate' | 'change_plan', newPlanId?: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId, action, planId: newPlanId })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("ワークスペースの状態を更新しました。");
        await Promise.all([loadStats(), loadAuditLogs()]);
      } else {
        setError(data.error || "更新に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    }
  };

  // 7. 新規プラン作成
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.id || !newPlan.name) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPlan)
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("新規プランを作成しました。");
        setIsNewPlanOpen(false);
        setNewPlan({
          id: '',
          name: '',
          member_limit: 10,
          channel_limit: 5,
          storage_limit: 524288000,
          dm_enabled: 1,
          media_enabled: 1,
          allowed_extensions: 'jpg,jpeg,png,gif,webp,txt,csv,md,json,pdf,doc,docx,xls,xlsx,ppt,pptx',
          msg_retention_days: 30,
          msg_retention_count: 1000,
          price_id: '',
          price_amount: 0,
          price_currency: 'jpy',
          max_file_size_mb: 100
        });
        await loadPlans();
      } else {
        setError(data.error || "プラン作成に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    }
  };

  // 8. プラン情報更新
  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingPlan)
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("プラン情報を更新しました。");
        setEditingPlan(null);
        await loadPlans();
      } else {
        setError(data.error || "プラン更新に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    }
  };

  // 9. プラン削除
  const handleDeletePlan = async (planId: string) => {
    if (!window.confirm("このプランを削除しますか？")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: planId })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("プランを削除しました。");
        await loadPlans();
      } else {
        setError(data.error || "プランの削除に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    }
  };

  // 10. SaaSシステム環境設定の保存
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          allowedIps,
          customPath,
          defaultSaasPlan,
          stripeEnabled,
          stripeSecretKey: stripeSecretKey === '********' ? undefined : stripeSecretKey,
          stripePublishableKey,
          stripeWebhookSecret: stripeWebhookSecret === '********' ? undefined : stripeWebhookSecret
        })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("SaaSシステム環境設定を保存しました。");
        await fetchMe();
        if (customPath !== currentPath) {
          onAdminSetupComplete();
        }
      } else {
        setError(data.error || "設定の保存に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 10-2. ユーザーステータス（BAN・一時停止 / 利用再開）切り替え
  const handleUpdateUserStatus = async (userId: string, action: 'suspend' | 'activate') => {
    const confirmMsg = action === 'suspend'
      ? (isEn ? 'Are you sure you want to suspend this user account? Active sessions will be invalidated immediately.' : 'このユーザーアカウントを一時停止（BAN）しますか？全てのログインセッションが即座に無効化されます。')
      : (isEn ? 'Are you sure you want to activate this user account?' : 'このユーザーアカウントの利用を再開しますか？');

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, action })
      });
      const data = await res.json() as any;

      if (res.ok && data.success) {
        setSuccess(action === 'suspend' ? (isEn ? "User account suspended." : "ユーザーアカウントを一時停止しました。") : (isEn ? "User account activated." : "ユーザーアカウントの利用を再開しました。"));
        await Promise.all([loadStats(), loadAuditLogs()]);
      } else {
        setError(data.error || "ステータスの更新に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 11. グローバルSMTP設定の保存
  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/smtp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass === '********' ? undefined : smtpPass,
          fromName: smtpFromName,
          mfaEnabled: smtpMfaEnabled
        })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("グローバルSMTP設定を保存しました。");
        await loadSmtpSettings();
      } else {
        setError(data.error || "SMTP設定の保存に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 12. グローバルSMTP設定の接続テスト
  const handleTestSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpTestRecipient) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/smtp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass === '********' ? '********' : smtpPass,
          fromName: smtpFromName,
          testRecipient: smtpTestRecipient
        })
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("テストメールを正常に送信しました。受信トレイを確認してください。");
      } else {
        setError(data.error || "テスト送信に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 13. グローバルSMTP設定の削除
  const handleDeleteSmtpSettings = async () => {
    if (!window.confirm("サービスドメインのSMTP設定をすべてクリアしますか？")) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/smtp', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSuccess("SMTP設定をクリアしました。");
        setSmtpHost('');
        setSmtpPort('465');
        setSmtpUser('');
        setSmtpPass('');
        setSmtpFromName('CoHive Enterprise');
        setSmtpMfaEnabled(false);
      } else {
        setError(data.error || "SMTP設定のクリアに失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 14. 新規管理者登録
  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword || !newAdminDisplayName) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          displayName: newAdminDisplayName
        })
      });
      const data = await response.json() as any;

      if (response.ok && data.success) {
        setSuccess(isEn ? "Admin account created successfully!" : "管理者アカウントを作成しました。");
        setNewAdminEmail('');
        setNewAdminPassword('');
        setNewAdminDisplayName('');
        await loadAdminAccounts();
      } else {
        setError(data.error || "作成に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 15. 管理者アカウント編集モーダルを開く
  const openEditModal = (admin: any) => {
    setEditingAdmin(admin);
    setEditEmail(admin.email || '');
    setEditDisplayName(admin.displayName || admin.display_name || '');
    setEditPassword('');
  };

  // 16. 管理者アカウントの更新 (他人の変更 [ownerのみ] または自分自身)
  const handleUpdateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin || !token) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingAdmin.id,
          email: editEmail,
          displayName: editDisplayName,
          password: editPassword || undefined
        })
      });
      const data = await response.json() as any;

      if (response.ok && data.success) {
        setSuccess(isEn ? "Account updated successfully!" : "アカウント情報を更新しました。");
        setEditingAdmin(null);
        
        // 自分自身の変更であれば adminUser 状態も即座に同期
        if (editingAdmin.id === adminUser?.id) {
          setAdminUser({
            ...adminUser,
            email: editEmail,
            displayName: editDisplayName,
            display_name: editDisplayName
          });
        }
        await loadAdminAccounts();
      } else {
        setError(data.error || "アカウントの更新に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 17. 管理者の削除
  const handleDeleteAdmin = async (adminId: string) => {
    const confirmDelete = window.confirm(
      isEn 
        ? "Are you sure you want to delete this admin account?" 
        : "本当にこの管理者アカウントを削除しますか？"
    );
    if (!confirmDelete) return;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: adminId })
      });
      const data = await response.json() as any;

      if (response.ok && data.success) {
        setSuccess(isEn ? "Admin account deleted successfully!" : "管理者アカウントを削除しました。");
        await loadAdminAccounts();
      } else {
        setError(data.error || "削除に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 18. オーナー権限移譲処理
  const handleTransferOwnershipSubmit = async (targetAdminId: string, displayName: string) => {
    const confirmTransfer = window.confirm(
      isEn
        ? `Are you sure you want to transfer SaaS ownership to ${displayName}? Once transferred, your role will be demoted to admin.`
        : `本当にSaaSオーナー権限を「${displayName}」に移譲しますか？移譲後、あなたのアカウントは一般の管理者に降格します。`
    );
    if (!confirmTransfer) return;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/accounts/transfer-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetAdminId })
      });
      const data = await response.json() as any;

      if (response.ok && data.success) {
        setSuccess(isEn ? "Ownership transferred successfully." : "オーナー権限を移譲しました。");
        // 最新のセッション状態・ロールを反映
        await fetchMe();
        await loadAdminAccounts();
      } else {
        setError(data.error || "権限移譲に失敗しました。");
      }
    } catch (err: any) {
      setError(err.message || "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // 19. 監査ログエクスポート
  const handleExportAuditLogs = () => {
    if (filteredAuditLogs.length === 0) return;
    const headersList = ["タイムスタンプ", "ワークスペース名", "操作ユーザー名", "アクション", "グローバルIP", "ローカルIP", "コンピュータ名", "詳細"];
    const csvRows = [headersList.join(",")];

    for (const log of filteredAuditLogs) {
      const row = [
        `"${new Date(log.created_at).toLocaleString().replace(/"/g, '""')}"`,
        `"${(log.workspaceName || 'SYSTEM').replace(/"/g, '""')}"`,
        `"${(log.userName || 'SYSTEM').replace(/"/g, '""')}"`,
        `"${log.action.replace(/"/g, '""')}"`,
        `"${(log.ip_address || '').replace(/"/g, '""')}"`,
        `"${(log.local_ip || '').replace(/"/g, '""')}"`,
        `"${(log.computer_name || '').replace(/"/g, '""')}"`,
        `"${log.details.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cohive_admin_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSize = (bytes: number) => {
    if (bytes === Infinity || bytes >= 9999999999) return '無制限';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 監査ログの複合条件フィルタリング
  const filteredAuditLogs = auditLogs.filter(log => {
    // 1. テキスト検索（操作名、ユーザー名、ワークスペース名、グローバルIP、ローカルIP、PC名、詳細情報）
    const query = auditSearchQuery.trim().toLowerCase();
    const localIp = (log.local_ip || 'N/A').toLowerCase();
    const compName = (log.computer_name || 'N/A').toLowerCase();
    const wsName = (log.workspaceName || 'N/A').toLowerCase();

    const textMatch = !query || (
      (log.action && log.action.toLowerCase().includes(query)) ||
      (log.userName && log.userName.toLowerCase().includes(query)) ||
      wsName.includes(query) ||
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const isBefore7DaysSelected = startDate ? new Date(startDate) < sevenDaysAgo : false;
  const hasActiveFilters = Boolean(auditSearchQuery || selectedActions.length > 0 || startDate || endDate);

  if (token === null) {
    if (!isInitialized) {
      return (
        <div className="setup-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#fff', padding: '20px' }}>
          <div className="setup-card" style={{ background: '#1e293b', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', justifyContent: 'center' }}>
              <Shield size={32} style={{ color: '#0ea5e9' }} />
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>CoHive Enterprise Setup</h2>
            </div>
            <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '24px', fontSize: '14px' }}>
              {isEn ? "Initialize the first Enterprise platform owner account." : "最初のプラットフォーム運営管理者アカウントを登録します。"}
            </p>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

            <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>表示名</label>
                <input type="text" placeholder="管理者A" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>メールアドレス</label>
                <input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>初期パスワード</label>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
              </div>
              <button type="submit" disabled={loading} style={{ background: '#0ea5e9', border: 'none', padding: '12px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', marginTop: '10px' }}>
                {loading ? "登録中..." : "最初の管理者を登録"}
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="setup-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#fff', padding: '20px' }}>
        <div className="setup-card" style={{ background: '#1e293b', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', width: '100%', maxWidth: '440px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', justifyContent: 'center' }}>
            <Shield size={32} style={{ color: '#0ea5e9' }} />
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>CoHive Enterprise Admin</h2>
          </div>

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
          {success && <div style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

          {tempSessionId ? (
            <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.5' }}>
                  管理者ログイン用の確認コード（MFA）をメールで送信しました。コードを入力してログインを完了してください。
                </p>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>認証コード</label>
                <input type="text" maxLength={6} placeholder="123456" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} required style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '20px', fontWeight: 'bold', letterSpacing: '8px', textAlign: 'center' }} disabled={loading} />
              </div>
              <button type="submit" style={{ background: '#0ea5e9', border: 'none', padding: '12px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }} disabled={loading || mfaCode.length !== 6}>
                {loading ? "認証中..." : "ログインを確定"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>メールアドレス</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} disabled={loading} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>パスワード</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} disabled={loading} />
              </div>
              <button type="submit" style={{ background: '#0ea5e9', border: 'none', padding: '12px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', marginTop: '10px' }} disabled={loading}>
                {loading ? "ログイン中..." : "ログイン"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isEdit = editingPlan !== null;
  const currentFormPlan = isEdit ? editingPlan! : newPlan;
  const setFormPlan = (updated: any) => {
    if (isEdit) {
      setEditingPlan(updated);
    } else {
      setNewPlan(updated);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#090d16', color: '#cbd5e1', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
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

      {/* 画面上部中央の共通操作通知トースト (10秒自動消去) */}
      {(success || error) && (
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
            width: 'min(90vw, 480px)',
            pointerEvents: 'none'
          }}
        >
          {error && (
            <div
              style={{
                pointerEvents: 'auto',
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderLeft: '4px solid #ef4444',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                overflow: 'hidden',
                position: 'relative',
                animation: 'toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontSize: '13px', fontWeight: 600 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ height: '3px', width: '100%', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#ef4444', animation: 'toastProgress 5s linear forwards' }} />
              </div>
            </div>
          )}

          {success && (
            <div
              style={{
                pointerEvents: 'auto',
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderLeft: '4px solid #22c55e',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                overflow: 'hidden',
                position: 'relative',
                animation: 'toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
            >
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#4ade80', fontSize: '13px', fontWeight: 600 }}>
                  <Check size={18} style={{ flexShrink: 0 }} />
                  <span>{success}</span>
                </div>
                <button
                  onClick={() => setSuccess(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ height: '3px', width: '100%', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#22c55e', animation: 'toastProgress 5s linear forwards' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* トップヘッダー */}
      <header style={{ height: '64px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0e1320', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <Shield size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>CoHive Enterprise Portal</h1>
            <span style={{ fontSize: '11px', color: '#64748b' }}>エンタープライズ総合統括パネル</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <div 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer', 
              padding: '6px 12px', 
              borderRadius: '6px', 
              background: profileMenuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'background 0.2s',
              userSelect: 'none'
            }}
          >
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>
              {(adminUser?.displayName || adminUser?.display_name || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div style={{ fontSize: '13px', textAlign: 'left' }}>
              <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1 }}>{adminUser?.role === 'owner' ? 'オーナー' : '管理者'}</div>
              <strong style={{ color: '#cbd5e1' }}>{adminUser?.displayName || adminUser?.display_name}</strong>
            </div>
          </div>

          {profileMenuOpen && (
            <>
              <div 
                onClick={() => setProfileMenuOpen(false)} 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
              />
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                right: 0, 
                marginTop: '8px', 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: '8px', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                width: '180px',
                zIndex: 999,
                padding: '6px 0'
              }}>
                <button 
                  onClick={() => { openEditModal(adminUser); setProfileMenuOpen(false); }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    width: '100%', 
                    padding: '8px 16px', 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#cbd5e1', 
                    fontSize: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Users size={14} />
                  <span>プロフィール設定</span>
                </button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button 
                  onClick={() => { handleLogout(); setProfileMenuOpen(false); }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    width: '100%', 
                    padding: '8px 16px', 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#ef4444', 
                    fontSize: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <LogOut size={14} />
                  <span>ログアウト</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* メインボディ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* サイドナビゲーション */}
        <aside style={{ width: '240px', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15, 23, 42, 0.3)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => setActiveTab('stats')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'stats' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <BarChart3 size={16} />
            <span>統計 ＆ アナリティクス</span>
          </button>

          <button onClick={() => setActiveTab('workspaces')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'workspaces' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Building size={16} />
            <span>ワークスペース管理</span>
          </button>

          <button onClick={() => setActiveTab('users')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'users' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Users size={16} />
            <span>ユーザー管理</span>
          </button>

          <button onClick={() => setActiveTab('plans')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'plans' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <CreditCard size={16} />
            <span>プラン設定</span>
          </button>

          <button onClick={() => setActiveTab('settings')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'settings' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Key size={16} />
            <span>環境設定</span>
          </button>

          <button onClick={() => setActiveTab('mail')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'mail' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Mail size={16} />
            <span>メール設定</span>
          </button>

          <button onClick={() => setActiveTab('announcements')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'announcements' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Globe size={16} />
            <span>全体告知管理</span>
          </button>

          <button onClick={() => setActiveTab('audit_logs')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'audit_logs' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <FileText size={16} />
            <span>監査ログ</span>
          </button>

          <button onClick={() => setActiveTab('admins')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: activeTab === 'admins' ? '#0ea5e9' : 'transparent', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Shield size={16} />
            <span>管理者アカウント</span>
          </button>
        </aside>

        {/* メインコンテンツ表示エリア */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

          {/* TAB 1: 統計 ＆ アナリティクス */}
          {activeTab === 'stats' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* ヘッダー情報 */}
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>システム統括アナリティクス</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>CoHive プラットフォーム全体の利用統計と契約ステータスの全体像です。</p>
              </div>

              {/* カードグループ */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>登録ユーザー総数</span>
                  <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#fff' }}>{stats.totalUsers.toLocaleString()} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>人</span></div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ワークスペース総数</span>
                  <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#0ea5e9' }}>{stats.totalWorkspaces.toLocaleString()} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>個</span></div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ストレージ使用総量</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '12px', color: '#10b981' }}>{formatSize(stats.totalStorage)}</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>プラン分布</span>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {stats.planDistribution.map(p => (
                      <span key={p.plan} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '6px', color: '#94a3b8' }}>
                        {p.plan}: <strong style={{ color: '#fff' }}>{p.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* サマリーパネル / クイックリンク */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={16} color="#0ea5e9" />
                      最近のワークスペース（直近5件）
                    </h3>
                    <button onClick={() => setActiveTab('workspaces')} style={{ background: 'transparent', border: 'none', color: '#0ea5e9', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      すべて見る &rarr;
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stats.workspaces.slice(0, 5).map(w => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{w.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>メンバー: {w.memberCount}人 | {formatSize(w.storageUsed)}</div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(14,165,233,0.1)', color: '#38bdf8', fontWeight: 600 }}>
                          {w.plan.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={16} color="#10b981" />
                      最新登録ユーザー（直近5件）
                    </h3>
                    <button onClick={() => setActiveTab('users')} style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      すべて見る &rarr;
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(stats.users || []).slice(0, 5).map(u => (
                      <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                            {(u.displayName || u.email || 'U').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{u.displayName || '未設定'}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          所属: {u.workspaces?.length || 0} WS
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ワークスペース管理 */}
          {activeTab === 'workspaces' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>ワークスペース（テナント）管理</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>システム上で作成されたすべてのワークスペースの管理、プラン割り当て、利用停止・再開を行います。</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleRefreshStats}
                    disabled={isRefreshingStats}
                    title="データを最新状態に更新"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      borderRadius: '6px',
                      color: '#0ea5e9',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isRefreshingStats ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: isRefreshingStats ? 'spin 1s linear infinite' : 'none' }} />
                    <span>最新情報に更新</span>
                  </button>
                  <div style={{ position: 'relative', width: '280px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input 
                      type="text" 
                      placeholder="ワークスペース名・IDで検索..." 
                      value={workspaceSearch}
                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* テナント一覧テーブル */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>ワークスペースID</th>
                        <th style={{ padding: '12px 16px' }}>ワークスペース名</th>
                        <th style={{ padding: '12px 16px' }}>プラン</th>
                        <th style={{ padding: '12px 16px' }}>ステータス</th>
                        <th style={{ padding: '12px 16px' }}>メンバー数</th>
                        <th style={{ padding: '12px 16px' }}>チャンネル数</th>
                        <th style={{ padding: '12px 16px' }}>ストレージ使用量</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.workspaces
                        .filter(w => !workspaceSearch || w.name.toLowerCase().includes(workspaceSearch.toLowerCase()) || w.id.toLowerCase().includes(workspaceSearch.toLowerCase()))
                        .map(w => (
                          <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#64748b', fontSize: '11px', wordBreak: 'break-all', maxWidth: '160px' }}>{w.id}</td>
                            <td style={{ padding: '14px 16px', fontWeight: 600, color: '#fff' }}>{w.name}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <select 
                                value={w.plan} 
                                onChange={(e) => handleUpdateTenantStatus(w.id, 'change_plan', e.target.value)}
                                style={{ padding: '4px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                              >
                                {plans.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11px', 
                                fontWeight: 'bold',
                                color: w.status === 'suspended' ? '#f87171' : '#34d399',
                                background: w.status === 'suspended' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'
                              }}>
                                {w.status === 'suspended' ? '利用停止中' : 'アクティブ'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>{w.memberCount} 人</td>
                            <td style={{ padding: '14px 16px' }}>{w.channelCount} 個</td>
                            <td style={{ padding: '14px 16px' }}>{formatSize(w.storageUsed)}</td>
                             <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                {w.status === 'suspended' ? (
                                  <button onClick={() => handleUpdateTenantStatus(w.id, 'activate')} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>利用再開</button>
                                ) : (
                                  <button onClick={() => handleUpdateTenantStatus(w.id, 'suspend')} style={{ background: '#f59e0b', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>一時停止</button>
                                )}
                                <button onClick={() => handlePurgeWorkspace(w.id, w.name)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="D1レコードおよびR2メディアファイルを完全物理削除">
                                  <Trash2 size={12} />
                                  <span>データ全削除</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ユーザー管理 */}
          {activeTab === 'users' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>登録ユーザーメンバー一覧</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>システム全体に登録されているすべてのユーザー情報および参加ワークスペースを確認します。</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleRefreshStats}
                    disabled={isRefreshingStats}
                    title="データを最新状態に更新"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      borderRadius: '6px',
                      color: '#0ea5e9',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isRefreshingStats ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: isRefreshingStats ? 'spin 1s linear infinite' : 'none' }} />
                    <span>最新情報に更新</span>
                  </button>
                  <div style={{ position: 'relative', width: '280px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input 
                      type="text" 
                      placeholder="名前・メール・IDで検索..." 
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* ユーザー一覧テーブル */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>ステータス</th>
                        <th style={{ padding: '12px 16px' }}>ユーザー</th>
                        <th style={{ padding: '12px 16px' }}>メールアドレス</th>
                        <th style={{ padding: '12px 16px' }}>参加ワークスペース</th>
                        <th style={{ padding: '12px 16px' }}>登録日時</th>
                        <th style={{ padding: '12px 16px' }}>最終アクティブ</th>
                        <th style={{ padding: '12px 16px' }}>ユーザーID</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.users || [])
                        .filter(u => {
                          if (!userSearch) return true;
                          const query = userSearch.toLowerCase();
                          return (
                            (u.displayName && u.displayName.toLowerCase().includes(query)) ||
                            (u.email && u.email.toLowerCase().includes(query)) ||
                            (u.id && u.id.toLowerCase().includes(query))
                          );
                        })
                        .map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11px', 
                                fontWeight: 'bold',
                                color: u.status === 'suspended' ? '#f87171' : '#34d399',
                                background: u.status === 'suspended' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'
                              }}>
                                {u.status === 'suspended' ? '利用停止中' : 'アクティブ'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>
                                    {(u.displayName || u.email || 'U').slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: '#fff' }}>{u.displayName || '未設定'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>{u.email}</td>
                            <td style={{ padding: '14px 16px' }}>
                              {u.workspaces && u.workspaces.length > 0 ? (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {u.workspaces.map(ws => (
                                    <span key={ws.id} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>
                                      {ws.name} <span style={{ color: '#64748b', fontSize: '10px' }}>({ws.role})</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '12px', italic: 'true' }}>なし</span>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                              {formatLocalDateTime(u.createdAt, true)}
                            </td>
                            <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                              {formatLocalDateTime(u.lastActiveAt, true)}
                            </td>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#64748b', fontSize: '11px', wordBreak: 'break-all', maxWidth: '160px' }}>
                              {u.id}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              {u.status === 'suspended' ? (
                                <button onClick={() => handleUpdateUserStatus(u.id, 'activate')} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>利用再開</button>
                              ) : (
                                <button onClick={() => handleUpdateUserStatus(u.id, 'suspend')} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>利用停止</button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: プラン設定 */}
          {activeTab === 'plans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Enterprise プラン設定</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>テナントに割り当てるプランの制限値や課金価格を調整します。</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleRefreshPlans}
                    disabled={isRefreshingPlans}
                    title="最新のプラン設定を取得"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      borderRadius: '6px',
                      color: '#0ea5e9',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isRefreshingPlans ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: isRefreshingPlans ? 'spin 1s linear infinite' : 'none' }} />
                    <span>最新情報に更新</span>
                  </button>
                  <button onClick={() => { setIsNewPlanOpen(!isNewPlanOpen); setEditingPlan(null); }} style={{ background: '#0ea5e9', border: 'none', padding: '8px 16px', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} />
                    <span>新規プラン作成</span>
                  </button>
                </div>
              </div>

              {/* 新規プラン作成・編集共通フォーム */}
              {(isNewPlanOpen || editingPlan !== null) && (
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#0ea5e9' }}>
                    {isEdit ? `プラン編集: ${currentFormPlan.id}` : '新規プラン登録'}
                  </h3>
                  <form onSubmit={isEdit ? (e) => { e.preventDefault(); handleUpdatePlan(); } : handleCreatePlan} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>プランID (一意の識別コード)</label>
                      <input 
                        type="text" 
                        disabled={isEdit}
                        placeholder="例: pro-plan" 
                        value={currentFormPlan.id || ''} 
                        onChange={(e) => setFormPlan({...currentFormPlan, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '')})} 
                        required 
                        style={{ width: '100%', padding: '8px 12px', background: isEdit ? 'rgba(255,255,255,0.03)' : '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: isEdit ? '#64748b' : '#fff', fontSize: '13px' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>プラン表示名</label>
                      <input 
                        type="text" 
                        placeholder="例: プロプラン" 
                        value={currentFormPlan.name || ''} 
                        onChange={(e) => setFormPlan({...currentFormPlan, name: e.target.value})} 
                        required 
                        style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                      />
                    </div>
                    
                    {/* メンバー上限数 */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>メンバー上限数</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          disabled={(currentFormPlan.member_limit ?? 0) >= 9999}
                          value={(currentFormPlan.member_limit ?? 0) >= 9999 ? '' : (currentFormPlan.member_limit ?? 10)} 
                          placeholder={(currentFormPlan.member_limit ?? 0) >= 9999 ? '無制限' : '例: 10'}
                          onChange={(e) => setFormPlan({...currentFormPlan, member_limit: parseInt(e.target.value) || 0})} 
                          style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input 
                            type="checkbox" 
                            checked={(currentFormPlan.member_limit ?? 0) >= 9999} 
                            onChange={(e) => setFormPlan({
                              ...currentFormPlan, 
                              member_limit: e.target.checked ? 9999 : 10
                            })} 
                            style={{ cursor: 'pointer' }}
                          />
                          <span>無制限</span>
                        </label>
                      </div>
                    </div>

                    {/* チャンネル上限数 */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>チャンネル上限数</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          disabled={(currentFormPlan.channel_limit ?? 0) >= 9999}
                          value={(currentFormPlan.channel_limit ?? 0) >= 9999 ? '' : (currentFormPlan.channel_limit ?? 5)} 
                          placeholder={(currentFormPlan.channel_limit ?? 0) >= 9999 ? '無制限' : '例: 5'}
                          onChange={(e) => setFormPlan({...currentFormPlan, channel_limit: parseInt(e.target.value) || 0})} 
                          style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input 
                            type="checkbox" 
                            checked={(currentFormPlan.channel_limit ?? 0) >= 9999} 
                            onChange={(e) => setFormPlan({
                              ...currentFormPlan, 
                              channel_limit: e.target.checked ? 9999 : 5
                            })} 
                            style={{ cursor: 'pointer' }}
                          />
                          <span>無制限</span>
                        </label>
                      </div>
                    </div>

                    {/* 容量制限 */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>ディスクストレージ上限 (Bytes)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          disabled={(currentFormPlan.storage_limit ?? 0) >= 9999999999}
                          value={(currentFormPlan.storage_limit ?? 0) >= 9999999999 ? '' : (currentFormPlan.storage_limit ?? 524288000)} 
                          placeholder={(currentFormPlan.storage_limit ?? 0) >= 9999999999 ? '無制限' : '例: 524288000'}
                          onChange={(e) => setFormPlan({...currentFormPlan, storage_limit: parseInt(e.target.value) || 0})} 
                          style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input 
                            type="checkbox" 
                            checked={(currentFormPlan.storage_limit ?? 0) >= 9999999999} 
                            onChange={(e) => setFormPlan({
                              ...currentFormPlan, 
                              storage_limit: e.target.checked ? 9999999999 : 524288000
                            })} 
                            style={{ cursor: 'pointer' }}
                          />
                          <span>無制限</span>
                        </label>
                      </div>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>50MB = 52428800, 500MB = 524288000, 1GB = 1073741824</span>
                    </div>

                    {/* アップロード許可拡張子 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>アップロード許可拡張子</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const allExts = MEDIA_PRESETS.flatMap(p => p.exts);
                              setFormPlan({ ...currentFormPlan, allowed_extensions: allExts.join(',') });
                            }}
                            style={{ padding: '2px 6px', fontSize: '10px', background: '#334155', color: '#38bdf8', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            全プリセット有効
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormPlan({ ...currentFormPlan, allowed_extensions: '' })}
                            style={{ padding: '2px 6px', fontSize: '10px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            クリア (無制限)
                          </button>
                        </div>
                      </div>

                      {/* プリセットカテゴリ チェックボックス群 */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', padding: '8px 10px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px' }}>
                        {MEDIA_PRESETS.map(preset => {
                          const currentList = (currentFormPlan.allowed_extensions || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                          const isFullyChecked = preset.exts.every(ext => currentList.includes(ext));
                          const isPartiallyChecked = !isFullyChecked && preset.exts.some(ext => currentList.includes(ext));

                          const handleToggle = (checked: boolean) => {
                            let updatedList = [...currentList];
                            if (checked) {
                              preset.exts.forEach(ext => {
                                  if (!updatedList.includes(ext)) updatedList.push(ext);
                              });
                            } else {
                              updatedList = updatedList.filter(ext => !preset.exts.includes(ext));
                            }
                            setFormPlan({ ...currentFormPlan, allowed_extensions: updatedList.join(',') });
                          };

                          return (
                            <label key={preset.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: isFullyChecked ? '#38bdf8' : isPartiallyChecked ? '#f59e0b' : '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={isFullyChecked}
                                ref={el => { if (el) el.indeterminate = isPartiallyChecked; }}
                                onChange={(e) => handleToggle(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontWeight: isFullyChecked || isPartiallyChecked ? 600 : 400 }}>{preset.name}</span>
                              <span style={{ fontSize: '10px', opacity: 0.7 }}>({preset.exts.slice(0, 3).join(',')}{preset.exts.length > 3 ? '…' : ''})</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* テキスト入力（自由調整用） */}
                      <input 
                        type="text" 
                        placeholder="例: jpg,png,pdf,docx (カンマ区切り)" 
                        value={currentFormPlan.allowed_extensions || ''} 
                        onChange={(e) => setFormPlan({...currentFormPlan, allowed_extensions: e.target.value})} 
                        style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                      />
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        チェックボックスで一般的な拡張子をセットできます。テキスト欄で個別追加・削除も可能です。空欄の場合はすべての拡張子を許可します。
                      </span>
                      <span style={{ fontSize: '10px', color: '#f59e0b', display: 'block', marginTop: '4px' }}>
                        ※セキュリティ保護のため、システム禁止拡張子 (.exe, .sh, .php, .html, .bat 等の実行ファイル・スクリプト) は設定内容にかかわらず常時ブロックされます。
                      </span>
                    </div>

                    {/* 1ファイルあたりの最大容量 (MB) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>1ファイルあたりの最大容量 (MB)</label>
                      <input 
                        type="number" 
                        value={currentFormPlan.max_file_size_mb ?? 100} 
                        placeholder="例: 100 (デフォルト: 100MB)"
                        onChange={(e) => setFormPlan({...currentFormPlan, max_file_size_mb: parseInt(e.target.value) || 100})} 
                        style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                      />
                    </div>


                    {/* メッセージ保存期間(日数) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>メッセージ保存日数 (日)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          disabled={(currentFormPlan.msg_retention_days ?? 0) === 0}
                          value={(currentFormPlan.msg_retention_days ?? 0) === 0 ? '' : (currentFormPlan.msg_retention_days ?? 30)} 
                          placeholder={(currentFormPlan.msg_retention_days ?? 0) === 0 ? '無制限' : '例: 30'}
                          onChange={(e) => setFormPlan({...currentFormPlan, msg_retention_days: parseInt(e.target.value) || 0})} 
                          style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input 
                            type="checkbox" 
                            checked={(currentFormPlan.msg_retention_days ?? 0) === 0} 
                            onChange={(e) => setFormPlan({
                              ...currentFormPlan, 
                              msg_retention_days: e.target.checked ? 0 : 30
                            })} 
                            style={{ cursor: 'pointer' }}
                          />
                          <span>無制限</span>
                        </label>
                      </div>
                    </div>

                    {/* メッセージ保存件数 */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>メッセージ保存件数 (件)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          disabled={(currentFormPlan.msg_retention_count ?? 0) === 0}
                          value={(currentFormPlan.msg_retention_count ?? 0) === 0 ? '' : (currentFormPlan.msg_retention_count ?? 1000)} 
                          placeholder={(currentFormPlan.msg_retention_count ?? 0) === 0 ? '無制限' : '例: 1000'}
                          onChange={(e) => setFormPlan({...currentFormPlan, msg_retention_count: parseInt(e.target.value) || 0})} 
                          style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} 
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input 
                            type="checkbox" 
                            checked={(currentFormPlan.msg_retention_count ?? 0) === 0} 
                            onChange={(e) => setFormPlan({
                              ...currentFormPlan, 
                              msg_retention_count: e.target.checked ? 0 : 1000
                            })} 
                            style={{ cursor: 'pointer' }}
                          />
                          <span>無制限</span>
                        </label>
                      </div>
                    </div>

                    {/* DM・メディア許可 */}
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', gridColumn: 'span 2' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="checkbox" checked={currentFormPlan.dm_enabled === 1} onChange={(e) => setFormPlan({...currentFormPlan, dm_enabled: e.target.checked ? 1 : 0})} style={{ cursor: 'pointer' }} />
                        <span>DM機能を有効にする</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="checkbox" checked={currentFormPlan.media_enabled === 1} onChange={(e) => setFormPlan({...currentFormPlan, media_enabled: e.target.checked ? 1 : 0})} style={{ cursor: 'pointer' }} />
                        <span>メディア（ファイルアップロード）を許可</span>
                      </label>
                    </div>

                    {ENABLE_STRIPE_FEATURE && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', gridColumn: 'span 2', paddingTop: '16px', marginTop: '10px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#0ea5e9' }}>Stripe決済情報 (課金機能有効時)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Stripe Price ID</label>
                            <input type="text" placeholder="price_1H..." value={currentFormPlan.price_id || ''} onChange={(e) => setFormPlan({...currentFormPlan, price_id: e.target.value})} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>価格 (月額)</label>
                            <input type="number" value={currentFormPlan.price_amount ?? 0} onChange={(e) => setFormPlan({...currentFormPlan, price_amount: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>通貨</label>
                            <select value={currentFormPlan.price_currency || 'jpy'} onChange={(e) => setFormPlan({...currentFormPlan, price_currency: e.target.value})} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                              <option value="jpy">JPY (円)</option>
                              <option value="usd">USD (ドル)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                      <button type="button" onClick={() => { setIsNewPlanOpen(false); setEditingPlan(null); }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                      <button type="submit" style={{ padding: '8px 20px', background: '#0ea5e9', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        {isEdit ? '保存' : '作成'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* プラン一覧 */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                      <th style={{ padding: '12px 16px' }}>プランID</th>
                      <th style={{ padding: '12px 16px' }}>プラン名</th>
                      <th style={{ padding: '12px 16px' }}>メンバー制限</th>
                      <th style={{ padding: '12px 16px' }}>チャンネル制限</th>
                      <th style={{ padding: '12px 16px' }}>容量制限</th>
                      <th style={{ padding: '12px 16px' }}>機能制限・許可拡張子</th>
                      <th style={{ padding: '12px 16px' }}>メッセージ保存期間</th>
                      {ENABLE_STRIPE_FEATURE && <th style={{ padding: '12px 16px' }}>Stripe Price ID</th>}
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(plan => (
                      <tr key={plan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 'bold' }}>{plan.id}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#fff' }}>{plan.name}</td>
                        <td style={{ padding: '14px 16px' }}>{plan.member_limit >= 9999 ? '無制限' : `${plan.member_limit} 人`}</td>
                        <td style={{ padding: '14px 16px' }}>{plan.channel_limit >= 9999 ? '無制限' : `${plan.channel_limit} 個`}</td>
                        <td style={{ padding: '14px 16px' }}>{plan.storage_limit >= 9999999999 ? '無制限' : formatSize(plan.storage_limit)}</td>
                        <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>DM: <span style={{ color: plan.dm_enabled ? '#34d399' : '#f87171' }}>{plan.dm_enabled ? '許可' : '禁止'}</span> | メディア: <span style={{ color: plan.media_enabled ? '#34d399' : '#f87171' }}>{plan.media_enabled ? '許可' : '禁止'}</span></div>
                            {plan.allowed_extensions && <div style={{ color: '#64748b', fontSize: '11px' }}>許可: {plan.allowed_extensions}</div>}
                            <div style={{ color: '#64748b', fontSize: '11px' }}>最大ファイル容量: {plan.max_file_size_mb ?? 100}MB</div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#cbd5e1' }}>
                          <div>保存: {plan.msg_retention_days === 0 ? '無制限' : `${plan.msg_retention_days}日`}</div>
                          <div>件数: {plan.msg_retention_count === 0 ? '無制限' : `${plan.msg_retention_count}件`}</div>
                        </td>
                        {ENABLE_STRIPE_FEATURE && (
                          <td style={{ padding: '14px 16px' }}>
                            {plan.price_id ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{plan.price_id}</span>
                                <strong style={{ fontSize: '12px', color: '#10b981', marginTop: '2px' }}>{plan.price_amount.toLocaleString()} {plan.price_currency.toUpperCase()}/月</strong>
                              </div>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '12px' }}>未設定 (無料)</span>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => { setEditingPlan(plan); setIsNewPlanOpen(false); }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>編集</button>
                            {plan.id !== 'free' && plan.id !== 'sponsored' && plan.id !== 'community' && (
                              <button onClick={() => handleDeletePlan(plan.id)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>削除</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: 環境設定 */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>CoHive システム環境設定</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>SaaS全体のシステム設定、管理者アクセスパス、およびStripe決済の認証キーなどを設定します。</p>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* アクセス可能IPとカスタムパス */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>許可する管理者IPアドレスリスト（カンマ区切り）</label>
                      <input 
                        type="text" 
                        placeholder="例: 192.168.1.1, 203.0.113.50 (空欄で無制限)" 
                        value={allowedIps} 
                        onChange={(e) => setAllowedIps(e.target.value)} 
                        style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                      />
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>現在のあなたの接続元IP: <strong style={{ color: '#0ea5e9' }}>{clientIp || '取得中...'}</strong></span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>管理者用アクセス用URLパス名</label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', borderRight: 'none', borderRadius: '8px 0 0 8px', color: '#64748b', fontSize: '14px', userSelect: 'none' }}>{window.location.origin}/</span>
                        <input 
                          type="text" 
                          placeholder="admin" 
                          value={customPath} 
                          onChange={(e) => setCustomPath(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} 
                          required
                          style={{ flex: 1, padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '0 8px 8px 0', color: '#fff', fontSize: '14px' }} 
                        />
                      </div>
                      <span style={{ fontSize: '11px', color: '#e11d48', display: 'block', marginTop: '4px' }}>⚠️ 注意: パスを変更すると、現在のURLからは管理画面にアクセスできなくなります。</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>新規登録テナントへの初期割当プラン</label>
                      <select 
                        value={defaultSaasPlan} 
                        onChange={(e) => setDefaultSaasPlan(e.target.value)} 
                        style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', marginTop: '20px' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Stripe オンラインサブスクリプション決済を有効化</span>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>有効にすると、利用制限に達したテナントオーナーがセルフで決済し、即時制限解除できるようになります。</span>
                      </div>
                      <button type="button" onClick={() => setStripeEnabled(!stripeEnabled)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {stripeEnabled ? <ToggleRight size={40} style={{ color: '#0ea5e9' }} /> : <ToggleLeft size={40} style={{ color: '#64748b' }} />}
                      </button>
                    </div>
                  </div>

                  {/* Stripe決済鍵設定 */}
                  {stripeEnabled && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px', color: '#0ea5e9', fontWeight: 700 }}>Stripe API シークレット接続設定</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Stripe Secret Key (sk_live_... / sk_test_...)</label>
                          <input 
                            type="password" 
                            placeholder="sk_test_..." 
                            value={stripeSecretKey} 
                            onChange={(e) => setStripeSecretKey(e.target.value)} 
                            style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Stripe Publishable Key (pk_live_... / pk_test_...)</label>
                          <input 
                            type="text" 
                            placeholder="pk_test_..." 
                            value={stripePublishableKey} 
                            onChange={(e) => setStripePublishableKey(e.target.value)} 
                            style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Stripe Webhook Signing Secret (whsec_...)</label>
                        <input 
                          type="password" 
                          placeholder="whsec_..." 
                          value={stripeWebhookSecret} 
                          onChange={(e) => setStripeWebhookSecret(e.target.value)} 
                          style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContext: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '10px' }}>
                    <button type="submit" disabled={loading} style={{ background: '#0ea5e9', border: 'none', padding: '10px 24px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      {loading ? "保存中..." : "環境設定を保存"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3-2: メール設定 (SMTP) */}
          {activeTab === 'mail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>グローバルメール送信 (SMTP) 設定</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>管理者2段階認証コード(MFA)や、各種テナント通知、招待メールを安全に送信するためのメールサーバーを設定します。</p>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <form onSubmit={handleSaveSmtpSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>SMTP ホストアドレス (SMTP Host)</label>
                      <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>ポート (Port)</label>
                      <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>ユーザー名 (SMTP Auth)</label>
                      <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@example.com" required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>パスワード</label>
                      <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>送信者名 (From Display Name)</label>
                    <input type="text" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="CoHive Enterprise" required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>管理者ログイン時の2段階認証 (MFA) を有効にする</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>有効にすると、管理者ログイン時に確認コードが送信されます。設定が正常に動作することを確認してから有効にしてください。</span>
                    </div>
                    <button type="button" onClick={() => setSmtpMfaEnabled(!smtpMfaEnabled)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {smtpMfaEnabled ? <ToggleRight size={40} style={{ color: '#0ea5e9' }} /> : <ToggleLeft size={40} style={{ color: '#64748b' }} />}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContext: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', gap: '12px' }}>
                    <button type="button" onClick={handleDeleteSmtpSettings} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>設定クリア</button>
                    <button type="submit" disabled={loading} style={{ padding: '8px 20px', background: '#0ea5e9', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      {loading ? "保存中..." : "メール設定を保存"}
                    </button>
                  </div>
                </form>

                {/* メール送信テスト */}
                <div style={{ background: 'rgba(0, 0, 0, 0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px', marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#0ea5e9', fontWeight: 600 }}>接続テスト送信</h4>
                  <form onSubmit={handleTestSmtpSettings} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>テスト送信先メールアドレス</label>
                      <input type="email" value={smtpTestRecipient} onChange={(e) => setSmtpTestRecipient(e.target.value)} placeholder="test@example.com" required style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                    </div>
                    <button type="submit" disabled={loading || !smtpTestRecipient} style={{ padding: '6px 16px', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', color: '#0ea5e9', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', height: '30px' }}>
                      テスト送信
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 監査ログ */}
          {activeTab === 'audit_logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 🔒 案内バッジの動的切り替え */}
              {isSponsored ? (
                /* スポンサー版：無制限解除プレミアムバナー */
                <div style={{
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(147, 51, 234, 0.1) 100%)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  fontSize: '13px',
                  color: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
                    <div style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'rgba(217, 119, 6, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sparkles size={18} color="#d97706" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>スポンサー版: 全社監査ログ制限解除済み</span>
                        <span style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(217, 119, 6, 0.3)', color: '#fbbf24', borderRadius: '4px', fontWeight: 700 }}>PRO</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        ご支援ありがとうございます！GitHubスポンサー特典により、全社監査ログは全期間無制限で保存され検索可能です。
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 通常版：7日間制限プロモーション案内バッジ */
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
                  color: '#f8fafc'
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
                        <span>コミュニティ版: 直近7日間の全社監査ログを表示中</span>
                        <span style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', borderRadius: '4px', fontWeight: 700 }}>FREE</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        7日以上前の過去ログ検索・長期保存は GitHub スポンサー登録で無制限解放されます。
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
                    <span>GitHub Sponsor で解放</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* タイトルとCSV・更新ボタン */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>システム監査ログダッシュボード</h2>
                  <span style={{ fontSize: '12px', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: '12px', border: '1px solid #334155' }}>
                    {filteredAuditLogs.length} / {auditLogs.length} 件
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={handleRefreshAuditLogs}
                    disabled={isRefreshingAuditLogs}
                    title="監査ログを最新状態に更新"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      borderRadius: '6px',
                      color: '#0ea5e9',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isRefreshingAuditLogs ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: isRefreshingAuditLogs ? 'spin 1s linear infinite' : 'none' }} />
                    <span>最新情報に更新</span>
                  </button>
                  <button 
                    onClick={handleExportAuditLogs} 
                    disabled={filteredAuditLogs.length === 0} 
                    style={{ 
                      padding: '8px 16px', 
                      background: filteredAuditLogs.length === 0 ? 'rgba(148, 163, 184, 0.1)' : 'rgba(16, 185, 129, 0.15)', 
                      border: `1px solid ${filteredAuditLogs.length === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(16, 185, 129, 0.3)'}`, 
                      color: filteredAuditLogs.length === 0 ? '#64748b' : '#34d399', 
                      borderRadius: '6px', 
                      fontSize: '13px', 
                      fontWeight: 600,
                      cursor: filteredAuditLogs.length === 0 ? 'not-allowed' : 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px' 
                    }}
                  >
                    <Download size={14} />
                    <span>CSV出力</span>
                  </button>
                </div>
              </div>

              {/* 絞り込みコントロールパネル */}
              <div style={{
                padding: '14px',
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {/* 行1: フリーワード検索 + アクションマルチセレクト */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* フリーワード検索 */}
                  <div style={{ flex: '1 1 240px', position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input 
                      type="text" 
                      placeholder="ユーザー、テナント、アクション、IP、詳細で検索..." 
                      value={auditSearchQuery} 
                      onChange={(e) => setAuditSearchQuery(e.target.value)} 
                      style={{ width: '100%', padding: '8px 12px 8px 30px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '13px', height: '36px' }}
                    />
                    {auditSearchQuery && (
                      <X 
                        size={14} 
                        onClick={() => setAuditSearchQuery('')} 
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }} 
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
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Filter size={14} color="#94a3b8" />
                        <span>
                          {selectedActions.length === 0
                            ? 'すべてのアクション'
                            : `選択中 (${selectedActions.length}件)`}
                        </span>
                      </div>
                      <ChevronDown size={14} color="#94a3b8" />
                    </button>

                    {/* ドロップダウンメニュー */}
                    {isActionDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '40px',
                        left: 0,
                        right: 0,
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                        zIndex: 50,
                        maxHeight: '220px',
                        overflowY: 'auto',
                        padding: '6px'
                      }}>
                        <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>アクション種別で絞り込み</span>
                          {selectedActions.length > 0 && (
                            <span onClick={() => setSelectedActions([])} style={{ color: '#38bdf8', cursor: 'pointer' }}>
                              解除
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
                                  background: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
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
                                {isSelected && <Check size={14} color="#38bdf8" />}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: '8px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                            選択可能なアクションがありません
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 行2: 日時範囲指定（From / To） */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                  <Calendar size={14} />
                  <span>期間指定:</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 280px' }}>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    style={{ fontSize: '12px', height: '34px', padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', flex: 1 }}
                    title="開始日（〜から）"
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>〜</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    style={{ fontSize: '12px', height: '34px', padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', flex: 1 }}
                    title="終了日（〜まで）"
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
                      color: '#f87171',
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
                    <span>絞り込み解除</span>
                  </button>
                )}
              </div>

              {/* 選択されたアクション of チップ表示 */}
              {selectedActions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>選択中のアクション:</span>
                  {selectedActions.map(act => (
                    <span
                      key={act}
                      onClick={() => toggleActionFilter(act)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
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
              {!isSponsored && isBefore7DaysSelected && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>
                    コミュニティ版の保持期間（7日間）を超える開始日が指定されています。7日以上前の全過去ログ表示には GitHub スポンサー登録が必要です。
                  </span>
                </div>
              )}

              {/* 監査ログ一覧テーブル (アコーディオン詳細展開対応) */}
              <div style={{ border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden', background: '#0f172a', padding: '16px' }}>
                <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', position: 'sticky', top: 0, background: '#0f172a' }}>
                        <th style={{ padding: '10px 12px' }}>タイムスタンプ</th>
                        <th style={{ padding: '10px 12px' }}>テナント</th>
                        <th style={{ padding: '10px 12px' }}>操作ユーザー</th>
                        <th style={{ padding: '10px 12px' }}>アクション</th>
                        <th style={{ padding: '10px 12px' }}>グローバルIP</th>
                        <th style={{ padding: '10px 12px' }}>ローカルIP</th>
                        <th style={{ padding: '10px 12px' }}>コンピュータ名</th>
                        <th style={{ padding: '10px 12px' }}>詳細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditLogs.length > 0 ? (
                        filteredAuditLogs.map(log => {
                          const badge = getActionBadgeStyle(log.action);
                          const isExpanded = expandedLogId === log.id;
                          const hasDetails = Boolean(log.details);

                          const toggleExpandLog = (logId: string) => {
                            setExpandedLogId(prev => prev === logId ? null : logId);
                          };

                          return (
                            <React.Fragment key={log.id}>
                              <tr 
                                onClick={() => hasDetails && toggleExpandLog(log.id)}
                                style={{ 
                                  borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.03)', 
                                  color: '#cbd5e1', 
                                  cursor: hasDetails ? 'pointer' : 'default',
                                  background: isExpanded ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
                                  transition: 'background-color 0.15s ease' 
                                }}
                              >
                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>{formatLocalDateTime(log.created_at, true)}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#38bdf8' }}>{log.workspaceName || 'SYSTEM'}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{log.userName || 'SYSTEM'}</span>
                                    {log.isSaaSAdmin === 1 && (
                                      <span style={{
                                        fontSize: '9px',
                                        padding: '1px 5px',
                                        background: 'rgba(14, 165, 233, 0.15)',
                                        color: '#38bdf8',
                                        borderRadius: '4px',
                                        fontWeight: 'bold'
                                      }}>管理者</span>
                                    )}
                                  </div>
                                </td>
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
                                <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{log.ip_address || '-'}</td>
                                <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{log.local_ip || '-'}</td>
                                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{log.computer_name || '-'}</td>
                                <td 
                                  style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                >
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details}</span>
                                  {hasDetails && (isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                </td>
                              </tr>
                              {/* アコーディオン詳細表示 */}
                              {isExpanded && hasDetails && (
                                <tr style={{ background: 'rgba(56, 189, 248, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td colSpan={8} style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '6px', fontSize: '11px' }}>
                                      イベント詳細データ:
                                    </div>
                                    <pre style={{
                                      margin: 0,
                                      padding: '10px',
                                      background: '#090d16',
                                      color: '#f8fafc',
                                      borderRadius: '6px',
                                      fontFamily: 'monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-all',
                                      fontSize: '11px',
                                      border: '1px solid #334155'
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
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>条件に合致する監査ログはありません。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: 全体告知管理 */}
          {activeTab === 'announcements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>全体告知（アナウンス）管理</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    全利用者の画面最上部にリアルタイム表示する一斉告知（メンテナンス・アップデート・緊急連絡）を作成・管理します。
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleOpenCreateModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      background: '#0ea5e9',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(14, 165, 233, 0.3)'
                    }}
                  >
                    <Plus size={15} />
                    <span>+ 新規一斉告知を発行</span>
                  </button>
                  <button
                    onClick={loadAnnouncements}
                    title="告知一覧を更新"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      borderRadius: '6px',
                      color: '#0ea5e9',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>最新情報に更新</span>
                  </button>
                </div>
              </div>

              {/* 過去の告知一覧 */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700 }}>告知履歴・配信ステータス</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>重要度</th>
                        <th style={{ padding: '12px 16px' }}>タイトル</th>
                        <th style={{ padding: '12px 16px' }}>メッセージ本文</th>
                        <th style={{ padding: '12px 16px' }}>掲載期間</th>
                        <th style={{ padding: '12px 16px' }}>ステータス</th>
                        <th style={{ padding: '12px 16px' }}>作成日時</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {announcements.length > 0 ? (
                        announcements.map(ann => {
                          const isCritical = ann.type === 'critical';
                          const isWarning = ann.type === 'warning';
                          const typeLabel = isCritical ? '緊急' : isWarning ? '重要' : '通常';
                          const typeBg = isCritical ? 'rgba(239, 68, 68, 0.2)' : isWarning ? 'rgba(245, 158, 11, 0.2)' : 'rgba(14, 165, 233, 0.2)';
                          const typeColor = isCritical ? '#f87171' : isWarning ? '#fbbf24' : '#38bdf8';
                          const isActive = ann.isActive === 1 || ann.isActive === true || ann.is_active === 1 || ann.is_active === true;

                          const now = new Date().getTime();
                          const startVal = ann.startAt || ann.start_at;
                          const endVal = ann.endAt || ann.end_at;
                          const startTime = startVal ? new Date(startVal).getTime() : null;
                          const endTime = endVal ? new Date(endVal).getTime() : null;

                          let statusLabel = '○ 非公開';
                          let statusBg = 'rgba(100, 116, 139, 0.2)';
                          let statusColor = '#94a3b8';

                          if (isActive) {
                            if (startTime && startTime > now) {
                              statusLabel = '⏰ 予約中';
                              statusBg = 'rgba(245, 158, 11, 0.15)';
                              statusColor = '#fbbf24';
                            } else if (endTime && endTime < now) {
                              statusLabel = '✖ 期間終了';
                              statusBg = 'rgba(239, 68, 68, 0.15)';
                              statusColor = '#f87171';
                            } else {
                              statusLabel = '● 配信中';
                              statusBg = 'rgba(34, 197, 94, 0.15)';
                              statusColor = '#4ade80';
                            }
                          }

                          const displayPeriod = `${startVal ? new Date(startVal).toLocaleString('ja-JP') : '即時'} ～ ${endVal ? new Date(endVal).toLocaleString('ja-JP') : '無期限'}`;

                          return (
                            <tr key={ann.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: typeBg, color: typeColor }}>
                                  {typeLabel}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', fontWeight: 600, color: '#f8fafc' }}>{ann.title}</td>
                              <td style={{ padding: '14px 16px', color: '#94a3b8', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ann.content}>
                                {ann.content || '(本文なし)'}
                              </td>
                              <td style={{ padding: '14px 16px', color: '#cbd5e1', fontSize: '12px' }}>
                                {displayPeriod}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  background: statusBg,
                                  color: statusColor
                                }}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', color: '#64748b' }}>{formatLocalDateTime(ann.created_at || ann.createdAt, true)}</td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    onClick={() => handleOpenEditModal(ann)}
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.15)',
                                      border: '1px solid rgba(59, 130, 246, 0.3)',
                                      color: '#60a5fa',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Edit3 size={13} />
                                    <span>編集</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAnnouncement(ann.id)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      color: '#f87171',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    削除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>告知データが登録されていません。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 配信作成/編集用モーダル */}
              {isAnnModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                  <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', width: '100%', maxWidth: '580px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                        {annModalMode === 'create' ? '新規一斉告知の発行' : '一斉告知の編集'}
                      </h3>
                      <button onClick={() => setIsAnnModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}><X size={18} /></button>
                    </div>

                    {annFormError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
                        ⚠️ {annFormError}
                      </div>
                    )}

                    <form onSubmit={handleAnnFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>配信ステータス</span>
                        <span 
                          onClick={() => setAnnFormIsActive(!annFormIsActive)} 
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            background: annFormIsActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: annFormIsActive ? '#4ade80' : '#94a3b8',
                            border: `1px solid ${annFormIsActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
                          }}
                        >
                          {annFormIsActive ? '● 公開中' : '○ 非公開(下書き)'}
                        </span>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>告知タイトル *</label>
                        <input
                          type="text"
                          placeholder="例: 【メンテナンス通知】7月30日 2:00〜4:00 サービス停止のお知らせ"
                          value={annFormTitle}
                          onChange={e => setAnnFormTitle(e.target.value)}
                          required
                          style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>重要度 (通知タイプ)</label>
                        <select
                          value={annFormType}
                          onChange={e => setAnnFormType(e.target.value as any)}
                          style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
                        >
                          <option value="info">通常 (青色 - お知らせ)</option>
                          <option value="warning">重要 (黄色 - メンテナンス等)</option>
                          <option value="critical">緊急 (赤色 - 障害・緊急連絡)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>メッセージ本文 (任意)</label>
                        <textarea
                          placeholder="【任意】詳細ダイアログに表示するメッセージ本文を入力してください。"
                          value={annFormContent}
                          onChange={e => setAnnFormContent(e.target.value)}
                          rows={3}
                          style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ background: '#1e293b', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>📅 掲載期間の設定</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>掲載開始日時 (空欄で即時)</label>
                            <input
                              type="datetime-local"
                              value={annFormStartAt}
                              onChange={e => setAnnFormStartAt(e.target.value)}
                              style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>掲載終了日時 (空欄で無期限)</label>
                            <input
                              type="datetime-local"
                              value={annFormEndAt}
                              onChange={e => setAnnFormEndAt(e.target.value)}
                              style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          💡 掲載ルール: <b>両方未入力</b> → 即時〜無期限 | <b>開始日時のみ</b> → 指定開始日時〜無期限 | <b>両方入力</b> → 期間限定配信
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
                          disabled={annFormSubmitting}
                          style={{ padding: '8px 20px', background: '#0ea5e9', border: 'none', color: '#fff', borderRadius: '6px', cursor: annFormSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {annFormSubmitting ? <Loader className="animate-spin" size={14} /> : annModalMode === 'create' ? <Plus size={15} /> : <Save size={14} />}
                          <span>{annModalMode === 'create' ? '一斉告知を発行' : '変更を保存'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: 管理者管理（管理者アカウント） */}
          {activeTab === 'admins' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>プラットフォーム統括管理者アカウント</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    システム全体の運営にアクセスできる管理者アカウントの管理を行います。
                  </p>
                </div>
                <button
                  onClick={handleRefreshAdmins}
                  disabled={isRefreshingAdmins}
                  title="管理者一覧を最新状態に更新"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: 'rgba(14, 165, 233, 0.1)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: '6px',
                    color: '#0ea5e9',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isRefreshingAdmins ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <RefreshCw size={14} style={{ animation: isRefreshingAdmins ? 'spin 1s linear infinite' : 'none' }} />
                  <span>最新情報に更新</span>
                </button>
              </div>

              {/* 管理者追加 (owner のみ) */}
              {adminUser?.role === 'owner' && (
                <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#10b981' }}>管理者の追加登録</h3>
                  <form onSubmit={handleCreateAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>表示名</label>
                        <input type="text" placeholder="例: 運営管理者B" value={newAdminDisplayName} onChange={(e) => setNewAdminDisplayName(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>メールアドレス</label>
                        <input type="email" placeholder="admin2@example.com" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>初期パスワード</label>
                        <input type="password" placeholder="••••••••" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
                      </div>
                      <button type="submit" disabled={loading} style={{ background: '#10b981', border: 'none', padding: '9px 20px', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', height: '37px' }}>
                        {loading ? "登録中..." : "管理者を追加"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 管理者一覧テーブル */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700 }}>管理者アカウント一覧</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                        <th style={{ padding: '12px 16px' }}>表示名</th>
                        <th style={{ padding: '12px 16px' }}>メールアドレス</th>
                        <th style={{ padding: '12px 16px' }}>ロール</th>
                        <th style={{ padding: '12px 16px' }}>作成日時</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminAccounts.length > 0 ? (
                        adminAccounts.map(account => {
                          const isSelf = account.id === adminUser?.id;
                          const isOwner = account.role === 'owner';
                          const iAmOwner = adminUser?.role === 'owner';

                          return (
                            <tr key={account.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{account.displayName || account.display_name}</span>
                                  {isSelf && (
                                    <span style={{ fontSize: '9px', background: 'rgba(14, 165, 233, 0.2)', color: '#0ea5e9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>自分</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px' }}>{account.email}</td>
                              <td style={{ padding: '14px 16px' }}>
                                {iAmOwner && !isSelf ? (
                                  <select
                                    value={account.role}
                                    onChange={(e) => {
                                      const newRole = e.target.value;
                                      if (newRole === 'owner') {
                                        handleTransferOwnershipSubmit(account.id, account.displayName || account.display_name);
                                      }
                                    }}
                                    disabled={loading}
                                    style={{
                                      padding: '4px 8px',
                                      background: '#0f172a',
                                      border: '1px solid #334155',
                                      borderRadius: '6px',
                                      color: '#fff',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <option value="admin">管理者 (admin)</option>
                                    <option value="owner">オーナー (owner)</option>
                                  </select>
                                ) : (
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: isOwner ? '#e0f2fe' : '#f0fdf4',
                                    background: isOwner ? 'rgba(14, 165, 233, 0.2)' : 'rgba(34, 197, 94, 0.2)'
                                  }}>
                                    {isOwner ? "オーナー (owner)" : "管理者 (admin)"}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px', color: '#64748b' }}>{formatLocalDateTime(account.createdAt || account.created_at, true)}</td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                  {/* 編集ボタン */}
                                  {(iAmOwner || isSelf) && (
                                    <button
                                      onClick={() => openEditModal(account)}
                                      disabled={loading}
                                      style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      編集
                                    </button>
                                  )}
                                  
                                  {!isSelf && !isOwner && (
                                    <button
                                      onClick={() => handleDeleteAdmin(account.id)}
                                      disabled={loading}
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#f87171',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>管理者アカウントが見つかりませんでした。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 管理者アカウント編集モーダル */}
      {editingAdmin && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(4px)', 
          zIndex: 1000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setEditingAdmin(null)}>
          <div style={{ 
            background: '#1e293b', 
            border: '1px solid rgba(255,255,255,0.08)', 
            borderRadius: '16px', 
            width: '100%', 
            maxWidth: '440px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                {editingAdmin.id === adminUser?.id ? "プロフィール設定" : "管理者情報の編集"}
              </h3>
              <button onClick={() => setEditingAdmin(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleUpdateAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>表示名</label>
                <input type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} required style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>メールアドレス</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>新しいパスワード（変更する場合のみ入力）</label>
                <input type="password" placeholder="••••••••" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setEditingAdmin(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                <button type="submit" disabled={loading} style={{ padding: '8px 20px', background: '#0ea5e9', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  {loading ? "保存中..." : "変更を保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
