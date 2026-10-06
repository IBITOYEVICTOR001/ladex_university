const navy = [11, 42, 91], gold = [201, 162, 39], grey = [110, 110, 110], lightGrey = [225, 225, 225];
let logoPromise;

const value = item => item === undefined || item === null || item === '' ? '—' : String(item);
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
const drawHeader = (state, application, logo) => {
  const { doc } = state;
  if (logo) doc.addImage(logo, 'PNG', 15, 15, 20, 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...navy); doc.text('Ladex International University', logo ? 40 : 15, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...grey); doc.text('Lekki, Lagos, Nigeria', logo ? 40 : 15, 29);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...gold); doc.text('DEMO ONLY', logo ? 40 : 15, 35);
  if (application.photo) {
    try { doc.addImage(application.photo, 'JPEG', 165, 15, 30, 40); doc.setDrawColor(...grey); doc.setLineWidth(.2); doc.rect(165, 15, 30, 40); } catch { doc.setDrawColor(...grey); doc.rect(165, 15, 30, 40); }
  } else { doc.setDrawColor(...grey); doc.rect(165, 15, 30, 40); doc.setFontSize(7); doc.text('Passport photo', 180, 36, { align: 'center' }); }
  doc.setDrawColor(...gold); doc.setLineWidth(.5); doc.line(15, 60, 195, 60); state.y = 69;
};
const newPage = state => { state.doc.addPage(); drawHeader(state, state.application, state.logo); };
const roomFor = (state, height) => { if (state.y + height > 274) newPage(state); };
const title = (state, text) => { roomFor(state, 12); const { doc } = state; doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...navy); doc.text(text, 15, state.y); state.y += 8; };
const sectionHeading = (state, text, firstRowHeight = 8) => {
  roomFor(state, 8 + firstRowHeight); const { doc } = state; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy); doc.text(text, 15, state.y); doc.setDrawColor(...lightGrey); doc.line(15, state.y + 2, 195, state.y + 2); state.y += 8;
};
const pairHeight = (doc, pair) => Math.max(...pair.filter(Boolean).map(([, item]) => doc.splitTextToSize(value(item), 82).length * 4.2 + 7));
const drawPairRow = (state, pair) => {
  const { doc } = state, height = pairHeight(doc, pair); roomFor(state, height);
  pair.forEach((entry, index) => { if (!entry) return; const [label, item] = entry, x = index ? 108 : 15, lines = doc.splitTextToSize(value(item), 82); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey); doc.text(label, x, state.y); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0); doc.text(lines, x, state.y + 4.2); });
  state.y += height;
};
const drawPairs = (state, rows) => {
  rows.forEach((row, index) => { const pair = [row, rows[index + 1]]; if (index % 2 === 0) drawPairRow(state, pair); });
};
const drawOlevel = (state, olevel) => {
  const rows = value(olevel) === '—' ? [['—', '—']] : String(olevel).split(';').map(item => { const [subject, ...grade] = item.trim().split(':'); return [subject?.trim() || '—', grade.join(':').trim() || '—']; });
  const { doc } = state, firstRowHeight = Math.max(doc.splitTextToSize(rows[0][0], 116).length, doc.splitTextToSize(rows[0][1], 50).length) * 4.5 + 4;
  sectionHeading(state, "O'level results", 7 + firstRowHeight);
  roomFor(state, 7); doc.setFillColor(...lightGrey); doc.rect(15, state.y, 180, 7, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...navy); doc.text('Subject', 17, state.y + 4.7); doc.text('Grade', 140, state.y + 4.7); state.y += 7;
  rows.forEach(([subject, grade]) => { const subjectLines = doc.splitTextToSize(subject, 116), gradeLines = doc.splitTextToSize(grade, 50), height = Math.max(subjectLines.length, gradeLines.length) * 4.5 + 4; roomFor(state, height); doc.setDrawColor(...lightGrey); doc.rect(15, state.y, 180, height); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.text(subjectLines, 17, state.y + 4.5); doc.text(gradeLines, 140, state.y + 4.5); state.y += height; });
};
const drawStatement = (state, statement) => {
  const { doc } = state, lines = doc.splitTextToSize(value(statement), 180); sectionHeading(state, 'Personal statement', 8);
  lines.forEach(line => { roomFor(state, 5); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0); doc.text(line, 15, state.y); state.y += 4.8; });
};
const drawDeclaration = state => {
  roomFor(state, 34); sectionHeading(state, 'Declaration', 25); const { doc } = state;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0); doc.text('I declare that the information given above is true and complete to the best of my knowledge.', 15, state.y); state.y += 13;
  doc.setDrawColor(...grey); doc.line(15, state.y, 90, state.y); doc.line(115, state.y, 195, state.y); doc.setFontSize(8); doc.setTextColor(...grey); doc.text("Applicant's signature", 15, state.y + 4); doc.text('Date', 115, state.y + 4); state.y += 8;
};
const createDocument = async (application, options = {}) => {
  const { jsPDF } = window.jspdf || {}; if (!jsPDF) throw new Error('jsPDF is unavailable.');
  const state = { doc: new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }), application, logo: await getLogo(options.logoPath || '../images/logo1.png'), y: 69 };
  drawHeader(state, application, state.logo); return state;
};
const fileReference = application => String(application.reference || 'Application').replace(/[^A-Za-z0-9-]/g, '');

