import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-[#575756] text-white hover:bg-[#3D3D3C] focus:ring-[#575756]",
    secondary: "bg-white text-[#575756] border-2 border-[#575756] hover:bg-[#F8F9FA] focus:ring-[#575756]",
    danger: "bg-[#E2001A] text-white hover:bg-[#B8001A] focus:ring-[#E2001A]",
    ghost: "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6] focus:ring-[#575756]",
  };

  const sizeStyles = {
    sm: "px-3 py-2 text-sm min-h-[36px]",
    md: "px-5 py-3 text-[15px] min-h-[44px]",
    lg: "px-6 py-3.5 text-base min-h-[48px]",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
