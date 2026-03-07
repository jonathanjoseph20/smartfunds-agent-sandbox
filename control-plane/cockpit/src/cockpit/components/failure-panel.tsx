import type { FailurePanelViewModel } from '@/cockpit/lib/view-models';
import { StatusBadge } from './status-badge';
import { CommandHint } from './command-hint';

export function FailurePanel({ failure }: { failure: FailurePanelViewModel }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <StatusBadge status="failed" />
        <span className="font-mono text-sm font-medium text-foreground">{failure.code}</span>
      </div>
      <p className="text-sm text-foreground">{failure.message}</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-muted-foreground">Node:</span> <span className="font-mono text-foreground">{failure.nodeLabel}</span></div>
        <div><span className="text-muted-foreground">Agent:</span> <span className="font-mono text-foreground">{failure.agentId}</span></div>
        <div><span className="text-muted-foreground">Adapter:</span> <span className="font-mono text-foreground">{failure.adapterId}</span></div>
        <div><span className="text-muted-foreground">Retry Exhausted:</span> <span className="font-mono text-foreground">{failure.retryExhausted ? 'Yes' : 'No'}</span></div>
        {failure.timeoutClassification && <div><span className="text-muted-foreground">Timeout:</span> <span className="font-mono text-foreground">{failure.timeoutClassification}</span></div>}
        {failure.safetyViolation && <div className="col-span-2 text-destructive font-medium">⚠ Safety Violation Detected</div>}
      </div>
      {failure.recoverySummary && (
        <div className="text-xs"><span className="text-muted-foreground">Recovery:</span> <span className="text-foreground">{failure.recoverySummary}</span></div>
      )}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Action</p>
        <p className="text-sm text-foreground">{failure.suggestedAction}</p>
      </div>
      <div className="flex gap-2">
        <CommandHint label="CLI" command={failure.cliCommand} />
        <CommandHint label="Slack" command={failure.slackCommand} />
      </div>
    </div>
  );
}
