"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, breadcrumbs, actions }: HeaderProps) {
  return (
    <header className="mb-8">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm text-[#6B7280] mb-3">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={14} />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-[#575756] transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#1A1A1A] font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title + Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{title}</h1>
          {subtitle && (
            <p className="text-base text-[#6B7280] mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
