interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white rounded-lg border border-[#E5E7EB] p-6 ${className}`}>
      {children}
    </div>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  status?: "success" | "warning" | "danger" | "neutral";
}

export function KPICard({ label, value, subtitle, accentColor, status }: KPICardProps) {
  const statusColors = {
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    neutral: "#575756",
  };

  const borderColor = accentColor ?? (status ? statusColors[status] : "#E5E7EB");

  return (
    <div
      className="bg-white rounded-lg border-l-4 p-5"
      style={{ borderLeftColor: borderColor, borderTop: "1px solid #E5E7EB", borderRight: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}
    >
      <div className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: status ? statusColors[status] : "#1A1A1A" }}>
        {value}
      </div>
      {subtitle && (
        <div className="text-sm text-[#6B7280] mt-1">{subtitle}</div>
      )}
    </div>
  );
}
