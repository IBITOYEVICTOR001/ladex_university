import { balanceOf, formatNaira, groupInvoices, isOverdue, summarise } from './fees-calc.js';

const navy = [11, 42, 91], gold = [201, 162, 39], grey = [110, 110, 110], lightGrey = [225, 225, 225];
let logoPromise;

const value = item => item === undefined || item === null || item === '' ? '—' : String(item);
const money = item => formatNaira(item).replace('₦', 'NGN ');
const dateText = item => {
  if (item === undefined || item === null || item === '') return '—';
  const date = item?.toDate ? item.toDate() : typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item) ? new Date(`${item}T00:00:00`) : new Date(item);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};
const today = () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
const getLogo = path => {
  if (!logoPromise) logoPromise = fetch(path).then(response => response.ok ? response.blob() : Promise.reject()).then(blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); })).catch(() => null);
  return logoPromise;
};

const addFooter = doc => {
  const pages = doc.getNumberOfPages(), footer = `Generated on ${today()}. System-generated document.`;
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey);
    doc.text(footer, 15, 282); const pageText = `Page ${page} of ${pages}`; doc.text(pageText, 195 - doc.getTextWidth(pageText), 282);
  }
};
const drawHeader = (state, logo) => {
  const { doc } = state;
  if (logo) doc.addImage(logo, 'PNG', 15, 15, 20, 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...navy); doc.text('Ladex International University', logo ? 40 : 15, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...grey); doc.text('Lekki, Lagos, Nigeria', logo ? 40 : 15, 29);
  
  doc.setDrawColor(...gold); doc.setLineWidth(.5); doc.line(15, 45, 195, 45); state.y = 54;
};
const newPage = state => { state.doc.addPage(); drawHeader(state, state.logo); };
const roomFor = (state, height) => { if (state.y + height > 274) newPage(state); };
const title = (state, text) => { roomFor(state, 12); const { doc } = state; doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...navy); doc.text(text, 15, state.y); state.y += 9; };
const sectionHeading = (state, text, firstRowHeight = 8) => {
  roomFor(state, 8 + firstRowHeight); const { doc } = state; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy); doc.text(text, 15, state.y); doc.setDrawColor(...lightGrey); doc.line(15, state.y + 2, 195, state.y + 2); state.y += 8;
};
const pairHeight = (doc, pair) => Math.max(...pair.filter(Boolean).map(([, item]) => doc.splitTextToSize(value(item), 82).length * 4.2 + 7));
const drawPairRow = (state, pair) => {
  const { doc } = state, height = pairHeight(doc, pair); roomFor(state, height);
  pair.forEach((entry, index) => { if (!entry) return; const [label, item] = entry, x = index ? 108 : 15, lines = doc.splitTextToSize(value(item), 82); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey); doc.text(label, x, state.y); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0); doc.text(lines, x, state.y + 4.2); });
  state.y += height;
};
const drawPairs = (state, rows) => rows.forEach((row, index) => { if (index % 2 === 0) drawPairRow(state, [row, rows[index + 1]]); });
const createDocument = async () => {
  const { jsPDF } = window.jspdf || {}; if (!jsPDF) throw new Error('jsPDF is unavailable.');
  const state = { doc: new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }), logo: await getLogo('../images/logo1.png'), y: 54 };
  drawHeader(state, state.logo); return state;
};
const filePart = item => value(item).replace(/\//g, '-').replace(/[^A-Za-z0-9-]/g, '') || 'Student';

const drawSummary = (state, invoices) => {
  const { doc } = state, totals = summarise(invoices), height = 25;
  roomFor(state, height + 8); sectionHeading(state, 'Account summary', height);
  doc.setFillColor(249, 249, 249); doc.roundedRect(15, state.y, 180, height, 2, 2, 'F');
  const items = [['Outstanding', money(totals.outstanding)], ['Billed', money(totals.billed)], ['Paid', money(totals.paid)], ['Overdue invoices', String(totals.overdue)]];
  items.forEach(([label, amount], index) => { const x = 20 + (index % 2) * 88, y = state.y + 7 + Math.floor(index / 2) * 11; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey); doc.text(label, x, y); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy); doc.text(amount, x, y + 4.5); });
  state.y += height + 8;
};

