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

module.exports = {
  formatDate: (value) => (value ? dateFormat.format(new Date(value)) : ''),
  formatDateTime: (value) => (value ? dateTimeFormat.format(new Date(value)) : ''),
  statusBadge: (status) => STATUS_BADGES[status] || 'text-bg-light',
};
