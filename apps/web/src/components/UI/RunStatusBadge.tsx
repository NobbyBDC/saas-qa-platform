import clsx from 'clsx';

type StatusKey = string;

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  // Uppercase — values returned by the Prisma/API layer
  QUEUED:    { label: 'Queued',    className: 'badge-neutral', dot: 'bg-slate-400' },
  RUNNING:   { label: 'Running',   className: 'badge-info',    dot: 'bg-blue-400 animate-pulse' },
  PASSED:    { label: 'Passed',    className: 'badge-success', dot: 'bg-green-400' },
  FAILED:    { label: 'Failed',    className: 'badge-danger',  dot: 'bg-red-400' },
  CANCELLED: { label: 'Cancelled', className: 'badge-neutral', dot: 'bg-slate-500' },
  TIMEOUT:   { label: 'Timeout',   className: 'badge-danger',  dot: 'bg-orange-400' },
  // Lowercase — values defined in shared-types RunStatus
  queued:    { label: 'Queued',    className: 'badge-neutral', dot: 'bg-slate-400' },
  running:   { label: 'Running',   className: 'badge-info',    dot: 'bg-blue-400 animate-pulse' },
  completed: { label: 'Passed',    className: 'badge-success', dot: 'bg-green-400' },
  failed:    { label: 'Failed',    className: 'badge-danger',  dot: 'bg-red-400' },
  cancelled: { label: 'Cancelled', className: 'badge-neutral', dot: 'bg-slate-500' },
};

const fallback = { label: 'Unknown', className: 'badge-neutral', dot: 'bg-slate-500' };

export function RunStatusBadge({ status }: { status: StatusKey }) {
  const config = statusConfig[status] ?? fallback;
  return (
    <span className={clsx('badge', config.className)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
