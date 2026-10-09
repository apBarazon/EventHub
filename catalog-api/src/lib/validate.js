'use strict';
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validateSignup(b = {}) {
  const errors = [];
  const name = str(b.name), email = str(b.email).toLowerCase(), password = typeof b.password === 'string' ? b.password : '';
  if (name.length < 2 || name.length > 100) errors.push('Name must be 2-100 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) errors.push('Enter a valid email.');
  if (password.length < 8) errors.push('Password must be at least 8 characters.');
  return { errors, value: { name, email, password } };
}

function validateEvent(b = {}) {
  const errors = [];
  const title = str(b.title), description = str(b.description), location = str(b.location) || 'School Campus';
  const image_url = str(b.image_url), max = Number(b.max_participants);
  const rawDate = str(b.event_date);
  if (title.length < 3 || title.length > 120) errors.push('Title must be 3-120 characters.');
  if (!description || description.length > 2000) errors.push('Description is required (max 2000 characters).');
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(rawDate)) errors.push('Date and time are required.');
  if (!/^https?:\/\/\S+$/i.test(image_url) || image_url.length > 500) errors.push('Image must be a valid http(s) URL.');
  if (!Number.isInteger(max) || max < 1 || max > 10000) errors.push('Max participants must be 1-10000.');
  if (location.length > 120) errors.push('Location is too long.');
  const event_date = rawDate.slice(0, 16).replace('T', ' ') + ':00';
  return { errors, value: { title, description, event_date, location, image_url, max_participants: max } };
}

function validateRegistration(b = {}) {
  const errors = [];
  const full_name = str(b.full_name), student_id = str(b.student_id), course_year = str(b.course_year);
  const contact = str(b.contact), reason = str(b.reason);
  if (full_name.length < 2 || full_name.length > 100) errors.push('Full name is required.');
  if (student_id.length < 3 || student_id.length > 30) errors.push('Student ID is required.');
  if (!course_year || course_year.length > 50) errors.push('Course and year is required.');
  if (!/^[0-9+\-\s]{7,20}$/.test(contact)) errors.push('Enter a valid contact number.');
  if (reason.length > 500) errors.push('Reason is too long (max 500).');
  return { errors, value: { full_name, student_id, course_year, contact, reason: reason || null } };
}

// Approval rule: approve only while seats remain, otherwise reject.
function decideApproval(approvedCount, maxParticipants) {
  return approvedCount < maxParticipants ? 'approved' : 'rejected';
}

module.exports = { validateSignup, validateEvent, validateRegistration, decideApproval };
