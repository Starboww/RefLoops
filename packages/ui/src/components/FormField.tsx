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
      <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
      {helpText && !error && (
        <span className="text-xs text-stone-500 dark:text-stone-400">{helpText}</span>
      )}
      {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
    </div>
  );
}
