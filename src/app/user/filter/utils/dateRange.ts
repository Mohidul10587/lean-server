function normalizeDateInput(value?: string) {
  if (!value) return null;

  const parsed = parseInt(value);
  if (isNaN(parsed)) return null;

  return parsed;
}

export function buildDateRange(year?: string, month?: string, day?: string) {
  const y = normalizeDateInput(year);
  const m = normalizeDateInput(month);
  const d = normalizeDateInput(day);

  if (!y) return null;

  let startDate: Date;
  let endDate: Date;

  // Day
  if (d && m) {
    startDate = new Date(Date.UTC(y, m - 1, d - 1, 18, 0, 0, 0));
    endDate = new Date(Date.UTC(y, m - 1, d, 17, 59, 59, 999));
  }

  // Month
  else if (m) {
    startDate = new Date(Date.UTC(y, m - 1, 0, 18, 0, 0, 0));
    endDate = new Date(Date.UTC(y, m, 0, 17, 59, 59, 999));
  }

  // Year
  else {
    startDate = new Date(Date.UTC(y, 0, 0, 18, 0, 0, 0));
    endDate = new Date(Date.UTC(y, 11, 31, 17, 59, 59, 999));
  }

  return {
    startDate,
    endDate,
  };
}
