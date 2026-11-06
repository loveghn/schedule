function dateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthlyWeekday(year, month, weekday, ordinal) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (ordinal === 'last') {
    const lastDate = new Date(Date.UTC(year, month, lastDay));
    return lastDay - ((lastDate.getUTCDay() - weekday + 7) % 7);
  }
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (Number(ordinal || 1) - 1) * 7;
  return day <= lastDay ? day : null;
}

export function getNextRecurrenceDate(date, recurrence) {
  if (!date || !recurrence || recurrence.frequency === 'none') return '';
  const [year, month, day] = date.split('-').map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));

  if (recurrence.frequency === 'daily') {
    current.setUTCDate(current.getUTCDate() + 1);
    return dateKey(current);
  }

  if (recurrence.frequency === 'weekly') {
    const weekdays = [...new Set((recurrence.weekdays || []).map(Number))].sort((a, b) => a - b);
    if (!weekdays.length) return '';
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = new Date(current);
      candidate.setUTCDate(candidate.getUTCDate() + offset);
      if (weekdays.includes(candidate.getUTCDay())) return dateKey(candidate);
    }
    return '';
  }

  if (recurrence.frequency === 'monthly') {
    for (let offset = 1; offset <= 120; offset += 1) {
      const monthStart = new Date(Date.UTC(year, month - 1 + offset, 1));
      const targetYear = monthStart.getUTCFullYear();
      const targetMonth = monthStart.getUTCMonth();
      const targetDay = recurrence.monthlyMode === 'weekday'
        ? monthlyWeekday(targetYear, targetMonth, Number(recurrence.monthlyWeekday || 0), recurrence.monthlyOrdinal || '1')
        : Number(recurrence.monthlyDay || day);
      const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      if (!targetDay || targetDay > lastDay) continue;
      return dateKey(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
    }
  }

  return '';
}

export function isRecurrenceWithinEnd(recurrence, date, occurrenceNumber) {
  if (!recurrence || recurrence.frequency === 'none') return false;
  if (recurrence.endType === 'date' && recurrence.endDate && date > recurrence.endDate) return false;
  if (recurrence.endType === 'count' && occurrenceNumber > Number(recurrence.count || 1)) return false;
  return true;
}