export const makeAcknowledgmentPdf = async (application, options = {}) => {
  const state = await createDocument(application, options), { doc } = state;
  title(state, 'Application Acknowledgment Slip');
  doc.setFillColor(...lightGrey); doc.roundedRect(15, state.y, 180, 20, 2, 2, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...grey); doc.text('Reference number', 20, state.y + 7); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...navy); doc.text(value(application.reference), 20, state.y + 15); state.y += 29;
  drawPairs(state, [['Full name', application.fullName], ['Programme applied for', application.programme], ['Entry mode', application.entryMode], ['Submission date', dateText(application.createdAt)], ['Email', application.email], ['Current status', application.status]]);
  state.y += 4; roomFor(state, 18); doc.setFillColor(249, 249, 249); doc.roundedRect(15, state.y, 180, 16, 2, 2, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0); doc.text(doc.splitTextToSize('Keep this slip. Quote your reference number in all correspondence with the admissions office.', 168), 21, state.y + 7);
  addFooter(doc); doc.save(`Ladex-Acknowledgment-${fileReference(application)}.pdf`);
};

export const makeApplicationPdf = async (application, options = {}) => {
  const state = await createDocument(application, options), { doc } = state;
  title(state, 'Application Form'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...grey); doc.text(`Reference: ${value(application.reference)}   |   Submission date: ${dateText(application.createdAt)}`, 15, state.y); state.y += 10;
  const personal = [['Full name', application.fullName], ['Gender', application.gender], ['Date of birth', dateText(application.dateOfBirth)], ['State of origin', application.stateOfOrigin], ['Local government area', application.lga], ['Home address', application.address], ['Email', application.email], ['Phone', application.phone]];
  sectionHeading(state, 'Personal details', pairHeight(doc, personal.slice(0, 2))); drawPairs(state, personal);
  const admission = [['Programme', application.programme], ['Second choice', application.secondChoice], ['Entry mode', application.entryMode], ['JAMB or DE registration number', application.jambRegNo], ['JAMB score', application.jambScore], ['Last school attended', application.lastSchool]];
  sectionHeading(state, 'Admission details', pairHeight(doc, admission.slice(0, 2))); drawPairs(state, admission);
  drawOlevel(state, application.olevel);
  const nextOfKin = [['Name', application.nextOfKinName], ['Relationship', application.nextOfKinRelationship], ['Phone', application.nextOfKinPhone]];
  sectionHeading(state, 'Next of kin', pairHeight(doc, nextOfKin.slice(0, 2))); drawPairs(state, nextOfKin);
  drawStatement(state, application.statement); drawDeclaration(state);
  addFooter(doc); doc.save(`Ladex-Application-${fileReference(application)}.pdf`);
};