const columns = [
  ['Fee', 15, 20, 'left'], ['Description', 35, 56, 'left'], ['Due date', 91, 22, 'left'], ['Amount', 113, 22, 'right'], ['Paid', 135, 20, 'right'], ['Balance', 155, 20, 'right'], ['Status', 175, 20, 'left']
];
const drawTableHead = state => {
  const { doc } = state; doc.setFillColor(...lightGrey); doc.rect(15, state.y, 180, 7, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...navy);
  columns.forEach(([label, x, width, align]) => doc.text(label, align === 'right' ? x + width - 2 : x + 2, state.y + 4.7, { align: align === 'right' ? 'right' : 'left' }));
  state.y += 7;
};
const invoiceCells = invoice => [value(invoice.feeType), value(invoice.description), value(invoice.dueDate), money(invoice.amount), money(invoice.amountPaid), money(balanceOf(invoice)), isOverdue(invoice) ? 'Overdue' : value(invoice.status).replace(/(^|-)\w/g, item => item.toUpperCase())];
const rowHeight = (doc, cells) => Math.max(...cells.map((cell, index) => doc.splitTextToSize(cell, columns[index][2] - 4).length)) * 4.2 + 4;
const drawInvoiceRow = (state, invoice) => {
  const { doc } = state, cells = invoiceCells(invoice), height = rowHeight(doc, cells);
  if (state.y + height > 274) { newPage(state); sectionHeading(state, `${value(state.group.session)} session, ${value(state.group.semester)} semester`, 7 + height); drawTableHead(state); }
  doc.setDrawColor(...lightGrey); doc.rect(15, state.y, 180, height); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
  cells.forEach((cell, index) => { const [, x, width, align] = columns[index], lines = doc.splitTextToSize(cell, width - 4); doc.text(lines, align === 'right' ? x + width - 2 : x + 2, state.y + 4.2, { align: align === 'right' ? 'right' : 'left' }); });
  state.y += height;
};
const drawGroups = (state, invoices) => {
  groupInvoices(invoices).forEach(group => {
    state.group = group; sectionHeading(state, `${value(group.session)} session, ${value(group.semester)} semester`, 14); drawTableHead(state);
    group.invoices.forEach(invoice => drawInvoiceRow(state, invoice));
    const totals = summarise(group.invoices); roomFor(state, 8); state.doc.setFont('helvetica', 'bold'); state.doc.setFontSize(8); state.doc.setTextColor(...navy); const text = `Group total: Billed ${money(totals.billed)}   Paid ${money(totals.paid)}   Outstanding ${money(totals.outstanding)}`; state.doc.text(text, 195, state.y + 4.5, { align: 'right' }); state.y += 9;
  });
};

export const makeStatementPdf = async (student, invoices) => {
  const state = await createDocument(), { doc } = state, rows = Array.isArray(invoices) ? invoices : [];
  title(state, 'Statement of Account');
  const details = [['Full name', student?.fullName], ['Matric number', student?.matricNumber], ['Programme', student?.programme], ['Department', student?.department], ['Level', student?.level ? `${student.level} Level` : '—'], ['Session', student?.session]];
  sectionHeading(state, 'Student details', pairHeight(doc, details.slice(0, 2))); drawPairs(state, details); drawSummary(state, rows); drawGroups(state, rows);
  addFooter(doc); doc.save(`Ladex-Fees-Statement-${filePart(student?.matricNumber)}.pdf`);
};

export const makeReceiptPdf = async (student, invoice) => {
  const state = await createDocument(), { doc } = state;
  title(state, 'Payment Receipt');
  const details = [
    ['Full name', student?.fullName], ['Matric number', student?.matricNumber], ['Programme', student?.programme], ['Department', student?.department], ['Invoice reference', invoice?.id], ['Fee type', invoice?.feeType], ['Description', invoice?.description], ['Session', invoice?.session], ['Semester', invoice?.semester], ['Due date', invoice?.dueDate], ['Amount', money(invoice?.amount)], ['Total paid so far', money(invoice?.amountPaid)], ['Balance', money(balanceOf(invoice))], ['Status', isOverdue(invoice) ? 'Overdue' : value(invoice?.status).replace(/(^|-)\w/g, item => item.toUpperCase())], ['Last payment date', dateText(invoice?.lastPaymentAt)], ['Last payment reference', invoice?.lastPaymentRef]
  ];
  sectionHeading(state, 'Student and invoice details', pairHeight(doc, details.slice(0, 2))); drawPairs(state, details);
  roomFor(state, 18); doc.setFillColor(249, 249, 249); doc.roundedRect(15, state.y, 180, 16, 2, 2, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0); doc.text('This is a practice document and not an official receipt.', 21, state.y + 8);
  addFooter(doc); doc.save(`Ladex-Receipt-${filePart(student?.matricNumber)}-${filePart(invoice?.feeType)}.pdf`);
};
