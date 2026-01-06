import React from 'react';
import { LucideProps } from 'lucide-react';

interface AppIconProps extends LucideProps {
  icon: React.ElementType;
}

export const AppIcon: React.FC<AppIconProps> = ({ icon: Icon, size = 18, strokeWidth = 1.5, className, ...props }) => {
  return <Icon size={size} strokeWidth={strokeWidth} className={className} {...props} />;
};

export default AppIcon;