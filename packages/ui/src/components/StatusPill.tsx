import { Badge } from './Badge';

export type AllStatus =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'CLOSED'
  | 'REFERRAL_RECEIVED'
  | 'PENDING'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'DECLINED_OR_REMOVED'
  | 'QUEUED'
  | 'READY_TO_SEND'
  | 'SENT'
  | 'CANCELLED_BY_USER'
  | 'SCHEDULED'
  | 'SKIPPED'
  | 'NOT_SCHEDULED';

interface StatusPillProps {
  status: AllStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const getVariantAndLabel = (
    s: AllStatus
  ): { variant: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'; label: string } => {
    switch (s) {
      case 'ACTIVE':
        return { variant: 'default', label: 'Active' };
      case 'ARCHIVED':
        return { variant: 'secondary', label: 'Archived' };
      case 'CLOSED':
        return { variant: 'danger', label: 'Closed' };
      case 'REFERRAL_RECEIVED':
        return { variant: 'success', label: 'Referral Received 🎉' };

      case 'PENDING':
        return { variant: 'warning', label: 'Pending Accept' };
      case 'ACCEPTED':
        return { variant: 'success', label: 'Accepted' };
      case 'EXPIRED':
        return { variant: 'danger', label: 'Expired' };
      case 'DECLINED_OR_REMOVED':
        return { variant: 'danger', label: 'Declined' };

      case 'QUEUED':
        return { variant: 'warning', label: 'Queued' };
      case 'READY_TO_SEND':
        return { variant: 'success', label: 'Ready to Send 🚀' };
      case 'SENT':
        return { variant: 'default', label: 'Sent' };
      case 'CANCELLED_BY_USER':
        return { variant: 'secondary', label: 'Cancelled' };

      case 'SCHEDULED':
        return { variant: 'warning', label: 'Scheduled' };
      case 'SKIPPED':
        return { variant: 'secondary', label: 'Skipped' };
      case 'NOT_SCHEDULED':
        return { variant: 'outline', label: 'Not Scheduled' };
      default:
        return { variant: 'secondary', label: s };
    }
  };

  const { variant, label } = getVariantAndLabel(status);

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
