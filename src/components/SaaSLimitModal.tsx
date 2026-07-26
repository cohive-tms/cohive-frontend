import React from 'react';
import { X, ShieldAlert, Sparkles } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

interface SaaSLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: 'channel' | 'workspace' | 'member' | 'storage' | null;
  limitValue?: number | string;
  onGoToSubscription?: () => void;
}

export const SaaSLimitModal: React.FC<SaaSLimitModalProps> = ({
  isOpen,
  onClose,
  limitType,
  limitValue,
  onGoToSubscription,
}) => {
  const { t } = useLanguage();

  if (!isOpen || !limitType) return null;

  const isEn = t('error') === 'Error';

  let title = isEn ? "Plan Limit Reached" : "プラン制限に達しました";
  let description = "";

  if (limitType === 'channel') {
    description = isEn
      ? `You have reached the channel limit for the Free Plan (max ${limitValue || 3} channels).`
      : `初期(Free)プランのチャンネル作成数上限（最大 ${limitValue || 3} 個）に達しました。`;
  } else if (limitType === 'workspace') {
    description = isEn
      ? `You have reached the workspace limit for the Free Plan (max ${limitValue || 3} workspaces).`
      : `初期(Free)プランのワークスペース作成数上限（最大 ${limitValue || 3} 個）に達しました。`;
  } else if (limitType === 'member') {
    description = isEn
      ? `You have reached the member limit for the Free Plan (max ${limitValue || 5} members).`
      : `初期(Free)プランのワークスペースメンバー数上限（最大 ${limitValue || 5} 人）に達しました。`;
  } else if (limitType === 'storage') {
    description = isEn
      ? `You have reached the storage limit for the Free Plan (max ${limitValue || '50MB'}).`
      : `初期(Free)プランのストレージ容量上限（最大 ${limitValue || '50MB'}）に達しました。`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content settings-modal" 
        style={{ 
          maxWidth: '460px', 
          width: '90%', 
          overflow: 'hidden'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ borderBottom: 'none', padding: '20px 24px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={22} style={{ color: 'var(--accent-primary, #0ea5e9)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body" style={{ padding: '10px 24px 24px' }}>
          <p style={{ 
            fontSize: '14px', 
            lineHeight: '1.6', 
            color: 'var(--text-muted, #9ca3af)', 
            marginBottom: '20px' 
          }}>
            {description}
            <br />
            {isEn 
              ? "To create more resources or unlock limits, please consider changing to a higher plan."
              : "制限を解除してより多くのリソースを作成するには、上位プランへの変更申請をご検討ください。"}
          </p>

          {/* 上位プラン案内カード */}
          <div className="saas-upgrade-card" style={{ 
            margin: '0 0 8px 0', 
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(14, 165, 233, 0.1) 100%)',
            border: '1px solid var(--accent-primary, rgba(14, 165, 233, 0.3))',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary, #0ea5e9)' }} />
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isEn ? "Higher Plans Available" : "上位プランへの変更申請"}
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
              {isEn 
                ? "Unlock unlimited channels, workspaces, larger storage, and advanced features by requesting a plan change from your administrator."
                : "管理者へ上位プランの変更申請を行うことで、チャンネル作成数や容量上限などの各種制限を解除できます。"}
            </p>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px', 
          padding: '16px 24px', 
          borderTop: '1px solid var(--border-light)',
          background: 'rgba(0, 0, 0, 0.05)' 
        }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose} 
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              fontSize: '13px', 
              cursor: 'pointer'
            }}
          >
            {isEn ? "Close" : "閉じる"}
          </button>
          {onGoToSubscription && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onGoToSubscription();
                onClose();
              }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                alignSelf: 'unset',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isEn ? "View Plan Status" : "プラン状況を見る"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
