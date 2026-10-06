import { calcGpa } from './grading.js';

const SEMESTER_ORDER = { First: 1, Second: 2 };

// Class of degree on the 5-point scale used in Nigerian universities.
export const classFor = cgpa => {
  if (cgpa >= 4.5) return 'First Class';
  if (cgpa >= 3.5) return 'Second Class Upper';
  if (cgpa >= 2.4) return 'Second Class Lower';
  if (cgpa >= 1.5) return 'Third Class';
  if (cgpa >= 1.0) return 'Pass';
  return 'Below pass mark';
};

const usable = rows => rows.filter(row => Number(row.units) > 0 && Number.isFinite(Number(row.point)));

// Total credit units, total quality points and GPA for a list of results.
export const totals = rows => {
  const valid = usable(rows);
  return {
    tcu: valid.reduce((sum, row) => sum + Number(row.units), 0),
    tqp: valid.reduce((sum, row) => sum + Number(row.point) * Number(row.units), 0),
    gpa: calcGpa(valid)
  };
};

const sessionOf = row => String(row.session || '');
const semesterOf = row => String(row.semester || '');

// Groups published results by session and semester (oldest first) and adds
// the semester GPA and the cumulative CGPA after each semester.
export const buildReport = results => {
  const rows = results.filter(row => row && typeof row.code === 'string' && row.code);
  const map = new Map();
  rows.forEach(row => {
    const key = `${sessionOf(row)}|${semesterOf(row)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  const groups = Array.from(map.entries())
    .map(([key, items]) => ({
      key,
      session: sessionOf(items[0]),
      semester: semesterOf(items[0]),
      level: items[0].level,
      rows: items.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)))
    }))
    .sort((a, b) => a.session.localeCompare(b.session) || (SEMESTER_ORDER[a.semester] || 9) - (SEMESTER_ORDER[b.semester] || 9));
  const running = [];
  groups.forEach(group => {
    group.semesterTotals = totals(group.rows);
    running.push(...group.rows);
    group.cumulativeTotals = totals(running);
  });
  const overall = totals(rows);
  return { groups, overall: { ...overall, standing: classFor(overall.gpa) } };
};
