export default function Loading() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="h-7 w-40 rounded-lg bg-border" />
      <div className="h-11 rounded-lg bg-border/60" />
      <div className="h-20 rounded-card bg-border/60" />
      <div className="h-20 rounded-card bg-border/60" />
    </div>
  );
}
