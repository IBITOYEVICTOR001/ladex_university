// Shared, side-effect-free fee and invoice calculations.
export const FEE_TYPES = ['Tuition', 'Acceptance', 'Hostel', 'Medical', 'ICT', 'Examination'];
export const SEMESTERS = ['First', 'Second'];
export const LEVELS = [100, 200, 300, 400, 500];
export const STATUSES = ['unpaid', 'part-paid', 'paid', 'cancelled'];
export const MAX_AMOUNT = 10000000;

const dateText = value => String(value ?? '');
const numberValue = value => typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
const validDescription = value => typeof value === 'string' && value.trim().length >= 3 && value.trim().length <= 150;
const sameDay = value => dateText(value) === new Date().toISOString().slice(0, 10);

export const formatNaira = value => `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;

export const isValidSession = value => {
  const match = dateText(value).match(/^(\d{4})\/(\d{4})$/);
  return !!match && Number(match[2]) === Number(match[1]) + 1;
};

export const isValidDate = value => {
  const text = dateText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isMoney = value => {
  const amount = numberValue(value);
  return Number.isInteger(amount) && amount >= 1 && amount <= MAX_AMOUNT;
};

export const invoiceId = (uid, session, semester, feeType) => `${uid}_${String(session).split('/')[0]}_${semester}_${String(feeType).toLowerCase()}`;
export const balanceOf = invoice => Math.max(0, Number(invoice?.amount || 0) - Number(invoice?.amountPaid || 0));
export const statusFor = (amount, amountPaid, cancelled = false) => {
  if (cancelled) return 'cancelled';
  const paid = Number(amountPaid || 0);
  const total = Number(amount || 0);
  if (paid <= 0) return 'unpaid';
  return paid >= total ? 'paid' : 'part-paid';
};
export const isOverdue = (invoice, today = new Date().toISOString().slice(0, 10)) =>
  !!invoice && ['unpaid', 'part-paid'].includes(invoice.status) && isValidDate(invoice.dueDate) && invoice.dueDate < today;
export const canEdit = invoice => !!invoice && ['unpaid', 'part-paid'].includes(invoice.status);
export const canEditAmount = invoice => canEdit(invoice) && Number(invoice.amountPaid) === 0;
export const canCancel = invoice => !!invoice && invoice.status === 'unpaid' && Number(invoice.amountPaid) === 0;
export const canRecordPayment = invoice => canEdit(invoice) && balanceOf(invoice) > 0;

export const validateInvoiceInput = (input, today = new Date().toISOString().slice(0, 10)) => {
  const errors = {};
  if (!FEE_TYPES.includes(input?.feeType)) errors.feeType = 'Choose a fee type.';
  if (!isValidSession(input?.session)) errors.session = 'Enter a session such as 2026/2027.';
  if (!SEMESTERS.includes(input?.semester)) errors.semester = 'Choose a semester.';
  if (!isMoney(input?.amount)) errors.amount = `Enter a whole amount from ₦1 to ${formatNaira(MAX_AMOUNT)}.`;
  if (!isValidDate(input?.dueDate)) errors.dueDate = 'Enter a real due date.';
  else if (input.dueDate < today && !sameDay(input.dueDate)) errors.dueDate = 'The due date cannot be in the past.';
  if (!validDescription(input?.description)) errors.description = 'Enter a description between 3 and 150 characters.';
  return { valid: Object.keys(errors).length === 0, errors };
};

export const validateStudentForInvoice = student => {
  const errors = {};
  if (!student || typeof student.uid !== 'string' || !student.uid) errors.uid = 'Student account is missing.';
  if (!student || typeof student.matricNumber !== 'string' || !student.matricNumber.trim()) errors.matricNumber = 'Matric number is missing.';
  if (!student || typeof student.fullName !== 'string' || !student.fullName.trim()) errors.fullName = 'Full name is missing.';
  if (!student || typeof student.department !== 'string' || !student.department.trim()) errors.department = 'Department is missing.';
  if (!student || !LEVELS.includes(Number(student.level))) errors.level = 'Level is invalid.';
  return { valid: Object.keys(errors).length === 0, errors };
};

export const buildInvoice = (student, input) => ({
  uid: student.uid,
  matricNumber: student.matricNumber.trim(),
  fullName: student.fullName.trim(),
  department: student.department.trim(),
  level: Number(student.level),
  session: input.session,
  semester: input.semester,
  feeType: input.feeType,
  description: input.description.trim(),
  amount: Number(input.amount),
  amountPaid: 0,
  dueDate: input.dueDate,
  status: 'unpaid'
});

export const validatePayment = (invoice, input) => {
  const errors = {};
  if (!canRecordPayment(invoice)) errors.invoice = 'Payments cannot be recorded for this invoice.';
  if (!isMoney(input?.amount)) errors.amount = 'Enter a whole payment amount.';
  else if (Number(input.amount) > balanceOf(invoice)) errors.amount = 'Payment cannot exceed the outstanding balance.';
  if (input?.reference !== undefined && String(input.reference).trim().length > 40) errors.reference = 'Reference must be 40 characters or fewer.';
  return { valid: Object.keys(errors).length === 0, errors };
};

export const validateEdit = (invoice, changes, today = new Date().toISOString().slice(0, 10)) => {
  const errors = {};
  if (!canEdit(invoice)) errors.invoice = 'This invoice is locked.';
  if (!validDescription(changes?.description)) errors.description = 'Enter a description between 3 and 150 characters.';
  if (!isValidDate(changes?.dueDate)) errors.dueDate = 'Enter a real due date.';
  else if (changes.dueDate !== invoice?.dueDate && changes.dueDate < today && !sameDay(changes.dueDate)) errors.dueDate = 'A changed due date cannot be in the past.';
  if (!isMoney(changes?.amount)) errors.amount = 'Enter a whole invoice amount.';
  else if (!canEditAmount(invoice) && Number(changes.amount) !== Number(invoice?.amount)) errors.amount = 'The amount is locked after a payment.';
  return { valid: Object.keys(errors).length === 0, errors };
};

export const summarise = (invoices, today = new Date().toISOString().slice(0, 10)) => {
  const rows = Array.isArray(invoices) ? invoices : [];
  const active = rows.filter(invoice => invoice?.status !== 'cancelled');
  return {
    billed: active.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    paid: active.reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0),
    outstanding: active.reduce((sum, invoice) => sum + balanceOf(invoice), 0),
    overdue: active.filter(invoice => isOverdue(invoice, today)).length,
    count: active.length
  };
};

const semesterOrder = value => SEMESTERS.indexOf(value) + 1 || 9;
export const sortInvoices = invoices => (Array.isArray(invoices) ? invoices : []).slice().sort((a, b) =>
  String(a.session || '').localeCompare(String(b.session || '')) || semesterOrder(a.semester) - semesterOrder(b.semester) || String(a.feeType || '').localeCompare(String(b.feeType || ''))
);
export const groupInvoices = invoices => {
  const groups = new Map();
  sortInvoices(invoices).forEach(invoice => {
    const key = `${invoice.session}|${invoice.semester}`;
    if (!groups.has(key)) groups.set(key, { session: invoice.session, semester: invoice.semester, invoices: [] });
    groups.get(key).invoices.push(invoice);
  });
  return Array.from(groups.values());
};
