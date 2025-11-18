import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = {
  default: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800',
};

type Variant = keyof typeof buttonVariants;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          buttonVariants[variant],
          sizeClass,
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
