import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-[rgba(66,80,204,0.15)] text-[#52ACFE] border border-[rgba(66,80,204,0.30)]',
        secondary:
          'bg-[#292E35] text-[#C1C6CD] border border-white/10',
        success:
          'bg-[rgba(13,197,98,0.15)] text-[#0BDFC5] border border-[rgba(13,197,98,0.30)]',
        warning:
          'bg-[rgba(223,230,134,0.15)] text-[#DFE686] border border-[rgba(223,230,134,0.30)]',
        danger:
          'bg-[rgba(221,44,97,0.15)] text-[#DD2C61] border border-[rgba(221,44,97,0.30)]',
        outline:
          'text-[#C1C6CD] border border-white/12 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dotColor?: string;
}

export function Badge({ className, variant, dotColor, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dotColor && (
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {children}
    </div>
  );
}
