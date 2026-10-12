// Accepts a "return to" path only if it points inside this app, so a crafted link such as
// /login?next=https://evil.example cannot send someone to another site after they log in.
function safeLocalPath(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  if (!value.startsWith('/')) return null; // absolute URLs and relative paths
  if (value.startsWith('//') || value.startsWith('/\\')) return null; // protocol-relative URLs
  if (/[\u0000-\u001f\\]/.test(value)) return null; // control characters, CR/LF, backslashes
  return value;
}

module.exports = { safeLocalPath };
