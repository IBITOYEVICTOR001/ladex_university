import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStudentRecord } from './student-role.js';
import { balanceOf, formatNaira, groupInvoices, isOverdue, summarise } from './fees-calc.js';

const studentBox = document.querySelector('#fees-student');
const summaryBox = document.querySelector('#fees-summary');
const groupsBox = document.querySelector('#fees-groups');
const printButton = document.querySelector('#print-fees');
const statementButton = document.querySelector('#download-fees-pdf');
const pdfMessage = document.querySelector('#fees-pdf-message');
const printedOn = document.querySelector('#fees-printed');
let studentRecord = null;
let invoiceRows = [];
let jsPdfPromise;

const loadJsPdf = () => {
  if (window.jspdf?.jsPDF) return Promise.resolve();
  if (!jsPdfPromise) jsPdfPromise = new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '../js/vendor/jspdf.umd.min.js'; script.onload = () => window.jspdf?.jsPDF ? resolve() : reject(new Error('jsPDF did not load.')); script.onerror = () => reject(new Error('jsPDF could not load.')); document.head.append(script); }).catch(error => { jsPdfPromise = null; throw error; });
  return jsPdfPromise;
};

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const value = item => item === undefined || item === null || item === '' ? '—' : String(item);
const statusCell = invoice => {
  const cell = element('td');
  const overdue = isOverdue(invoice);
  cell.append(element('span', `status-pill status-${overdue ? 'overdue' : invoice.status}`, overdue ? 'Overdue' : invoice.status));
  return cell;
};

const showStudent = student => {
  const heading = element('h2', '', value(student.fullName));
  const list = element('dl', 'results-student-grid');
  [['Matric number', student.matricNumber], ['Department', student.department], ['Current level', student.level ? `${student.level} Level` : '—'], ['Session', student.session]].forEach(([label, item]) => {
    const pair = element('div');
    pair.append(element('dt', '', label), element('dd', '', value(item)));
    list.append(pair);
  });
  studentBox.replaceChildren(heading, list);
};

const makeReceipt = async (button, invoice) => {
  button.disabled = true;
  pdfMessage.textContent = 'Preparing your PDF...';
  try {
    await loadJsPdf();
    const { makeReceiptPdf } = await import('./fees-pdf.js');
    await makeReceiptPdf(studentRecord, invoice);
    pdfMessage.textContent = '';
  } catch (error) {
    console.error('Receipt PDF failed:', error);
    pdfMessage.textContent = 'The PDF could not be created. Please try again.';
  } finally { button.disabled = false; }
};

const showSummary = invoices => {
  const totals = summarise(invoices);
  const cards = [
    ['Outstanding', formatNaira(totals.outstanding)],
    ['Billed', formatNaira(totals.billed)],
    ['Paid', formatNaira(totals.paid)],
    ['Overdue invoices', String(totals.overdue)]
  ].map(([label, number]) => {
    const card = element('div', 'fees-stat');
    card.append(element('span', '', label), element('strong', '', number));
    return card;
  });
  summaryBox.replaceChildren(...cards);
};

const drawGroup = group => {
  const section = element('section', 'fee-group');
  section.append(element('h3', '', `${value(group.session)} session, ${value(group.semester)} semester`));
  const wrap = element('div', 'table-wrap');
  const table = element('table', 'results-table fees-table');
  const head = element('thead');
  const headerRow = element('tr');
  ['Fee', 'Description', 'Due date', 'Amount', 'Paid', 'Balance', 'Status'].forEach(label => headerRow.append(element('th', '', label)));
  headerRow.append(element('th', 'fees-receipt-cell', 'Receipt'));
  head.append(headerRow);
  const body = element('tbody');
  group.invoices.forEach(invoice => {
    const row = element('tr');
    [invoice.feeType, invoice.description, invoice.dueDate, formatNaira(invoice.amount), formatNaira(invoice.amountPaid), formatNaira(balanceOf(invoice))].forEach(item => row.append(element('td', '', value(item))));
    row.append(statusCell(invoice));
    const receipt = element('td', 'fees-receipt-cell');
    if (Number(invoice.amountPaid) > 0 && invoice.status !== 'cancelled') {
      const button = element('button', 'button button-outline fees-receipt-button', 'Receipt (PDF)');
      button.type = 'button';
      button.addEventListener('click', () => makeReceipt(button, invoice));
      receipt.append(button);
    }
    row.append(receipt);
    body.append(row);
  });
  table.append(head, body);
  wrap.append(table);
  section.append(wrap);
  return section;
};

const render = invoices => {
  if (!invoices.length) {
    summaryBox.replaceChildren();
    groupsBox.replaceChildren(element('p', 'fees-empty', 'There are no fee invoices on your account yet.'));
    return;
  }
  showSummary(invoices);
  groupsBox.replaceChildren(...groupInvoices(invoices).map(drawGroup));
  printButton.hidden = false;
  statementButton.hidden = false;
};

onAuthStateChanged(auth, async user => {
  if (!user) { location.href = 'login.html'; return; }
  const student = await getStudentRecord(db, user.uid);
  if (!student) { location.href = 'dashboard.html'; return; }
  studentRecord = student;
  showStudent(student);
  try {
    const snapshot = await getDocs(query(collection(db, 'invoices'), where('uid', '==', user.uid)));
    invoiceRows = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    render(invoiceRows);
  } catch (error) {
    console.error('Fees load failed:', error.code, error.message);
    groupsBox.replaceChildren(element('p', 'fees-empty', 'Your fee statement could not be loaded. Please refresh the page and try again.'));
  }
});

printButton?.addEventListener('click', () => {
  printedOn.textContent = `Printed on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  window.print();
});

statementButton?.addEventListener('click', async () => {
  statementButton.disabled = true;
  pdfMessage.textContent = 'Preparing your PDF...';
  try {
    await loadJsPdf();
    const { makeStatementPdf } = await import('./fees-pdf.js');
    await makeStatementPdf(studentRecord, invoiceRows);
    pdfMessage.textContent = '';
  } catch (error) {
    console.error('Statement PDF failed:', error);
    pdfMessage.textContent = 'The PDF could not be created. Please try again.';
  } finally { statementButton.disabled = false; }
});
