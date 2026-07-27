let cachedLocalIp: string | null = null;
let cachedComputerName: string | null = null;

export async function getLocalIp(): Promise<string> {
  if (cachedLocalIp) return cachedLocalIp;
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cachedLocalIp = "192.168.1.100";
          resolve(cachedLocalIp);
        }
      }, 500);

      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cachedLocalIp = "192.168.1.100";
            resolve(cachedLocalIp);
          }
          return;
        }
        const candidate = ice.candidate.candidate;
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})|([a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})|([a-zA-Z0-9-]+\.local)/;
        const match = ipRegex.exec(candidate);
        if (match) {
          resolved = true;
          clearTimeout(timeout);
          cachedLocalIp = match[0];
          resolve(cachedLocalIp);
          pc.close();
        }
      };
    } catch (e) {
      cachedLocalIp = "192.168.1.100";
      resolve(cachedLocalIp);
    }
  });
}

export function getComputerName(): string {
  if (cachedComputerName) return cachedComputerName;
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("cohive_device_name");
    if (saved) {
      cachedComputerName = saved;
      return saved;
    }
  }

  if (typeof window === "undefined") {
    return "Server-Side";
  }

  const ua = navigator.userAgent;
  let os = "UnknownOS";
  if (ua.indexOf("Win") !== -1) os = "Windows";
  else if (ua.indexOf("Mac") !== -1) os = "macOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("like Mac") !== -1) os = "iOS";

  let browser = "Browser";
  if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("Safari") !== -1) browser = "Safari";
  else if (ua.indexOf("Edge") !== -1) browser = "Edge";

  const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  cachedComputerName = `${os}-${browser}-${randomId}`;
  
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("cohive_device_name", cachedComputerName);
  }
  return cachedComputerName;
}

// 初期実行でキャッシュを開始
if (typeof window !== "undefined") {
  getLocalIp();
}

export interface RequestOptions extends RequestInit {
  /** クエリパラメータとして付与するキーバリュー */
  params?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Cloudflare Workers (API側) と通信するための Fetch ベースの共通クライアント。
 */
export class ApiClient {
  private baseUrl: string;
  private currentWorkspaceId: string | null = null;
  private currentUserId: string | null = null;
  private currentToken: string | null = null;

  // サイレントリフレッシュ制御用の変数
  private isRefreshing = false;
  private refreshSubscribers: {
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((sub) => sub.resolve(token));
    this.refreshSubscribers = [];
  }

  private onTokenRefreshFailed(error: any) {
    this.refreshSubscribers.forEach((sub) => sub.reject(error));
    this.refreshSubscribers = [];
  }

  /**
   * Cookie (HttpOnly) を使用してアクセストークンをサイレントリフレッシュします。
   */
  async refreshAccessToken(): Promise<any> {
    const base = this.baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const url = new URL("/api/auth/refresh", base);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to refresh session");
    }

    const responseData = await response.json() as any;
    if (responseData.success && responseData.data?.token) {
      const newToken = responseData.data.token;
      this.setToken(newToken);
      return responseData.data;
    }

    throw new Error("No token returned from refresh API");
  }

  /**
   * 現在切り替えている他社または自社のワークスペース（D1テナント）IDをセットします。
   * 以降、すべてのリクエストヘッダーに 'X-Workspace-Id' として自動的に付与されます。
   */
  setWorkspaceId(workspaceId: string | null) {
    this.currentWorkspaceId = workspaceId;
    if (workspaceId) {
      localStorage.setItem("selected_workspace_id", workspaceId);
    } else {
      localStorage.removeItem("selected_workspace_id");
    }
  }

  getWorkspaceId(): string | null {
    if (!this.currentWorkspaceId) {
      this.currentWorkspaceId = localStorage.getItem("selected_workspace_id");
    }
    return this.currentWorkspaceId;
  }

