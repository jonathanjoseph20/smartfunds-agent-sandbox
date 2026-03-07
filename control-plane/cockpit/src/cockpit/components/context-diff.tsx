export function ContextDiff({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  if (allKeys.length === 0) return <p className="text-sm text-muted-foreground">No context data.</p>;
  return (
    <div className="rounded-md border border-border text-xs font-mono">
      {allKeys.map(key => {
        const bVal = JSON.stringify(before[key] ?? null);
        const aVal = JSON.stringify(after[key] ?? null);
        const changed = bVal !== aVal;
        return (
          <div key={key} className={`flex px-3 py-1 border-b border-border last:border-0 ${changed ? 'bg-accent/50' : ''}`}>
            <span className="w-40 shrink-0 text-muted-foreground">{key}</span>
            {changed ? (
              <>
                <span className="text-destructive line-through mr-2">{bVal}</span>
                <span className="text-[hsl(var(--status-completed))]">{aVal}</span>
              </>
            ) : (
              <span className="text-foreground">{aVal}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
