export function CommandHint({ label, command }: { label: string; command: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <code className="mt-0.5 block font-mono text-xs text-foreground">{command}</code>
    </div>
  );
}

export function ControlNotice() {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">
        ⚙ Control is canonical in CLI and Slack. This dashboard is read-only / inspect-first.
      </p>
    </div>
  );
}
