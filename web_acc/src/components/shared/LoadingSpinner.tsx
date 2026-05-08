import { cn } from 'src/core/utils';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
  label?: string;
  variant?: 'thinking' | 'dots';
};

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const LoadingSpinner = ({
  size = 'md',
  fullScreen = false,
  className,
  label,
  variant = 'thinking',
}: LoadingSpinnerProps) => {
  const displayText = label || 'Thinking';
  const showText = variant !== 'dots';
  const spinner = (
    <span
      className={cn(
        'thinking-indicator',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label={displayText}
      aria-live="polite"
    >
      {showText && <span className="thinking-text">{displayText}</span>}
      <span className="thinking-dot dot-1">.</span>
      <span className="thinking-dot dot-2">.</span>
      <span className="thinking-dot dot-3">.</span>
    </span>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;

