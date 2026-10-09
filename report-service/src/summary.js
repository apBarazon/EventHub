'use strict';
const fillRate = (approved, max) => (max > 0 ? Math.round((approved / max) * 100) : 0);

// rows: one per event with numeric approved / pending / rejected counts
function buildSummary(rows, totalUsers = 0) {
  const events = rows.map((r) => ({
    id: r.id, title: r.title, event_date: r.event_date, max_participants: r.max_participants,
    approved: Number(r.approved), pending: Number(r.pending), rejected: Number(r.rejected),
    fill_rate: fillRate(Number(r.approved), r.max_participants),
    is_full: Number(r.approved) >= r.max_participants,
  }));
  const sum = (k) => events.reduce((a, e) => a + e[k], 0);
  const popular = [...events].sort((a, b) => (b.approved + b.pending) - (a.approved + a.pending))[0] || null;
  return {
    totals: {
      events: events.length, users: Number(totalUsers),
      registrations: sum('approved') + sum('pending') + sum('rejected'),
      approved: sum('approved'), pending: sum('pending'), rejected: sum('rejected'),
      full_events: events.filter((e) => e.is_full).length,
    },
    most_popular: popular && { id: popular.id, title: popular.title },
    events,
  };
}

module.exports = { buildSummary, fillRate };
