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
  ): {
    variant: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
    label: string;
    dotColor?: string;
  } => {
    switch (s) {
      case 'ACTIVE':
        return { variant: 'default', label: 'Active', dotColor: '#52ACFE' };
      case 'ARCHIVED':
        return { variant: 'secondary', label: 'Archived', dotColor: '#8A919D' };
      case 'CLOSED':
        return { variant: 'danger', label: 'Closed', dotColor: '#DD2C61' };
      case 'REFERRAL_RECEIVED':
        return { variant: 'success', label: 'Referral Received', dotColor: '#0BDFC5' };

      case 'PENDING':
        return { variant: 'warning', label: 'Pending Accept', dotColor: '#DFE686' };
      case 'ACCEPTED':
        return { variant: 'success', label: 'Accepted', dotColor: '#0DC562' };
      case 'EXPIRED':
        return { variant: 'danger', label: 'Expired', dotColor: '#DD2C61' };
      case 'DECLINED_OR_REMOVED':
        return { variant: 'danger', label: 'Declined', dotColor: '#DD2C61' };

      case 'QUEUED':
        return { variant: 'warning', label: 'Queued', dotColor: '#DFE686' };
      case 'READY_TO_SEND':
        return { variant: 'success', label: 'Ready to Send', dotColor: '#0BDFC5' };
      case 'SENT':
        return { variant: 'default', label: 'Sent', dotColor: '#52ACFE' };
      case 'CANCELLED_BY_USER':
        return { variant: 'secondary', label: 'Cancelled', dotColor: '#5F646D' };

      case 'SCHEDULED':
        return { variant: 'warning', label: 'Scheduled', dotColor: '#DFE686' };
      case 'SKIPPED':
        return { variant: 'secondary', label: 'Skipped', dotColor: '#8A919D' };
      case 'NOT_SCHEDULED':
        return { variant: 'outline', label: 'Not Scheduled', dotColor: '#5F646D' };
      default:
        return { variant: 'secondary', label: s };
    }
  };

  const { variant, label, dotColor } = getVariantAndLabel(status);

  return (
    <Badge variant={variant} dotColor={dotColor} className={className}>
      {label}
    </Badge>
  );
}
