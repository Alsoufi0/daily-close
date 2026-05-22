import { clsx } from "clsx";

interface MetricCardProps {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "warning";
}

export function MetricCard({ label, value, tone = "default" }: MetricCardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border bg-white p-4 shadow-sm",
        tone === "good" && "border-leaf/30 bg-green-50",
        tone === "bad" && "border-warning/30 bg-red-50",
        tone === "warning" && "border-gold/40 bg-yellow-50"
      )}
    >
      <p className="text-sm font-semibold text-ink/65">{label}</p>
      <p
        className={clsx(
          "mt-2 text-3xl font-black tracking-normal",
          tone === "good" && "text-leaf",
          tone === "bad" && "text-warning",
          tone === "warning" && "text-gold"
        )}
      >
        {value}
      </p>
    </div>
  );
}
