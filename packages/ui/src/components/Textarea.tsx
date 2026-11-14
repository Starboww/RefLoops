import React from 'react';
import { cn } from '../utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[90px] w-full rounded-lg border border-white/12 bg-[#1F2228] px-3.5 py-2.5 text-sm text-white shadow-xs transition-colors placeholder:text-[#5F646D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3C6B] focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-[#DD2C61] focus-visible:ring-[#DD2C61]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
