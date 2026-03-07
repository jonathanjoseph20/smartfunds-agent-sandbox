import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { getRunDetail } from '@/cockpit/lib/view-models';
import { StatusBadge } from '@/cockpit/components/status-badge';
import { NodeDetail } from '@/cockpit/components/node-detail';
import { TraceView } from '@/cockpit/components/trace-view';
import { FailurePanel } from '@/cockpit/components/failure-panel';
import { CommandHint } from '@/cockpit/components/command-hint';
import { EmptyState } from '@/cockpit/components/empty-state';

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const run = runId ? getRunDetail(runId) : null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (!run) return <EmptyState title="Run not found" description={`No run with ID "${runId}".`} />;

  const selectedNode = run.nodes.find(n => n.nodeId === selectedNodeId);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/cockpit/runs" className="text-xs text-muted-foreground hover:text-foreground">← Runs</Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground font-mono">{run.runId}</h1>
        <StatusBadge status={run.status} />
        {run.cancellationFlag && <span className="rounded bg-[hsl(var(--status-cancelled))]/20 px-2 py-0.5 text-xs text-[hsl(var(--status-cancelled))]">Cancelled</span>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Mission', value: run.missionId, link: `/cockpit/missions/${run.missionId}` },
          { label: 'Workflow', value: run.workflowId, link: `/cockpit/workflows/${run.workflowId}?run=${run.runId}` },
          { label: 'Team', value: run.teamId },
          { label: 'Started', value: run.startedAt },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            {'link' in item && item.link ? (
              <Link to={item.link} className="text-sm font-mono text-foreground hover:underline mt-0.5 block truncate">{item.value}</Link>
            ) : (
              <p className="text-sm font-mono text-foreground mt-0.5 truncate">{item.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Runtime hardening summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Runtime Hardening</h3>
        <div className="grid grid-cols-5 gap-4 text-xs">
          <div><span className="text-muted-foreground">Nodes:</span> <span className="font-mono text-foreground">{run.completedNodeCount}/{run.totalNodeCount}</span></div>
          <div><span className="text-muted-foreground">Retries:</span> <span className="font-mono text-foreground">{run.retryCount}</span></div>
          <div><span className="text-muted-foreground">Recovery:</span> <span className="font-mono text-foreground">{run.recoveryState ?? 'none'}</span></div>
          <div><span className="text-muted-foreground">Duration:</span> <span className="font-mono text-foreground">{run.duration ?? 'in progress'}</span></div>
          <div><span className="text-muted-foreground">Cancellation:</span> <span className="font-mono text-foreground">{run.cancellationFlag ? 'yes' : 'no'}</span></div>
        </div>
      </div>

      {/* Failure panel */}
      {run.failure && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Failure Diagnostics</h3>
          <FailurePanel failure={run.failure} />
        </div>
      )}

      {/* Node list + detail */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Nodes</h3>
        <div className="flex gap-4">
          <div className="flex-1 rounded-md border border-border divide-y divide-border">
            {run.nodes.map(node => (
              <button
                key={node.nodeId}
                onClick={() => setSelectedNodeId(node.nodeId === selectedNodeId ? null : node.nodeId)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors ${
                  node.nodeId === selectedNodeId ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{node.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{node.nodeId}</span>
                </div>
                <div className="flex items-center gap-2">
                  {node.retryCount > 0 && <span className="text-xs text-muted-foreground">{node.retryCount}r</span>}
                  <StatusBadge status={node.status} />
                </div>
              </button>
            ))}
          </div>
          {selectedNode && (
            <div className="w-96 shrink-0">
              <NodeDetail node={selectedNode} />
            </div>
          )}
        </div>
      </div>

      {/* Trace */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Execution Trace</h3>
        <TraceView events={run.traceEvents} />
      </div>

      {/* Command hints */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Operator Commands</h3>
        <div className="grid grid-cols-3 gap-2">
          <CommandHint label="Retry" command={run.cliRetryCommand} />
          <CommandHint label="Resume" command={run.cliResumeCommand} />
          <CommandHint label="Cancel Mission" command={run.cliCancelCommand} />
        </div>
      </div>
    </div>
  );
}
