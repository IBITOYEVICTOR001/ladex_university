import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const errorMessage = error => ({
  'auth/wrong-password': 'The password is incorrect. Please try again.',
  'auth/invalid-credential': 'The email or password is incorrect. Please try again.',
  'auth/user-not-found': 'No account was found with that email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a while before trying again.',
  'auth/email-already-in-use': 'An account already exists with that email address.',
  'auth/weak-password': 'Please choose a password with at least 8 characters.'
}[error.code] || 'Something went wrong. Please try again.');
const setResponse = (form, message) => { form.querySelector('.form-response').textContent = message; };
const dateText = value => { const date = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(date.getTime()) ? 'Date pending' : new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(date); };

const registerForm = document.querySelector('#student-register-form');
const applyAccessNote = document.querySelector('#apply-access-note');
if (applyAccessNote && new URLSearchParams(location.search).has('apply')) applyAccessNote.hidden = false;
registerForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!registerForm.checkValidity()) { registerForm.reportValidity(); return; }
  const data = new FormData(registerForm), password = String(data.get('password'));
  if (password !== String(data.get('confirmPassword'))) { setResponse(registerForm, 'Your passwords do not match.'); return; }
  const submit = registerForm.querySelector('button[type="submit"]'); submit.disabled = true; setResponse(registerForm, '');
  try {
    const credential = await createUserWithEmailAndPassword(auth, String(data.get('email')).trim(), password);
    await updateProfile(credential.user, { displayName: String(data.get('fullName')).trim() });
    await sendEmailVerification(credential.user);
    location.href = 'dashboard.html';
  } catch (error) { setResponse(registerForm, errorMessage(error)); } finally { submit.disabled = false; }
});

const loginForm = document.querySelector('#student-login-form');
loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }
  const data = new FormData(loginForm), submit = loginForm.querySelector('button[type="submit"]'); submit.disabled = true; setResponse(loginForm, '');
  try { await signInWithEmailAndPassword(auth, String(data.get('email')).trim(), String(data.get('password'))); location.href = 'dashboard.html'; } catch (error) { setResponse(loginForm, errorMessage(error)); } finally { submit.disabled = false; }
});
document.querySelector('#forgot-password')?.addEventListener('click', async event => {
  event.preventDefault(); const email = loginForm?.elements.email.value.trim();
  if (!email) { setResponse(loginForm, 'Enter your email address first, then select Forgot password.'); return; }
  try { await sendPasswordResetEmail(auth, email); setResponse(loginForm, 'Password reset instructions have been sent to your email address.'); } catch (error) { setResponse(loginForm, errorMessage(error)); }
});

const applicationTarget = document.querySelector('#student-application');
const showDashboard = async user => {
  await user.reload();
  await user.getIdToken(true);
  document.querySelector('#student-name').textContent = user.displayName || 'Your account';
  document.querySelector('#student-email').textContent = user.email || '';
  const banner = document.querySelector('#verification-banner'); banner.hidden = user.emailVerified;
  const snap = await getDoc(doc(db, 'applications', user.uid)); applicationTarget.replaceChildren();
  if (!snap.exists()) {
    const message = document.createElement('p'); message.textContent = user.emailVerified ? 'You have not submitted an application yet.' : 'Verify your email to start your application.';
    applicationTarget.append(message);
    if (user.emailVerified) { const link = document.createElement('a'); link.className = 'button button-gold'; link.href = '../apply.html'; link.textContent = 'Apply now'; applicationTarget.append(link); }
    return;
  }
  const application = snap.data(), status = application.status || 'new', title = document.createElement('h3'), details = document.createElement('div'); title.textContent = 'Your application'; details.className = 'notice';
  [['Reference number', application.reference], ['Programme', application.programme], ['Submitted', dateText(application.createdAt)], ['Current status', application.status || 'new'], ['Student ID', application.studentId]].forEach(([label, value]) => { if (value) { const row = document.createElement('p'), name = document.createElement('strong'); name.textContent = `${label}: `; row.append(name, document.createTextNode(value)); details.append(row); } });
  const progress = document.createElement('ol'); progress.className = 'application-progress'; progress.setAttribute('aria-label', 'Application progress');
  const currentStep = status === 'reviewing' ? 1 : ['admitted', 'rejected'].includes(status) ? 2 : 0;
  ['Submitted', 'Under review', 'Decision', 'Letter'].forEach((step, index) => { const item = document.createElement('li'); item.textContent = step; if (index === currentStep) item.className = 'is-current'; progress.append(item); });
  applicationTarget.append(title, details, progress);
  if (status === 'admitted') {
    const panel = document.createElement('div'), message = document.createElement('p'), link = document.createElement('a'); panel.className = 'notice'; message.textContent = 'Congratulations! You have been admitted to Ladex International University.'; link.className = 'button button-gold'; link.href = 'letter.html'; link.textContent = 'View admission letter'; panel.append(message, link); applicationTarget.append(panel);
  } else if (status === 'rejected') {
    const panel = document.createElement('div'), message = document.createElement('p'), link = document.createElement('a'); panel.className = 'notice'; message.textContent = 'Thank you for applying to Ladex. We are sorry that we cannot offer you admission at this time. '; link.href = '../contact.html'; link.textContent = 'Contact Admissions'; message.append(link); panel.append(message); applicationTarget.append(panel);
  }
};
onAuthStateChanged(auth, user => { if (loginForm && user) { location.href = 'dashboard.html'; return; } if (applicationTarget) { if (!user) { location.href = 'login.html'; return; } showDashboard(user).catch(() => { applicationTarget.textContent = 'Your application details could not be loaded. Please try again.'; }); } });
document.querySelector('#resend-verification')?.addEventListener('click', async event => { const button = event.currentTarget, response = button.parentElement.querySelector('.form-response'); button.disabled = true; try { await sendEmailVerification(auth.currentUser); response.textContent = 'A new verification email has been sent.'; } catch (error) { response.textContent = errorMessage(error); } finally { button.disabled = false; } });
document.querySelector('#change-password')?.addEventListener('click', async event => { const button = event.currentTarget, response = button.parentElement.querySelector('.form-response'); button.disabled = true; try { await sendPasswordResetEmail(auth, auth.currentUser.email); response.textContent = 'Password reset instructions have been sent to your email address.'; } catch (error) { response.textContent = errorMessage(error); } finally { button.disabled = false; } });
document.querySelector('#student-logout')?.addEventListener('click', () => signOut(auth));
