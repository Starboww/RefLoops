import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3C6B] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[#FF3C6B] to-[#FF2458] text-white hover:opacity-95 shadow-md font-semibold border border-white/20 active:scale-[0.98]',
        secondary:
          'bg-[#1F2228] text-white hover:bg-[#292E35] border border-white/12 shadow-insetGlow font-medium active:scale-[0.98]',
        outline:
          'border border-white/15 bg-transparent hover:bg-white/5 text-[#DFE4FC] hover:text-white shadow-xs font-medium',
        ghost:
          'bg-transparent hover:bg-white/5 text-[#C1C6CD] hover:text-white font-medium',
        danger:
          'bg-[#DD2C61] text-white hover:bg-[#DD2C61]/90 shadow-sm font-medium',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-lg',
        md: 'h-9 px-4 text-sm rounded-xl',
        lg: 'h-11 px-5 text-base rounded-xl font-semibold',
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
