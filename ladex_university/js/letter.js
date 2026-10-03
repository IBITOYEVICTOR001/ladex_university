import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const redirect = () => { location.href = 'dashboard.html'; };

onAuthStateChanged(auth, async user => {
  if (!user) { redirect(); return; }
  try {
    const snap = await getDoc(doc(db, 'applications', user.uid));
    if (!snap.exists() || snap.data().status !== 'admitted') { redirect(); return; }
    const application = snap.data();
    document.querySelector('#letter-date').textContent = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    document.querySelector('#letter-name').textContent = application.fullName || user.displayName || 'Student';
    document.querySelector('#letter-programme').textContent = application.programme || 'your selected';
    document.querySelector('#letter-reference').textContent = application.reference || 'Pending';
    if (application.studentId) { const studentId = document.querySelector('#letter-student-id'); studentId.querySelector('span').textContent = application.studentId; studentId.hidden = false; }
  } catch { redirect(); }
});
document.querySelector('#print-letter').addEventListener('click', () => window.print());
