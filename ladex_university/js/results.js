import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStudentRecord } from './student-role.js';
import { GRADE_KEY } from './grading.js';
import { buildReport } from './results-calc.js';

const studentCard = document.querySelector('#results-student');
const summary = document.querySelector('#results-summary');
const groupsBox = document.querySelector('#results-groups');
const keyBox = document.querySelector('#results-key');
const printButton = document.querySelector('#print-results');
const printedOn = document.querySelector('#results-printed');

const value = item => item === undefined || item === null || item === '' ? '—' : String(item);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const twoDecimals = number => Number(number).toFixed(2);

const showStudent = student => {
  const heading = element('h2', '', value(student.fullName));
  const list = element('dl', 'results-student-grid');
  [
    ['Matric number', student.matricNumber],
    ['Programme', student.programme],
    ['Department', student.department],
    ['Faculty', student.faculty],
    ['Current level', student.level ? `${student.level} Level` : '—'],
    ['Session', student.session]
  ].forEach(([label, item]) => list.append(element('dt', '', label), element('dd', '', value(item))));
  studentCard.replaceChildren(heading, list);
};

const showSummary = overall => {
  const items = [
    ['Cumulative GPA (CGPA)', twoDecimals(overall.gpa), 'results-stat results-stat-main'],
    ['Total credit units', String(overall.tcu), 'results-stat'],
    ['Total quality points', String(overall.tqp), 'results-stat'],
    ['Current standing', overall.standing, 'results-stat']
  ];
  const cards = items.map(([label, figure, className]) => {
    const card = element('div', className);
    card.append(element('span', 'results-stat-label', label), element('strong', 'results-stat-value', figure));
    return card;
  });
  const note = element('p', 'results-note', 'Your class of degree is awarded at graduation. The standing shown here is where your CGPA stands today.');
  summary.replaceChildren(...cards, note);
};

const gradeCell = row => {
  const cell = element('td');
  cell.append(element('span', `grade-pill grade-${value(row.grade).toLowerCase()}`, value(row.grade)));
  return cell;
};

const drawGroup = group => {
  const section = element('section', 'results-group');
  const level = group.level ? `${group.level} Level` : '';
  section.append(element('h3', '', `${value(group.session)} session, ${value(group.semester)} semester${level ? `, ${level}` : ''}`));
  const wrap = element('div', 'table-wrap');
  const table = element('table', 'results-table');
  const head = element('thead');
  const headRow = element('tr');
  ['Code', 'Title', 'Units', 'CA', 'Exam', 'Total', 'Grade', 'Points'].forEach(text => headRow.append(element('th', '', text)));
  head.append(headRow);
  const body = element('tbody');
  group.rows.forEach(row => {
    const tr = element('tr');
    [row.code, row.title, row.units, row.ca, row.exam, row.total].forEach(item => tr.append(element('td', '', value(item))));
    tr.append(gradeCell(row), element('td', '', value(row.point)));
    body.append(tr);
  });
  table.append(head, body);
  wrap.append(table);
  const semester = group.semesterTotals;
  const cumulative = group.cumulativeTotals;
  const line = element('p', 'results-totals');
  line.append(
    element('span', '', `Semester: ${semester.tcu} units, ${semester.tqp} quality points, GPA ${twoDecimals(semester.gpa)}`),
    element('span', '', `Cumulative so far: ${cumulative.tcu} units, CGPA ${twoDecimals(cumulative.gpa)}`)
  );
  section.append(wrap, line);
  return section;
};

const drawKey = () => {
  const heading = element('h3', '', 'Grading key');
  const wrap = element('div', 'table-wrap');
  const table = element('table', 'results-table results-key-table');
  const head = element('thead');
  const headRow = element('tr');
  ['Score', 'Grade', 'Points'].forEach(text => headRow.append(element('th', '', text)));
  head.append(headRow);
  const body = element('tbody');
  GRADE_KEY.forEach(item => {
    const tr = element('tr');
    [item.range, item.grade, item.point].forEach(text => tr.append(element('td', '', String(text))));
    body.append(tr);
  });
  table.append(head, body);
  wrap.append(table);
  keyBox.replaceChildren(heading, wrap);
};

const render = results => {
  const report = buildReport(results);
  if (!report.groups.length) {
    summary.replaceChildren();
    groupsBox.replaceChildren(element('p', 'results-empty', 'No results have been published yet. They will appear here as soon as the university publishes them.'));
    return;
  }
  showSummary(report.overall);
  groupsBox.replaceChildren(...report.groups.map(drawGroup));
  drawKey();
  printButton.hidden = false;
};

onAuthStateChanged(auth, async user => {
  if (!user) { location.href = 'login.html'; return; }
  const student = await getStudentRecord(db, user.uid);
  if (!student) { location.href = 'dashboard.html'; return; }
  showStudent(student);
  try {
    // The rules only allow a student to read their own PUBLISHED results,
    // so the query must filter on both fields.
    const snapshot = await getDocs(query(collection(db, 'results'), where('uid', '==', user.uid), where('published', '==', true)));
    render(snapshot.docs.map(item => item.data()));
  } catch (error) {
    console.error('Results load failed:', error.code, error.message);
    groupsBox.replaceChildren(element('p', 'results-empty', 'Your results could not be loaded. Please refresh the page and try again.'));
  }
});

printButton?.addEventListener('click', () => {
  if (printedOn) printedOn.textContent = `Printed on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  window.print();
});
