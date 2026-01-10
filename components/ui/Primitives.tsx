
import React, { ButtonHTMLAttributes, InputHTMLAttributes, forwardRef } from 'react';

// --- BUTTONS ---
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'ghost' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'icon';
    active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ className = '', variant = 'primary', size = 'md', active, children, ...props }) => {
    const base = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none rounded-md";
    
    const variants = {
        primary: "bg-accent text-bg hover:bg-accent/90 shadow-soft",
        ghost: `text-text2 hover:text-text hover:bg-panel2 ${active ? 'bg-accent2 text-accent' : ''}`,
        danger: "text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30",
        outline: "border border-border bg-transparent hover:bg-panel2 text-text"
    };

    const sizes = {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        icon: "h-8 w-8 p-0"
    };

    return (
        <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
            {children}
        </button>
    );
};

export const IconButton: React.FC<ButtonProps> = ({ className = '', variant = 'ghost', size = 'icon', ...props }) => {
    return <Button className={className} variant={variant} size={size} {...props} />;
};

// --- INPUTS ---
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => {
    return (
        <input 
            ref={ref}
            className={`w-full bg-panel2 border border-border rounded-md px-3 py-1.5 text-sm text-text placeholder:text-text2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all ${className}`}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => {
    return (
        <select 
            className={`w-full bg-panel2 border border-border rounded-md px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent appearance-none ${className}`}
            {...props}
        />
    );
};

// --- PANELS ---
export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement> & { variant?: 'base' | 'raised' }> = ({ className = '', variant = 'base', ...props }) => {
    const bg = variant === 'raised' ? 'bg-panel2' : 'bg-panel';
    return (
        <div className={`${bg} border border-border ${className}`} {...props} />
    );
};

// --- BADGES ---
export const Badge: React.FC<{ variant?: 'default' | 'danger' | 'warning' | 'success', children: React.ReactNode }> = ({ variant = 'default', children }) => {
    const styles = {
        default: "bg-panel2 text-text2 border-border",
        danger: "bg-danger/10 text-danger border-danger/20",
        warning: "bg-warning/10 text-warning border-warning/20",
        success: "bg-success/10 text-success border-success/20",
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${styles[variant]}`}>
            {children}
        </span>
    );
};

// --- SEPARATOR ---
export const Separator: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`h-[1px] bg-border w-full ${className}`} />
);
