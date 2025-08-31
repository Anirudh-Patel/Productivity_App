interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

const Skeleton = ({ 
  className = '', 
  variant = 'rectangular',
  width,
  height,
  animate = true 
}: SkeletonProps) => {
  const baseClasses = `bg-gray-800 ${animate ? 'animate-pulse' : ''}`;
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const style = {
    width: width || undefined,
    height: height || undefined,
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

// Preset skeleton components for common use cases
export const SkeletonText = ({ lines = 1, className = '' }: { lines?: number; className?: string }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        variant="text" 
        height="1rem" 
        className={i === lines - 1 ? 'w-3/4' : 'w-full'}
      />
    ))}
  </div>
);

export const SkeletonAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  
  return <Skeleton variant="circular" className={sizes[size]} />;
};

export const SkeletonCard = ({ className = '' }: { className?: string }) => (
  <div className={`p-4 bg-solo-primary rounded-lg border border-gray-800 ${className}`}>
    <div className="flex items-start gap-3">
      <SkeletonAvatar size="sm" />
      <div className="flex-1 space-y-2">
        <Skeleton height="1.25rem" className="w-3/4" />
        <SkeletonText lines={2} />
        <div className="flex gap-2 mt-3">
          <Skeleton width="4rem" height="1.5rem" />
          <Skeleton width="3rem" height="1.5rem" />
        </div>
      </div>
    </div>
  </div>
);

export const SkeletonProgressBar = ({ className = '' }: { className?: string }) => (
  <div className={`space-y-1 ${className}`}>
    <div className="flex justify-between">
      <Skeleton width="2rem" height="0.75rem" />
      <Skeleton width="3rem" height="0.75rem" />
    </div>
    <Skeleton height="0.5rem" className="w-full" />
  </div>
);

export default Skeleton;