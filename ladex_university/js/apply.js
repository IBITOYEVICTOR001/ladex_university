import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const form = document.querySelector('#application-form');
const response = form?.querySelector('.form-response');
const access = document.querySelector('#application-access');
const olevelRows = document.querySelector('#olevel-rows');
const addSubject = document.querySelector('.add-subject');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const reference = () => { const values = new Uint32Array(6); crypto.getRandomValues(values); return `LU-${Array.from(values, value => alphabet[value % alphabet.length]).join('')}`; };
const requiredFields = { gender: 'Select your gender.', stateOfOrigin: 'Select your state of origin.', lga: 'Enter your local government area.', address: 'Enter your home address.', entryMode: 'Select your entry mode.', nextOfKinName: 'Enter your next of kin name.', nextOfKinPhone: 'Enter your next of kin phone number.' };
const addOlevelRow = () => { if (!olevelRows || olevelRows.children.length >= 9) return; const row = document.createElement('div'), subject = document.createElement('input'), grade = document.createElement('select'); row.className = 'olevel-row'; subject.name = 'olevelSubject'; subject.setAttribute('list', 'olevel-subjects'); subject.setAttribute('aria-label', "O'level subject"); grade.name = 'olevelGrade'; grade.setAttribute('aria-label', "O'level grade"); grade.append(new Option('Grade', ''), ...['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'].map(value => new Option(value))); row.append(subject, grade); olevelRows.append(row); if (addSubject) addSubject.hidden = olevelRows.children.length >= 9; };
for (let index = 0; index < 5; index += 1) addOlevelRow();
addSubject?.addEventListener('click', addOlevelRow);
form?.elements.entryMode?.addEventListener('change', event => { const score = form.elements.jambScore, field = document.querySelector('#jamb-score-field'), isUtme = event.target.value === 'UTME'; field.hidden = !isUtme; score.value = isUtme ? score.value : ''; });

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
  Object.entries(requiredFields).forEach(([name, message]) => { const field = form.elements[name]; field.setCustomValidity(String(field.value).trim() ? '' : message); });
  if (!form.checkValidity()) { const invalid = Object.entries(requiredFields).find(([name]) => !String(form.elements[name].value).trim()); response.textContent = invalid ? invalid[1] : 'Please complete all required fields.'; form.reportValidity(); return; }
  const values = new FormData(form);
  if (String(values.get('website') || '').trim()) return;
  const olevel = Array.from(olevelRows?.querySelectorAll('.olevel-row') || []).map(row => {
    const subject = row.querySelector('[name="olevelSubject"]').value.trim(), grade = row.querySelector('[name="olevelGrade"]').value.trim();
    return subject && grade ? `${subject}: ${grade}` : '';
  }).filter(Boolean).join('; ');
  if (olevel.length > 600) { response.textContent = "Your O'level results must be 600 characters or fewer."; return; }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  response.textContent = '';
  try {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) { location.href = 'student/dashboard.html'; return; }
    await user.reload();
    await user.getIdToken(true);
    const application = {
      uid: user.uid,
      reference: reference(),
      fullName: String(values.get('fullName') || '').trim(),
      email: user.email,
      phone: String(values.get('phone') || '').trim(),
      dateOfBirth: String(values.get('dateOfBirth') || '').trim(),
      programme: String(values.get('programme') || '').trim(),
      lastSchool: String(values.get('lastSchool') || '').trim(),
      statement: String(values.get('statement') || '').trim(),
      gender: String(values.get('gender') || '').trim(),
      stateOfOrigin: String(values.get('stateOfOrigin') || '').trim(),
      lga: String(values.get('lga') || '').trim(),
      address: String(values.get('address') || '').trim(),
      entryMode: String(values.get('entryMode') || '').trim(),
      nextOfKinName: String(values.get('nextOfKinName') || '').trim(),
      nextOfKinPhone: String(values.get('nextOfKinPhone') || '').trim(),
      status: 'new',
      createdAt: serverTimestamp()
    };
    const optional = { jambRegNo: String(values.get('jambRegNo') || '').trim(), secondChoice: String(values.get('secondChoice') || '').trim(), nextOfKinRelationship: String(values.get('nextOfKinRelationship') || '').trim(), olevel };
    Object.entries(optional).forEach(([key, value]) => { if (value) application[key] = value; });
    const jambScore = String(values.get('jambScore') || '').trim();
    if (jambScore) application.jambScore = Number(jambScore);
    await setDoc(doc(db, 'applications', user.uid), application);
    location.href = 'student/dashboard.html';
  } catch { response.textContent = 'Your application could not be sent. Please try again.'; } finally { submit.disabled = false; }
});