  /**
   * ログインしているユーザーのIDをセットします。
   * 以降、すべてのリクエストヘッダーに 'X-User-Id' として自動的に付与されます。
   */
  setUserId(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
      localStorage.setItem("selected_user_id", userId);
    } else {
      localStorage.removeItem("selected_user_id");
    }
  }

  getUserId(): string | null {
    if (!this.currentUserId) {
      this.currentUserId = localStorage.getItem("selected_user_id");
    }
    return this.currentUserId;
  }

  /**
   * JWT認証トークンをセットします（メモリ保持のみに移行し、localStorageには保存しません）。
   * 以降、すべてのリクエストヘッダーに 'Authorization: Bearer <token>' として自動的に付与されます。
   */
  setToken(token: string | null) {
    this.currentToken = token;
  }

  getToken(): string | null {
    return this.currentToken;
  }

  /**
   * 共通のHTTPリクエスト処理
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...restOptions } = options;

    // 1. クエリパラメータを含めたURLの構築
    const base = this.baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const url = new URL(endpoint, base);
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      });
    }

    // 2. ヘッダーの処理
    const requestHeaders = new Headers(headers);
    
    // ボディが FormData でない場合、デフォルトで application/json を指定
    if (!requestHeaders.has("Content-Type") && !(restOptions.body instanceof FormData)) {
      requestHeaders.set("Content-Type", "application/json");
    }

    // マルチテナント対応: ターゲットのワークスペースIDをヘッダーにセット
    const wId = this.getWorkspaceId();
    if (wId) {
      requestHeaders.set("X-Workspace-Id", wId);
    }

    const uId = this.getUserId();
    if (uId) {
      requestHeaders.set("X-User-Id", uId);
    }

    const token = this.getToken();
    if (token && !requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    // ローカルIPとコンピュータ名を設定
    const localIp = typeof window !== "undefined" ? (cachedLocalIp || "192.168.1.100") : "";
    const compName = typeof window !== "undefined" ? getComputerName() : "";
    if (localIp) {
      requestHeaders.set("X-Local-Ip", localIp);
    }
    if (compName) {
      requestHeaders.set("X-Computer-Name", compName);
    }

    const config: RequestInit = {
      ...restOptions,
      headers: requestHeaders,
      credentials: "include", // Cookie (HttpOnly) の送信を許可
    };

    try {
      const response = await fetch(url.toString(), config);

      // 401 Unauthorizedのとき、サイレントリフレッシュを試みる
      if (
        response.status === 401 &&
        endpoint !== "/api/auth/refresh" &&
        endpoint !== "/api/auth/login" &&
        endpoint !== "/api/auth/recovery" &&
        !endpoint.startsWith("/api/admin/")
      ) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const refreshData = await this.refreshAccessToken();
            const newToken = typeof refreshData === "string" ? refreshData : refreshData.token;
            this.isRefreshing = false;
            this.onTokenRefreshed(newToken);
          } catch (refreshErr) {
            this.isRefreshing = false;
            this.setToken(null);
            this.onTokenRefreshFailed(refreshErr);
            // グローバルにログアウトを通知するイベントを発火
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("auth:logout"));
            }
            throw new ApiError("Session expired. Please log in again.", 401);
          }
        }

        // リフレッシュが完了するまで待機し、新しいトークンでリクエストを再試行する
        return new Promise<T>((resolve, reject) => {
          this.refreshSubscribers.push({
            resolve: (newToken) => {
              requestHeaders.set("Authorization", `Bearer ${newToken}`);
              this.request<T>(endpoint, { ...options, headers: requestHeaders })
                .then(resolve)
                .catch(reject);
            },
            reject: (err) => {
              reject(err);
            }
          });
        });
      }
      
      // レスポンスの解析
      let responseData: any = null;
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // エラー時のハンドリング
      if (!response.ok) {
        if (response.status === 403 && responseData?.error && (responseData.error.includes("suspended") || responseData.error.includes("suspended"))) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("workspace:suspended"));
          }
        }
        throw new ApiError(
          responseData?.error || `API request failed with status ${response.status}`,
          response.status,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Network connection failed",
        0
      );
    }
  }

  // GET ショートカット
  get<T>(endpoint: string, params?: Record<string, string>, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", params, ...options });
  }

  // POST ショートカット
  post<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
      ...options,
    });
  }

  // PUT ショートカット
  put<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: "PUT",
      body: isFormData ? body : JSON.stringify(body),
      ...options,
    });
  }

  // DELETE ショートカット
  delete<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  /**
   * ワークスペースのプランと制限情報（サブスクリプション）を取得します。
   */
  async getWorkspaceSubscription(workspaceId: string): Promise<{
    plan: string;
    planName?: string;
    status?: string;
    storageLimit: number;
    storageUsed: number;
    memberLimit: number;
    memberUsed: number;
    channelLimit: number;
    channelUsed: number;
    dmEnabled?: boolean;
    mediaEnabled?: boolean;
    allowedExtensions?: string;
    maxFileSizeMb?: number;
    forbiddenExtensions?: string;
    msgRetentionDays?: number;
    msgRetentionCount?: number;
  }> {
    const response = await this.get<{
      success: boolean;
      data: {
        plan: string;
        planName?: string;
        status?: string;
        storageLimit: number;
        storageUsed: number;
        memberLimit: number;
        memberUsed: number;
        channelLimit: number;
        channelUsed: number;
        dmEnabled?: boolean;
        mediaEnabled?: boolean;
        allowedExtensions?: string;
        maxFileSizeMb?: number;
        forbiddenExtensions?: string;
        msgRetentionDays?: number;
        msgRetentionCount?: number;
      };
    }>(`/api/workspaces/${workspaceId}/subscription`);
    return response.data;
  }

  /**
   * 未読の通知件数を取得します。
   */
  async getUnreadNotificationsCount(): Promise<number> {
    const response = await this.get<{
      success: boolean;
      unreadCount: number;
    }>("/api/notifications/unread-count");
    return response.unreadCount;
  }
}

// シングルトンインスタンスのエクスポート (Pages Functions のため、デフォルトは同一オリジンの相対パスになります)
export const apiClient = new ApiClient(
  (import.meta as any).env?.VITE_API_BASE_URL || ""
);
