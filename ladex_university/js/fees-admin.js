import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { balanceOf, buildInvoice, canCancel, canEdit, canEditAmount, canRecordPayment, formatNaira, invoiceId, isOverdue, statusFor, summarise, validateEdit, validateInvoiceInput, validatePayment, validateStudentForInvoice } from './fees-calc.js';

const createForm = document.querySelector('#fee-create-form');
const createMessage = document.querySelector('#fee-create-message');
const listMessage = document.querySelector('#fee-list-message');
const listBox = document.querySelector('#fee-list');
const totalsBox = document.querySelector('#fee-totals');
const panel = document.querySelector('#fee-open-panel');
const scopeInputs = document.querySelectorAll('input[name="scope"]');
const studentWrap = document.querySelector('#fee-student-wrap');
const levelWrap = document.querySelector('#fee-level-wrap');
let invoices = [];
let students = [];
let selectedId = '';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const today = () => new Date().toISOString().slice(0, 10);
const dataValue = invoice => ({ id: invoice.id, ...invoice });
const inputValue = (form, name) => String(new FormData(form).get(name) || '').trim();
const dateTime = value => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-GB') : '—';
};
const setError = (name, text = '') => { const box = document.querySelector(`#fee-${name}-error`); if (box) box.textContent = text; };
const clearCreateErrors = () => ['type', 'session', 'semester', 'amount', 'due-date', 'description', 'student', 'level'].forEach(name => setError(name));
const statusLabel = invoice => isOverdue(invoice) ? 'Overdue' : invoice.status;

const showWriteFailure = async (message, error) => {
  console.error('Invoice write failed:', error?.code, error?.message);
  createMessage.textContent = message;
  await loadInvoices();
};

const updateScope = () => {
  const levelScope = document.querySelector('input[name="scope"]:checked')?.value === 'level';
  studentWrap.hidden = levelScope;
  levelWrap.hidden = !levelScope;
  setError('student');
  setError('level');
};

const filteredInvoices = () => {
  const search = document.querySelector('#fee-search').value.trim().toLowerCase();
  const session = document.querySelector('#fee-filter-session').value;
  const semester = document.querySelector('#fee-filter-semester').value;
  const status = document.querySelector('#fee-filter-status').value;
  return invoices.filter(invoice => {
    const matchesSearch = !search || String(invoice.matricNumber || '').toLowerCase().includes(search) || String(invoice.fullName || '').toLowerCase().includes(search);
    const matchesStatus = !status || (status === 'overdue' ? isOverdue(invoice) : invoice.status === status);
    return matchesSearch && (!session || invoice.session === session) && (!semester || invoice.semester === semester) && matchesStatus;
  });
};

const drawTotals = rows => {
  const totals = summarise(rows);
  totalsBox.replaceChildren(...[
    ['Outstanding', formatNaira(totals.outstanding)], ['Billed', formatNaira(totals.billed)], ['Paid', formatNaira(totals.paid)], ['Overdue invoices', String(totals.overdue)]
  ].map(([label, figure]) => {
    const card = element('div', 'fees-stat');
    card.append(element('span', '', label), element('strong', '', figure));
    return card;
  }));
};

const drawList = () => {
  const rows = filteredInvoices();
  drawTotals(rows);
  listBox.replaceChildren();
  if (!rows.length) {
    listMessage.textContent = 'No invoices match these filters.';
    return;
  }
  listMessage.textContent = `${rows.length} invoice${rows.length === 1 ? '' : 's'} shown.`;
  rows.forEach(invoice => {
    const row = element('tr');
    [invoice.matricNumber, invoice.fullName, `${invoice.session} ${invoice.semester}`, invoice.feeType, formatNaira(invoice.amount), formatNaira(invoice.amountPaid), formatNaira(balanceOf(invoice))].forEach(value => row.append(element('td', '', String(value || '—'))));
    const status = element('td');
    status.append(element('span', `status-pill status-${isOverdue(invoice) ? 'overdue' : invoice.status}`, statusLabel(invoice)));
    const action = element('td');
    const button = element('button', 'button button-outline', 'Open');
    button.type = 'button';
    button.addEventListener('click', () => openInvoice(invoice.id));
    action.append(button);
    row.append(status, action);
    listBox.append(row);
  });
};

