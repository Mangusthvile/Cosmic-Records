
import React from 'react';
import { LucideProps } from 'lucide-react';

interface AppIconProps extends Partial<Omit<LucideProps, 'ref'>> {
  icon: React.ElementType;
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

export const AppIcon: React.FC<AppIconProps> = ({ icon: Icon, size = 18, strokeWidth = 1.75, className, ...props }) => {
  return <Icon size={size} strokeWidth={strokeWidth} className={className} {...props} />;
};

export default AppIcon;
