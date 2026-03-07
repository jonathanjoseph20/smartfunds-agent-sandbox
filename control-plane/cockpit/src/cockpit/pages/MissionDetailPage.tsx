import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMissionDetail } from '@/cockpit/lib/view-models';
import { StatusBadge } from '@/cockpit/components/status-badge';
import { ParameterTable } from '@/cockpit/components/parameter-table';
import { AgentRoster } from '@/cockpit/components/agent-roster';
import { CommandHint } from '@/cockpit/components/command-hint';
import { EmptyState } from '@/cockpit/components/empty-state';

export default function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [mission, setMission] = useState<Awaited<ReturnType<typeof getMissionDetail>>>(null);

  useEffect(() => {
    if (!missionId) {
      setMission(null);
      return;
    }
    void getMissionDetail(missionId).then(setMission);
  }, [missionId]);

  if (!mission) return <EmptyState title="Mission not found" description={`No mission with ID "${missionId}".`} />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/cockpit/missions" className="text-xs text-muted-foreground hover:text-foreground">← Missions</Link>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground font-mono">{mission.missionId}</h1>
        <StatusBadge status={mission.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Metadata</h3>
          <div className="space-y-1 text-xs">
            <div><span className="text-muted-foreground">Team:</span> <span className="font-mono text-foreground">{mission.teamId}</span></div>
            <div><span className="text-muted-foreground">Workflow:</span> <Link to={`/cockpit/workflows/${mission.workflowId}`} className="font-mono text-foreground hover:underline">{mission.workflowId}</Link></div>
            <div><span className="text-muted-foreground">Started:</span> <span className="text-foreground">{mission.startedAt ?? '—'}</span></div>
            <div><span className="text-muted-foreground">Completed:</span> <span className="text-foreground">{mission.completedAt ?? '—'}</span></div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parameters</h3>
          <ParameterTable parameters={mission.parameters} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Workflow Runs</h3>
        {mission.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="rounded-md border border-border divide-y divide-border">
            {mission.runs.map(r => (
              <div key={r.runId} className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3">
                  <Link to={`/cockpit/runs/${r.runId}`} className="font-mono text-xs text-foreground hover:underline">{r.runId}</Link>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{r.completedNodeCount}/{r.totalNodeCount} nodes</span>
                  {r.retryCount > 0 && <span>retries: {r.retryCount}</span>}
                  {r.duration && <span>{r.duration}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Agent Roster</h3>
        <AgentRoster agents={mission.agents} />
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">CLI / Slack Commands</h3>
        <div className="grid grid-cols-3 gap-2">
          <CommandHint label="Inspect Mission" command={mission.cliInspectCommand} />
          <CommandHint label="View Agents" command={mission.cliAgentsCommand} />
          <CommandHint label="Cancel Mission" command={mission.cliCancelCommand} />
        </div>
      </div>
    </div>
  );
}
