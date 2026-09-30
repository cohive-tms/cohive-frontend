import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, Loader, AlertCircle } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useLanguage } from '../utils/i18n';

interface PushNotificationBannerProps {
  onSubscriptionChange?: (enabled: boolean) => void;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({ onSubscriptionChange }) => {
  const { t } = useLanguage();
  const isEn = t('error') === 'Error';

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState(false);

  useEffect(() => {
    // 1. ブラウザの対応チェック
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }

    // 2. 既に通知許可済みの場合は表示しない
    if (Notification.permission === 'granted') {
      // 購読状態を確認
      navigator.serviceWorker.ready.then(async (registration) => {
        try {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            onSubscriptionChange?.(true);
            return;
          }
          // 許可されているがサブスクリプションが未作成の場合は表示
          checkDismissState();
        } catch {
          checkDismissState();
        }
      }).catch(() => {});
      return;
    }

    // 3. 拒否されている場合は無理に出さず、静かに非表示
    if (Notification.permission === 'denied') {
      return;
    }

    // 4. 「後で」で非表示にされた期間のチェック (3日間非表示)
    checkDismissState();
  }, []);

  const checkDismissState = () => {
    try {
      const dismissedUntil = localStorage.getItem('cohive_push_banner_dismissed_until');
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return;
      }
    } catch {
      // ignore
    }
    setVisible(true);
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      // 3日間再表示しない
      const threeDaysLater = Date.now() + 3 * 24 * 60 * 60 * 1000;
      localStorage.setItem('cohive_push_banner_dismissed_until', threeDaysLater.toString());
    } catch {
      // ignore
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleEnablePush = async () => {
    setLoading(true);
    setDeniedMessage(false);

    try {
      // 1. ユーザー操作イベントのコンテキストで通知許可を要求
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setDeniedMessage(true);
        setLoading(false);
        return;
      }

      // 2. Service Worker の登録と待機
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 既存の古い購読があれば一旦解除
      try {
        const activeSub = await registration.pushManager.getSubscription();
        if (activeSub) {
          await activeSub.unsubscribe();
        }
      } catch (subErr) {
        console.warn('Failed to unsubscribe existing push:', subErr);
      }

      // 3. VAPID 公開鍵の取得
      const { publicKey } = await apiClient.get<{ publicKey: string }>('/api/push/vapid-public-key');
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      // 4. ブラウザで Push 購読を作成
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // 5. バックエンドの D1 にエンドポイント情報を保存
      const subJson = subscription.toJSON();
      await apiClient.post('/api/push/subscribe', {
        subscription: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth
          }
        }
      });

      onSubscriptionChange?.(true);
      setSuccess(true);

      // 2.5秒後に自動的にバナーを閉じる
      setTimeout(() => {
        setVisible(false);
      }, 2500);

    } catch (err: any) {
      console.error('Failed to enable push notifications:', err);
      alert((isEn ? 'Failed to setup push notifications: ' : 'プッシュ通知の設定に失敗しました: ') + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(14, 165, 233, 0.16) 0%, rgba(99, 102, 241, 0.16) 100%)',
      borderBottom: '1px solid rgba(14, 165, 233, 0.35)',
      backdropFilter: 'blur(12px)',
      padding: '10px 20px',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      zIndex: 9000,
      position: 'relative',
      fontSize: '13px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{
          background: success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(14, 165, 233, 0.2)',
          color: success ? '#10b981' : '#38bdf8',
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {success ? <CheckCircle2 size={18} /> : <Bell size={18} />}
        </div>
        <div style={{ lineHeight: '1.4' }}>
          {success ? (
            <span style={{ color: '#34d399', fontWeight: 600 }}>
              {isEn ? 'Push notifications enabled! You will receive real-time updates.' : 'プッシュ通知が有効化されました！リアルタイム通知をお届けします。'}
            </span>
          ) : deniedMessage ? (
            <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={15} />
              {isEn
                ? 'Notifications were blocked. Please click the lock icon in the address bar to allow notifications.'
                : '通知が拒否されました。ブラウザのアドレスバー（鍵アイコン）から通知を許可してください。'}
            </span>
          ) : (
            <span>
              <strong>{isEn ? 'Enable Notifications' : 'デスクトップ通知を有効化'}:</strong>{' '}
              {isEn
                ? 'Get notified in real-time even when CoHive is running in the background.'
                : 'バックグラウンドでも新着メッセージをリアルタイムで確実に受け取れます。'}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {!success && !deniedMessage && (
          <button
            onClick={handleEnablePush}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.filter = 'brightness(1.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            {loading ? <Loader size={13} className="animate-spin" /> : <Bell size={13} />}
            {isEn ? 'Enable Now' : '今すぐ有効化'}
          </button>
        )}

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#f1f5f9'}
          onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
          title={isEn ? 'Dismiss' : '後で'}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
