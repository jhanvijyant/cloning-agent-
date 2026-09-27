type LogEntry = { time: string; message: string };

export function StatusLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Nothing running yet. Enter a URL and click Analyze.
      </p>
    );
  }

  return (
    <ul className="space-y-1 font-mono text-xs text-neutral-700">
      {entries.map((entry, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-neutral-400">{entry.time}</span>
          <span>{entry.message}</span>
        </li>
      ))}
    </ul>
  );
}

export type { LogEntry };
