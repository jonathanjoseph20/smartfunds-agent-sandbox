import type { TraceEventViewModel } from '@/cockpit/lib/view-models';

const eventTypeColors: Record<string, string> = {
  run_started: 'text-[hsl(var(--status-running))]',
  node_entered: 'text-[hsl(var(--status-running))]',
  node_completed: 'text-[hsl(var(--status-completed))]',
  node_failed: 'text-[hsl(var(--status-failed))]',
  retry_scheduled: 'text-[hsl(var(--status-retrying))]',
  retry_attempt: 'text-[hsl(var(--status-retrying))]',
  timeout_triggered: 'text-[hsl(var(--status-timed-out))]',
  recovery_entered: 'text-[hsl(var(--status-recovering))]',
  recovery_completed: 'text-[hsl(var(--status-recovered))]',
  cancellation_requested: 'text-[hsl(var(--status-cancelled))]',
  cancellation_finalized: 'text-[hsl(var(--status-cancelled))]',
};

export function TraceView({ events }: { events: TraceEventViewModel[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No trace events.</p>;
  return (
    <div className="rounded-md border border-border divide-y divide-border">
      {events.map(e => (
        <div key={e.sequence} className="flex items-start gap-3 px-3 py-2 text-xs">
          <span className="shrink-0 font-mono text-muted-foreground w-5 text-right">{e.sequence}</span>
          <span className="shrink-0 font-mono text-muted-foreground w-36">{e.formattedTime}</span>
          <span className={`shrink-0 font-mono font-medium w-40 ${eventTypeColors[e.eventType] ?? 'text-foreground'}`}>
            {e.eventType}
          </span>
          {e.nodeId && <span className="shrink-0 font-mono text-muted-foreground w-28">{e.nodeId}</span>}
          <span className="text-foreground">{e.detail}</span>
        </div>
      ))}
    </div>
  );
}
