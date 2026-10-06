export const GRADE_KEY = [
  { range: '70–100', grade: 'A', point: 5 },
  { range: '60–69', grade: 'B', point: 4 },
  { range: '50–59', grade: 'C', point: 3 },
  { range: '45–49', grade: 'D', point: 2 },
  { range: '40–44', grade: 'E', point: 1 },
  { range: '0–39', grade: 'F', point: 0 }
];

export const gradeFor = total => {
  const score = Number(total);
  if (score >= 70) return { grade: 'A', point: 5 };
  if (score >= 60) return { grade: 'B', point: 4 };
  if (score >= 50) return { grade: 'C', point: 3 };
  if (score >= 45) return { grade: 'D', point: 2 };
  if (score >= 40) return { grade: 'E', point: 1 };
  return { grade: 'F', point: 0 };
};

export const calcGpa = entries => {
  const valid = entries.filter(entry => Number(entry.units) > 0);
  const units = valid.reduce((sum, entry) => sum + Number(entry.units), 0);
  return units ? Number((valid.reduce((sum, entry) => sum + Number(entry.point) * Number(entry.units), 0) / units).toFixed(2)) : 0;
};
