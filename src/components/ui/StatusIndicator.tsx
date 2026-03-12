interface StatusIndicatorProps {
  status: "success" | "warning" | "danger" | "neutral";
  label?: string;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG = {
  success: { color: "#22C55E", label: "Im Soll" },
  warning: { color: "#F59E0B", label: "Grenzbereich" },
  danger: { color: "#EF4444", label: "Über Soll" },
  neutral: { color: "#6B7280", label: "Keine Daten" },
};

const SIZE_MAP = {
  sm: "w-2 h-2",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

export function StatusIndicator({ status, label, size = "md" }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.label;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${SIZE_MAP[size]} rounded-full inline-block`}
        style={{ backgroundColor: config.color }}
      />
      {displayLabel && (
        <span className="text-sm text-[#6B7280]">{displayLabel}</span>
      )}
    </span>
  );
}
