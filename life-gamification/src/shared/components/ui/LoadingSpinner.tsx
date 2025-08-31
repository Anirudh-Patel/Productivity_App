import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const LoadingSpinner = ({ size = 'md', className = '', text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-solo-accent`} />
      {text && (
        <span className="text-sm text-gray-400 animate-pulse">{text}</span>
      )}
    </div>
  );
};

export const PageLoader = ({ text = 'Loading...' }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <LoadingSpinner size="lg" />
    <p className="text-gray-400 animate-pulse">{text}</p>
  </div>
);

export const InlineLoader = ({ text }: { text?: string }) => (
  <LoadingSpinner size="sm" text={text} className="py-2" />
);

export const ButtonLoader = () => (
  <LoadingSpinner size="sm" className="mr-2" />
);

export default LoadingSpinner;