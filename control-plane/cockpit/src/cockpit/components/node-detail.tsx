import type { NodeDetailViewModel } from '@/cockpit/lib/view-models';
import { StatusBadge } from './status-badge';

export function NodeDetail({ node }: { node: NodeDetailViewModel }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground">{node.label}</h4>
        <StatusBadge status={node.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Node ID:</span> <span className="font-mono text-foreground">{node.nodeId}</span></div>
        <div><span className="text-muted-foreground">Agent:</span> <span className="font-mono text-foreground">{node.agentId}</span></div>
        {node.agentRole && <div><span className="text-muted-foreground">Role:</span> <span className="text-foreground">{node.agentRole}</span></div>}
        <div><span className="text-muted-foreground">Adapter:</span> <span className="font-mono text-foreground">{node.adapterId}</span></div>
        <div><span className="text-muted-foreground">Depends On:</span> <span className="font-mono text-foreground">{node.dependsOn.length > 0 ? node.dependsOn.join(', ') : 'none'}</span></div>
        <div><span className="text-muted-foreground">Retries:</span> <span className="font-mono text-foreground">{node.retryCount}/{node.maxRetries}</span></div>
        <div><span className="text-muted-foreground">Timeout:</span> <span className="font-mono text-foreground">{node.timeoutState}</span></div>
        <div><span className="text-muted-foreground">Recovery:</span> <span className="font-mono text-foreground">{node.recoveryState}</span></div>
      </div>
      {Object.keys(node.inputs).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Inputs</p>
          <pre className="rounded bg-muted p-2 text-xs font-mono text-foreground overflow-x-auto">{JSON.stringify(node.inputs, null, 2)}</pre>
        </div>
      )}
      {Object.keys(node.outputs).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Outputs</p>
          <pre className="rounded bg-muted p-2 text-xs font-mono text-foreground overflow-x-auto">{JSON.stringify(node.outputs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
