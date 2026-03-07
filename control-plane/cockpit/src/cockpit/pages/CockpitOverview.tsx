import { Link } from 'react-router-dom';
import { getOverview } from '@/cockpit/lib/view-models';
import { ControlNotice } from '@/cockpit/components/command-hint';
import { StatusBadge } from '@/cockpit/components/status-badge';

export default function CockpitOverview() {
  const overview = getOverview();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Operator Cockpit</h1>
        <p className="text-sm text-muted-foreground mt-1">Read-only visualization of mission and workflow state.</p>
      </div>

      <ControlNotice />

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Missions', value: overview.totalMissions },
          { label: 'Active Missions', value: overview.activeMissions },
          { label: 'Active Runs', value: overview.activeRuns },
          { label: 'Failed Runs', value: overview.failedRuns },
        ].map(card => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link to="/cockpit/missions" className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
          → Missions Dashboard
        </Link>
        <Link to="/cockpit/runs" className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
          → Runs Dashboard
        </Link>
      </div>

      {overview.recentFailures.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">Recent Failures</h2>
          <div className="rounded-md border border-border divide-y divide-border">
            {overview.recentFailures.map(f => (
              <div key={f.runId} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge status="failed" />
                  <Link to={`/cockpit/runs/${f.runId}`} className="font-mono text-xs text-foreground hover:underline">{f.runId}</Link>
                  <span className="text-xs text-muted-foreground">{f.missionId}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{f.failedNode}</span>
                  <span className="text-xs text-muted-foreground">{f.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
