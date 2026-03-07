import type { WorkflowDagViewModel } from '@/cockpit/lib/view-models';
import { StatusBadge } from './status-badge';
import { cn } from '@/lib/utils';

export function DagView({ dag }: { dag: WorkflowDagViewModel }) {
  return (
    <div className="space-y-1">
      {dag.nodes.map((node, i) => (
        <div key={node.nodeId}>
          {/* Edge indicator */}
          {i > 0 && (
            <div className="flex items-center pl-6 py-0.5">
              <div className="w-px h-4 bg-border" />
              <span className="ml-2 text-xs text-muted-foreground">↓ depends on {node.dependsOn.join(', ')}</span>
            </div>
          )}
          {/* Node card */}
          <div className={cn(
            'rounded-md border bg-card p-3 flex items-center justify-between',
            node.hasFailure ? 'border-destructive/40' : 'border-border'
          )}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-mono text-muted-foreground">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{node.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{node.agentId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {node.retryCount > 0 && (
                <span className="text-xs text-muted-foreground">retries: {node.retryCount}/{node.maxRetries}</span>
              )}
              {node.timeoutState !== 'none' && (
                <span className="text-xs text-[hsl(var(--status-timed-out))]">⏱ {node.timeoutState}</span>
              )}
              {node.recoveryState !== 'none' && (
                <span className="text-xs text-[hsl(var(--status-recovering))]">↻ {node.recoveryState}</span>
              )}
              <StatusBadge status={node.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
