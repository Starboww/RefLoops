import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-[#D97757] text-white hover:bg-[#C86545] shadow-sm font-semibold',
        secondary: 'bg-[#F4F0EA] text-[#1C1917] hover:bg-[#E8E3DA] dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 font-medium',
        outline: 'border border-[#E8E3DA] bg-white hover:bg-[#FAF8F5] dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800 text-[#1C1917] dark:text-stone-200 shadow-xs',
        ghost: 'bg-transparent hover:bg-[#F4F0EA] dark:hover:bg-stone-800 text-[#78716C] dark:text-stone-300 hover:text-[#1C1917] dark:hover:text-stone-100',
        danger: 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 shadow-sm font-medium',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-lg',
        md: 'h-9 px-4 text-sm rounded-xl',
        lg: 'h-11 px-5 text-base rounded-xl',
        icon: 'h-9 w-9 p-0 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
