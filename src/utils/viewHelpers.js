// Small formatting helpers exposed to every EJS view through app.locals.
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_BADGES = {
  draft: 'text-bg-secondary',
  published: 'text-bg-success',
  archived: 'text-bg-dark',
};

const PROGRESS_LABELS = {
  not_started: { label: 'Not started', badge: 'text-bg-light border' },
  in_progress: { label: 'In progress', badge: 'text-bg-primary' },
  completed: { label: 'Completed', badge: 'text-bg-success' },
};

module.exports = {
  formatDate: (value) => (value ? dateFormat.format(new Date(value)) : ''),
  formatDateTime: (value) => (value ? dateTimeFormat.format(new Date(value)) : ''),
  statusBadge: (status) => STATUS_BADGES[status] || 'text-bg-light',
  progressLabel: (status) => (PROGRESS_LABELS[status] || { label: status }).label,
  progressBadge: (status) => (PROGRESS_LABELS[status] || {}).badge || 'text-bg-light',
  // Rebuilds the catalogue query string, keeping current filters and applying overrides.
  // Default values are left out so URLs stay short.
  catalogueQueryString: (params, overrides = {}) => {
    const merged = { ...params, ...overrides };
    const search = new URLSearchParams();
    for (const key of ['q', 'category', 'status', 'instructor']) {
      if (merged[key]) search.set(key, merged[key]);
    }
    if (merged.sort && merged.sort !== 'created') search.set('sort', merged.sort);
    if (merged.dir && merged.dir !== 'desc') search.set('dir', merged.dir);
    if (merged.page && merged.page > 1) search.set('page', String(merged.page));
    return search.toString();
  },
  truncate: (value, max = 120) => {
    const text = value === null || value === undefined ? '' : String(value);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  },
};
