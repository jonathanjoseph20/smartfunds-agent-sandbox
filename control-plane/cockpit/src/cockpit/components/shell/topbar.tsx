import { useLocation, Link } from 'react-router-dom';

export function Topbar() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-2">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1 text-xs">
          {i > 0 && <span className="text-muted-foreground">/</span>}
          <Link
            to={'/' + segments.slice(0, i + 1).join('/')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {seg}
          </Link>
        </span>
      ))}
    </header>
  );
}
