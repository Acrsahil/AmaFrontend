import { cn } from "@/lib/utils";

type StatusType = 'available' | 'occupied' | 'order-in-progress' | 'payment-pending' | 'new' | 'preparing' | 'ready' | 'completed' | 'pending' | 'paid' | 'partial' | 'unpaid' | 'low' | 'ok';

interface StatusBadgeProps {
  status: string;
  className?: string;
  label?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  available: {
    label: 'Available',
    className: 'bg-success/15 text-success border-success/30',
  },
  occupied: {
    label: 'Occupied',
    className: 'bg-info/15 text-info border-info/30',
  },
  'order-in-progress': {
    label: 'In Progress',
    className: 'bg-warning/15 text-warning border-warning/30',
  },
  'payment-pending': {
    label: 'Payment Due',
    className: 'bg-accent/15 text-accent border-accent/30',
  },
  new: {
    label: 'New',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  preparing: {
    label: 'Preparing',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ready: {
    label: 'Ready',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-muted text-muted-foreground border-border',
  },
  pending: {
    label: 'Pending',
    className: 'bg-warning/15 text-warning border-warning/30',
  },
  paid: {
    label: 'Paid',
    className: 'bg-success/15 text-success border-success/30',
  },
  partial: {
    label: 'Partial',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  unpaid: {
    label: 'Unpaid',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  creadit: {
    label: 'Credit',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  low: {
    label: 'Low Stock',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  ok: {
    label: 'In Stock',
    className: 'bg-success/15 text-success border-success/30',
  },
  'waiter-paid': {
    label: 'Waiter Received',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  'waiter received': {
    label: 'Waiter Received',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const normStatus = status?.toLowerCase();
  const config = statusConfig[normStatus] || {
    label: status || 'Unknown',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <span className={cn(
      "status-badge border px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider",
      config.className,
      className
    )}>
      {label || config.label}
    </span>
  );
}
