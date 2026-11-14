import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-white/15 rounded-2xl bg-[#1F2228]/60 backdrop-blur-md">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#292E35] border border-white/10 text-[#52ACFE] shadow-insetGlow mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-heading font-bold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-[#C1C6CD] max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
