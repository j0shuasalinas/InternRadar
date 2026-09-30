export default function WorkspaceLoading() {
  return <div className="workspace-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading your workspace</span>
    <div className="skeleton-block" />
    <div className="skeleton-block large" />
    <div className="skeleton-block large" />
  </div>;
}