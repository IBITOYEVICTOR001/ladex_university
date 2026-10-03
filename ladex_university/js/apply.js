import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const form = document.querySelector('#application-form');
const response = form?.querySelector('.form-response');
const access = document.querySelector('#application-access');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const reference = () => { const values = new Uint32Array(6); crypto.getRandomValues(values); return `LU-${Array.from(values, value => alphabet[value % alphabet.length]).join('')}`; };

onAuthStateChanged(auth, async user => {
  if (!user) { location.href = 'student/register.html?apply=1'; return; }
  if (!user.emailVerified) { access.hidden = false; access.replaceChildren(); const message = document.createElement('p'), link = document.createElement('a'); message.textContent = 'Please verify your email address before applying. '; link.href = 'student/dashboard.html'; link.textContent = 'Return to your dashboard'; message.append(link); access.append(message); return; }
  try {
    if ((await getDoc(doc(db, 'applications', user.uid))).exists()) { location.href = 'student/dashboard.html'; return; }
    form.elements.email.value = user.email; form.hidden = false;
  } catch { access.hidden = false; access.textContent = 'Your application status could not be checked. Please try again.'; }
});

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const values = new FormData(form);
  if (String(values.get('website') || '').trim()) return;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  response.textContent = '';
  try {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) { location.href = 'student/dashboard.html'; return; }
    await setDoc(doc(db, 'applications', user.uid), {
      uid: user.uid,
      reference: reference(),
      fullName: String(values.get('fullName') || '').trim(),
      email: user.email,
      phone: String(values.get('phone') || '').trim(),
      dateOfBirth: String(values.get('dateOfBirth') || '').trim(),
      programme: String(values.get('programme') || '').trim(),
      lastSchool: String(values.get('lastSchool') || '').trim(),
      statement: String(values.get('statement') || '').trim(),
      status: 'new',
      createdAt: serverTimestamp()
    });
    location.href = 'student/dashboard.html';
  } catch { response.textContent = 'Your application could not be sent. Please try again.'; } finally { submit.disabled = false; }
});
