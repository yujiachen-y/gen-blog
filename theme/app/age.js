// How faded a post's ink and paper are, on a 0..1 scale.
// Shared by the generator and the client; CSS turns the number into colours.
// ponytail: fully aged at 8 years; widen AGE_SPAN_YEARS if the archive grows much older.
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const AGE_SPAN_YEARS = 8;

export const ageOf = (date, now = Date.now()) => {
  const age = (now - Date.parse(date)) / YEAR_MS / AGE_SPAN_YEARS;
  return Math.round(Math.min(1, Math.max(0, age || 0)) * 1000) / 1000;
};

// A year's ink is the ink of its middle.
export const yearAge = (year, now) => ageOf(`${year}-07-01`, now);
