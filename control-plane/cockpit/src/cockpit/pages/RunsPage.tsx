import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getRunList } from '@/cockpit/lib/view-models';
import { StatusBadge } from '@/cockpit/components/status-badge';
import { EmptyState } from '@/cockpit/components/empty-state';

export default function RunsPage() {
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof getRunList>>>([]);

  useEffect(() => {
    void getRunList().then(setRuns);
  }, []);

  if (runs.length === 0) return <EmptyState title="No runs" description="No workflow runs recorded." />;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-xl font-semibold text-foreground">Workflow Runs</h1>
      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Run ID</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mission</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nodes</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Active</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Failed</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Retries</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Recovery</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Duration</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.runId} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link to={`/cockpit/runs/${r.runId}`} className="font-mono text-xs text-foreground hover:underline">{r.runId}</Link>
                </td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2">
                  <Link to={`/cockpit/missions/${r.missionId}`} className="font-mono text-xs text-muted-foreground hover:underline">{r.missionId}</Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.completedNodeCount}/{r.totalNodeCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.activeNodeLabel ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.failedNodeLabel ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.retryCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.recoveryState ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.duration ?? 'in progress'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