const refreshSessions = () => {
  const select = document.querySelector('#fee-filter-session');
  const current = select.value;
  const sessions = [...new Set(invoices.map(invoice => invoice.session).filter(Boolean))].sort();
  select.replaceChildren(element('option', '', 'All sessions'));
  select.firstChild.value = '';
  sessions.forEach(session => { const option = element('option', '', session); option.value = session; select.append(option); });
  select.value = sessions.includes(current) ? current : '';
};

async function loadInvoices() {
  listMessage.textContent = 'Loading invoices...';
  try {
    const snapshot = await getDocs(collection(db, 'invoices'));
    invoices = snapshot.docs.map(item => dataValue({ id: item.id, ...item.data() }));
    refreshSessions();
    drawList();
    if (selectedId) {
      const selected = invoices.find(invoice => invoice.id === selectedId);
      if (selected) openInvoice(selectedId);
      else { selectedId = ''; panel.hidden = true; }
    }
  } catch (error) {
    console.error('Invoice list failed:', error.code, error.message);
    listMessage.textContent = 'Invoices could not be loaded. Check your admin access and try again.';
  }
}

async function loadStudents() {
  try {
    const snapshot = await getDocs(collection(db, 'students'));
    students = snapshot.docs.map(item => item.data());
  } catch (error) {
    console.error('Student list failed:', error.code, error.message);
    createMessage.textContent = 'Students could not be loaded. Please refresh and try again.';
  }
}

const detailList = invoice => {
  const details = element('dl', 'fee-details');
  [['Invoice ID', invoice.id], ['Student account', invoice.uid], ['Student', invoice.fullName], ['Matric number', invoice.matricNumber], ['Department', invoice.department], ['Level', `${invoice.level} Level`], ['Session', invoice.session], ['Semester', invoice.semester], ['Fee type', invoice.feeType], ['Description', invoice.description], ['Due date', invoice.dueDate], ['Amount', formatNaira(invoice.amount)], ['Paid', formatNaira(invoice.amountPaid)], ['Balance', formatNaira(balanceOf(invoice))], ['Status', statusLabel(invoice)], ['Last reference', invoice.lastPaymentRef || '—'], ['Last payment at', dateTime(invoice.lastPaymentAt)], ['Created at', dateTime(invoice.createdAt)], ['Updated at', dateTime(invoice.updatedAt)]].forEach(([name, value]) => details.append(element('dt', '', name), element('dd', '', String(value))));
  return details;
};

const paymentForm = invoice => {
  const form = element('form');
  form.append(element('h3', '', 'Record payment'));
  const amountLabel = element('label', '', 'Amount (₦)');
  const amount = element('input'); amount.name = 'amount'; amount.inputMode = 'numeric'; amountLabel.append(amount);
  const amountError = element('small', 'fee-field-error'); amountLabel.append(amountError);
  const referenceLabel = element('label', '', 'Reference (optional)');
  const reference = element('input'); reference.name = 'reference'; reference.maxLength = 40; referenceLabel.append(reference);
  const referenceError = element('small', 'fee-field-error'); referenceLabel.append(referenceError);
  const fill = element('button', 'button button-outline', 'Fill full balance'); fill.type = 'button'; fill.addEventListener('click', () => { amount.value = String(balanceOf(invoice)); });
  const submit = element('button', 'button button-gold', 'Record payment'); submit.type = 'submit';
  const actions = element('div', 'button-row'); actions.append(fill, submit);
  form.append(amountLabel, referenceLabel, actions);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    amountError.textContent = ''; referenceError.textContent = '';
    const check = validatePayment(invoice, { amount: amount.value, reference: reference.value });
    if (!check.valid) { amountError.textContent = check.errors.amount || check.errors.invoice || ''; referenceError.textContent = check.errors.reference || ''; return; }
    if (!confirm(`Record ${formatNaira(amount.value)} against this invoice?`)) return;
    submit.disabled = true;
    try {
      const newPaid = Number(invoice.amountPaid) + Number(amount.value);
      await updateDoc(doc(db, 'invoices', invoice.id), { amountPaid: newPaid, status: statusFor(invoice.amount, newPaid), lastPaymentRef: reference.value.trim(), lastPaymentAt: serverTimestamp(), updatedAt: serverTimestamp() });
      createMessage.textContent = 'Payment recorded.';
      await loadInvoices();
    } catch (error) { await showWriteFailure('The payment could not be recorded. The invoice list was reloaded.', error); }
    finally { submit.disabled = false; }
  });
  return form;
};

