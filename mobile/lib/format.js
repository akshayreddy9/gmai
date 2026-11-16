const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');

export function clock(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
}

// List date: "8:33 PM" today, "Nov 13" this year, "13/11/25" older.
export function listDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return clock(ts);
  if (d.getFullYear() === now.getFullYear()) return `${MON[d.getMonth()]} ${d.getDate()}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

// Message header: "8:33 PM", "Nov 7", or "5 days ago" for the last week.
export function headerDate(ts) {
  const diff = Date.now() - ts;
  const d = new Date(ts);
  if (new Date().toDateString() === d.toDateString()) return clock(ts);
  const days = Math.floor(diff / 86400000);
  if (days >= 2 && days <= 6) return `${days} days ago`;
  return listDate(ts);
}

// "Nov 11, 2026, 10:44 AM"
export const fullDate = (ts) => { const d = new Date(ts); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${clock(ts)}`; };

// "On Tue, 3 Nov at 9:47 PM"
export const quoteDate = (ts) => { const d = new Date(ts); return `On ${DAYS[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} at ${clock(ts)}`; };

export function fileSize(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
export const initial = (n) => (String(n || '?').trim()[0] || '?');
export const countLabel = (n) => (n > 99 ? '99+' : String(n));
