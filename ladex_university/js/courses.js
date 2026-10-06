import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStudentRecord } from './student-role.js';

const target = document.querySelector('#student-courses');
const levelFilter = document.querySelector('#student-course-level');
let student, courses = [];
const value = item => item === undefined || item === null || item === '' ? '—' : String(item);
const courseOrder = (a, b) => String(a.code || '').localeCompare(String(b.code || ''));
const drawSemester = (semester, rows) => {
  const section = document.createElement('section'), heading = document.createElement('h3'), wrap = document.createElement('div'), table = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody'), headerRow = document.createElement('tr'), total = document.createElement('p'); heading.textContent = `${semester} semester`; wrap.className = 'table-wrap'; table.className = 'course-table'; ['Code','Title','Units','Type'].forEach(text => { const cell = document.createElement('th'); cell.textContent = text; headerRow.append(cell); }); head.append(headerRow); rows.sort(courseOrder).forEach(course => { const row = document.createElement('tr'); [course.code,course.title,course.units,course.type].forEach(item => { const cell = document.createElement('td'); cell.textContent = value(item); row.append(cell); }); body.append(row); }); table.append(head, body); wrap.append(table); total.className = 'course-total'; total.textContent = `Total units: ${rows.reduce((sum, course) => sum + (Number.isInteger(course.units) ? course.units : 0), 0)}`; section.append(heading, wrap, total); return section;
};
const render = () => {
  if (!student) return;
  const level = Number(levelFilter.value), filtered = courses.filter(course => Number(course.level) === level && (course.department === student.department || course.department === 'All'));
  target.replaceChildren();
  if (!filtered.length) { target.textContent = 'No courses have been published for this level yet.'; return; }
  ['First','Second'].forEach(semester => { const rows = filtered.filter(course => course.semester === semester); if (rows.length) target.append(drawSemester(semester, rows)); });
};
onAuthStateChanged(auth, async user => {
  if (!user) { location.href = 'login.html'; return; }
  student = await getStudentRecord(db, user.uid);
  if (!student) { location.href = 'dashboard.html'; return; }
  levelFilter.value = String(student.level || 100);
  try { const snapshot = await getDocs(collection(db, 'courses')); courses = snapshot.docs.map(item => item.data()); render(); } catch { target.textContent = 'Courses could not be loaded. Please try again.'; }
});
levelFilter?.addEventListener('change', render);
