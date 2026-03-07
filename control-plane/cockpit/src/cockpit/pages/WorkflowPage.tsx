import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { getWorkflowDag } from '@/cockpit/lib/view-models';
import { DagView } from '@/cockpit/components/dag-view';
import { NodeDetail } from '@/cockpit/components/node-detail';
import { EmptyState } from '@/cockpit/components/empty-state';

export default function WorkflowPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('run') ?? undefined;
  const dag = workflowId ? getWorkflowDag(workflowId, runId) : null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (!dag) return <EmptyState title="Workflow not found" description={`No workflow with ID "${workflowId}".`} />;

  const selectedNode = dag.nodes.find(n => n.nodeId === selectedNodeId);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/cockpit/runs" className="text-xs text-muted-foreground hover:text-foreground">← Runs</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">{dag.label}</h1>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{dag.workflowId}{runId ? ` • run: ${runId}` : ''}</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="space-y-1">
            {dag.nodes.map((node, i) => (
              <div key={node.nodeId} onClick={() => setSelectedNodeId(node.nodeId === selectedNodeId ? null : node.nodeId)} className="cursor-pointer">
                {i > 0 && (
                  <div className="flex items-center pl-6 py-0.5">
                    <div className="w-px h-4 bg-border" />
                    <span className="ml-2 text-xs text-muted-foreground">↓</span>
                  </div>
                )}
                <div className={`rounded-md border p-3 flex items-center justify-between transition-colors hover:bg-muted/30 ${
                  node.nodeId === selectedNodeId ? 'border-primary bg-accent' : node.hasFailure ? 'border-destructive/40 bg-card' : 'border-border bg-card'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-mono text-muted-foreground">{i + 1}</div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{node.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{node.agentId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {node.retryCount > 0 && <span className="text-xs text-muted-foreground">{node.retryCount}/{node.maxRetries}r</span>}
                    {node.timeoutState !== 'none' && <span className="text-xs text-[hsl(var(--status-timed-out))]">⏱</span>}
                    {node.recoveryState !== 'none' && <span className="text-xs text-[hsl(var(--status-recovering))]">↻</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-primary-foreground ${
                      node.status === 'completed' ? 'bg-[hsl(var(--status-completed))]' :
                      node.status === 'running' ? 'bg-[hsl(var(--status-running))]' :
                      node.status === 'failed' ? 'bg-[hsl(var(--status-failed))]' :
                      node.status === 'cancelled' ? 'bg-[hsl(var(--status-cancelled))]' :
                      'bg-muted-foreground/40'
                    }`}>
                      {node.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {selectedNode && (
          <div className="w-96 shrink-0">
            <NodeDetail node={selectedNode} />
          </div>
        )}
      </div>
    </div>
  );
}
