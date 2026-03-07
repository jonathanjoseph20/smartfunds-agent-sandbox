export function ParameterTable({ parameters }: { parameters: { key: string; value: string }[] }) {
  if (parameters.length === 0) return <p className="text-sm text-muted-foreground">No parameters.</p>;
  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Parameter</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Value</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map(p => (
            <tr key={p.key} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-foreground">--{p.key}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
