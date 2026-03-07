import type { AgentProfile } from '@/cockpit/lib/types';

export function AgentRoster({ agents }: { agents: AgentProfile[] }) {
  if (agents.length === 0) return <p className="text-sm text-muted-foreground">No agents assigned.</p>;
  return (
    <div className="space-y-2">
      {agents.map(a => (
        <div key={a.agentId} className="rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium text-foreground">{a.agentId}</span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{a.role}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{a.profile}</p>
        </div>
      ))}
    </div>
  );
}