const editForm = invoice => {
  const form = element('form');
  form.append(element('h3', '', 'Edit invoice'));
  const descriptionLabel = element('label', '', 'Description');
  const description = element('textarea'); description.value = invoice.description; description.maxLength = 150; descriptionLabel.append(description);
  const descriptionError = element('small', 'fee-field-error'); descriptionLabel.append(descriptionError);
  const dueLabel = element('label', '', 'Due date');
  const dueDate = element('input'); dueDate.type = 'date'; dueDate.value = invoice.dueDate; dueLabel.append(dueDate);
  const dueError = element('small', 'fee-field-error'); dueLabel.append(dueError);
  const amountLabel = element('label', '', 'Amount (₦)');
  const amount = element('input'); amount.inputMode = 'numeric'; amount.value = invoice.amount; amount.disabled = !canEditAmount(invoice); amountLabel.append(amount);
  const amountError = element('small', 'fee-field-error'); amountLabel.append(amountError);
  if (!canEditAmount(invoice)) amountLabel.append(element('span', 'fee-field-error', 'Amount is locked after a payment.'));
  const submit = element('button', 'button button-gold', 'Save changes'); submit.type = 'submit';
  form.append(descriptionLabel, dueLabel, amountLabel, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    descriptionError.textContent = ''; dueError.textContent = ''; amountError.textContent = '';
    const changes = { description: description.value.trim(), dueDate: dueDate.value, amount: amount.disabled ? invoice.amount : amount.value };
    const check = validateEdit(invoice, changes);
    if (!check.valid) { descriptionError.textContent = check.errors.description || check.errors.invoice || ''; dueError.textContent = check.errors.dueDate || ''; amountError.textContent = check.errors.amount || ''; return; }
    submit.disabled = true;
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), { description: changes.description, dueDate: changes.dueDate, amount: Number(changes.amount), updatedAt: serverTimestamp() });
      createMessage.textContent = 'Invoice updated.';
      await loadInvoices();
    } catch (error) { await showWriteFailure('The invoice could not be updated. The invoice list was reloaded.', error); }
    finally { submit.disabled = false; }
  });
  return form;
};

function openInvoice(id) {
  const invoice = invoices.find(item => item.id === id);
  if (!invoice) return;
  selectedId = id;
  panel.hidden = false;
  panel.replaceChildren(element('h2', '', 'Invoice'), detailList(invoice));
  if (canRecordPayment(invoice)) panel.append(paymentForm(invoice));
  if (canEdit(invoice)) panel.append(editForm(invoice));
  const actions = element('div', 'button-row');
  if (canCancel(invoice)) {
    const cancel = element('button', 'button button-outline', 'Cancel invoice'); cancel.type = 'button';
    cancel.addEventListener('click', async () => {
      if (!confirm('Cancel this invoice?')) return;
      try { await updateDoc(doc(db, 'invoices', invoice.id), { amountPaid: 0, status: 'cancelled', updatedAt: serverTimestamp() }); createMessage.textContent = 'Invoice cancelled.'; await loadInvoices(); }
      catch (error) { await showWriteFailure('The invoice could not be cancelled. The invoice list was reloaded.', error); }
    });
    actions.append(cancel);
  }
  if (invoice.status === 'cancelled') {
    const remove = element('button', 'button button-outline', 'Delete invoice'); remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm('Delete this cancelled invoice?')) return;
      try { await deleteDoc(doc(db, 'invoices', invoice.id)); selectedId = ''; panel.hidden = true; createMessage.textContent = 'Cancelled invoice deleted.'; await loadInvoices(); }
      catch (error) { await showWriteFailure('The invoice could not be deleted. The invoice list was reloaded.', error); }
    });
    actions.append(remove);
  }
  if (actions.childNodes.length) panel.append(actions);
}

