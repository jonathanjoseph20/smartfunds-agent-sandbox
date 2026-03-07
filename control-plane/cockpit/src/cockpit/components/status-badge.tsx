import { cn } from '@/lib/utils';
import type { MissionStatus, RunStatus, NodeStatus } from '@/cockpit/lib/types';
import { formatStatus } from '@/cockpit/lib/formatters';

type StatusType = MissionStatus | RunStatus | NodeStatus;

const statusColorMap: Record<string, string> = {
  created: 'bg-[hsl(var(--status-created))]',
  running: 'bg-[hsl(var(--status-running))]',
  completed: 'bg-[hsl(var(--status-completed))]',
  failed: 'bg-[hsl(var(--status-failed))]',
  cancelled: 'bg-[hsl(var(--status-cancelled))]',
  retrying: 'bg-[hsl(var(--status-retrying))]',
  timed_out: 'bg-[hsl(var(--status-timed-out))]',
  recovering: 'bg-[hsl(var(--status-recovering))]',
  recovered: 'bg-[hsl(var(--status-recovered))]',
  pending: 'bg-muted-foreground/40',
  skipped: 'bg-muted-foreground/30',
};

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  const color = statusColorMap[status] ?? 'bg-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-primary-foreground', color, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {formatStatus(status)}
    </span>
  );
}
