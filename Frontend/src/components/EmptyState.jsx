export default function EmptyState({ title, description, action }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 h-16 w-16 rounded-full border border-primary/25 bg-primary/10" />
      <h3 className="font-display text-2xl text-text">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
