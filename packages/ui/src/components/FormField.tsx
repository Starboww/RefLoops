import React from 'react';
import { cn } from '../utils';

export function FormField({
  label,
  error,
  children,
  className,
  required,
  helpText,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  helpText?: string;
}) {
  return (
    <div className={cn('flex flex-col space-y-1.5', className)}>
      <label className="text-xs font-medium text-[#C1C6CD] tracking-wide uppercase">
        {label}
        {required && <span className="text-[#DD2C61] ml-1">*</span>}
      </label>
      {children}
      {helpText && !error && (
        <span className="text-xs text-[#8A919D]">{helpText}</span>
      )}
      {error && <span className="text-xs font-medium text-[#DD2C61]">{error}</span>}
    </div>
  );
}