scopeInputs.forEach(input => input.addEventListener('change', updateScope));
['#fee-search', '#fee-filter-session', '#fee-filter-semester', '#fee-filter-status'].forEach(selector => document.querySelector(selector).addEventListener('input', drawList));
document.querySelector('#fee-filter-session').addEventListener('change', drawList);
document.querySelector('#fee-filter-semester').addEventListener('change', drawList);
document.querySelector('#fee-filter-status').addEventListener('change', drawList);

createForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearCreateErrors();
  createMessage.textContent = '';
  const input = { feeType: inputValue(createForm, 'feeType'), session: inputValue(createForm, 'session'), semester: inputValue(createForm, 'semester'), amount: inputValue(createForm, 'amount'), dueDate: inputValue(createForm, 'dueDate'), description: inputValue(createForm, 'description') };
  const check = validateInvoiceInput(input, today());
  setError('type', check.errors.feeType); setError('session', check.errors.session); setError('semester', check.errors.semester); setError('amount', check.errors.amount); setError('due-date', check.errors.dueDate); setError('description', check.errors.description);
  const scope = inputValue(createForm, 'scope');
  const queryText = inputValue(createForm, 'student').toLowerCase();
  const level = Number(inputValue(createForm, 'level'));
  if (scope === 'one' && !queryText) setError('student', 'Enter a matric number or full name.');
  if (scope === 'level' && ![100, 200, 300, 400, 500].includes(level)) setError('level', 'Choose a level.');
  if (!check.valid || (scope === 'one' && !queryText) || (scope === 'level' && ![100, 200, 300, 400, 500].includes(level))) return;
  const targets = scope === 'level' ? students.filter(student => Number(student.level) === level) : students.filter(student => String(student.matricNumber || '').toLowerCase() === queryText || String(student.fullName || '').toLowerCase() === queryText);
  if (!targets.length) { setError('student', scope === 'one' ? 'No exact student match was found.' : 'No students are at that level.'); return; }
  const existing = new Set(invoices.map(invoice => invoice.id));
  let incomplete = 0; let duplicates = 0;
  const ready = targets.filter(student => {
    if (!validateStudentForInvoice(student).valid) { incomplete += 1; return false; }
    if (existing.has(invoiceId(student.uid, input.session, input.semester, input.feeType))) { duplicates += 1; return false; }
    return true;
  });
  if (!ready.length) { createMessage.textContent = `No invoices to create. ${duplicates} already exist and ${incomplete} student record${incomplete === 1 ? ' is' : 's are'} incomplete.`; return; }
  if (!confirm(`Create ${ready.length} invoice${ready.length === 1 ? '' : 's'}? ${duplicates} existing and ${incomplete} incomplete record${incomplete === 1 ? '' : 's'} will be skipped.`)) return;
  const submit = createForm.querySelector('button[type="submit"]'); submit.disabled = true;
  try {
    for (let start = 0; start < ready.length; start += 400) {
      const batch = writeBatch(db);
      ready.slice(start, start + 400).forEach(student => {
        const id = invoiceId(student.uid, input.session, input.semester, input.feeType);
        batch.set(doc(db, 'invoices', id), { ...buildInvoice(student, input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
    createMessage.textContent = `Created ${ready.length} invoice${ready.length === 1 ? '' : 's'}. Skipped ${duplicates} existing and ${incomplete} incomplete student record${incomplete === 1 ? '' : 's'}.`;
    createForm.reset(); updateScope(); await loadInvoices();
  } catch (error) { await showWriteFailure('Invoices could not be created. The invoice list was reloaded.', error); }
  finally { submit.disabled = false; }
});

onAuthStateChanged(auth, user => {
  if (!user || user.email !== 'victoribitoye70@gmail.com') return;
  loadStudents();
  loadInvoices();
});
