import { db } from './firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const form = document.querySelector('#application-form');
const response = form?.querySelector('.form-response');
const confirmation = document.querySelector('#application-confirmation');

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const values = new FormData(form);
  if (String(values.get('website') || '').trim()) return;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  response.textContent = '';
  try {
    const application = {
      fullName: String(values.get('fullName') || '').trim(),
      email: String(values.get('email') || '').trim(),
      phone: String(values.get('phone') || '').trim(),
      dateOfBirth: String(values.get('dateOfBirth') || '').trim(),
      programme: String(values.get('programme') || '').trim(),
      lastSchool: String(values.get('lastSchool') || '').trim(),
      statement: String(values.get('statement') || '').trim(),
      status: 'new',
      createdAt: serverTimestamp()
    };
    const saved = await addDoc(collection(db, 'applications'), application);
    form.hidden = true;
    confirmation.hidden = false;
    confirmation.textContent = `Your application has been received. Your reference number is LU-${saved.id.slice(0, 6).toUpperCase()}. Please keep it.`;
  } catch {
    response.textContent = 'Your application could not be sent. Please try again.';
  } finally {
    submit.disabled = false;
  }
});
