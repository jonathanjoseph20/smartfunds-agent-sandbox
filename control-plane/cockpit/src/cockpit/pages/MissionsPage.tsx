import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMissionList } from '@/cockpit/lib/view-models';
import { StatusBadge } from '@/cockpit/components/status-badge';
import { EmptyState } from '@/cockpit/components/empty-state';

export default function MissionsPage() {
  const [missions, setMissions] = useState<Awaited<ReturnType<typeof getMissionList>>>([]);

  useEffect(() => {
    void getMissionList().then(setMissions);
  }, []);

  if (missions.length === 0) return <EmptyState title="No missions" description="No missions have been created yet." />;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-xl font-semibold text-foreground">Missions</h1>
      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mission ID</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Team</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Workflow</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Latest Run</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Started</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Parameters</th>
            </tr>
          </thead>
          <tbody>
            {missions.map(m => (
              <tr key={m.missionId} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link to={`/cockpit/missions/${m.missionId}`} className="font-mono text-xs text-foreground hover:underline">{m.missionId}</Link>
                </td>
                <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{m.teamId}</td>
                <td className="px-3 py-2">
                  <Link to={`/cockpit/workflows/${m.workflowId}`} className="font-mono text-xs text-muted-foreground hover:underline">{m.workflowId}</Link>
                </td>
                <td className="px-3 py-2">
                  {m.latestRunId ? (
                    <div className="flex items-center gap-2">
                      <Link to={`/cockpit/runs/${m.latestRunId}`} className="font-mono text-xs text-foreground hover:underline">{m.latestRunId}</Link>
                      {m.latestRunStatus && <StatusBadge status={m.latestRunStatus} />}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.startedAt ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{m.parameterSummary || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
