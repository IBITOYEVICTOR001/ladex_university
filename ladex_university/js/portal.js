import { auth, db } from './firebase.js';
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStudentRecord } from './student-role.js';

const value = item => item === undefined || item === null || item === '' ? '—' : String(item);
const profile = document.querySelector('#portal-profile');
const photo = document.querySelector('#portal-photo');
const message = document.querySelector('#portal-message');

const showProfile = student => {
  document.querySelector('#portal-name').textContent = value(student.fullName);
  document.querySelector('#portal-matric').textContent = value(student.matricNumber);
  const heading = document.createElement('h2'), fields = document.createElement('dl'); heading.textContent = 'Profile'; fields.className = 'portal-profile-grid';
  [['Matric number', student.matricNumber], ['Programme', student.programme], ['Department', student.department], ['Faculty', student.faculty], ['Level', student.level ? `${student.level} Level` : '—'], ['Session', student.session], ['Entry mode', student.entryMode], ['Email', student.email]].forEach(([label, item]) => { const term = document.createElement('dt'), detail = document.createElement('dd'); term.textContent = label; detail.textContent = value(item); fields.append(term, detail); });
  const term = document.createElement('dt'), detail = document.createElement('dd'), badge = document.createElement('span'); term.textContent = 'Status'; badge.className = 'portal-active'; badge.textContent = 'Active'; detail.append(badge); fields.append(term, detail); profile.replaceChildren(heading, fields);
};
const showPhoto = async uid => {
  photo.dataset.placeholder = 'true'; // stops main.js swapping this image for a grey box
  photo.addEventListener('error', () => { photo.removeAttribute('src'); photo.hidden = true; console.warn('The passport photo could not be displayed.'); }, { once: true });
  try { const application = await getDoc(doc(db, 'applications', uid)); if (application.exists() && application.data().photo) { photo.src = application.data().photo; photo.hidden = false; return; } } catch { /* Older records can have no application or photo. */ }
  photo.removeAttribute('src'); photo.hidden = true;
};
const goToLogin = async () => { await signOut(auth); location.href = 'login.html'; };

onAuthStateChanged(auth, async user => {
  if (!user) { location.href = 'login.html'; return; }
  const student = await getStudentRecord(db, user.uid);
  if (!student) { location.href = 'dashboard.html'; return; }
  showProfile(student); showPhoto(user.uid);
});
document.querySelector('#portal-logout')?.addEventListener('click', goToLogin);
document.querySelector('#portal-change-password')?.addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; message.textContent = '';
  try { await sendPasswordResetEmail(auth, auth.currentUser.email); message.textContent = 'Password reset instructions have been sent to your email address.'; } catch { message.textContent = 'Could not send password reset instructions. Please try again.'; } finally { button.disabled = false; }
});
