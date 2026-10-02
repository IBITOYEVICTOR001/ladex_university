import { db } from './firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
export const text = (value = '') => String(value ?? '');
export const el = (tag, className = '', value = '') => { const node = document.createElement(tag); node.className = className; if (value) node.textContent = value; return node; };
export const showState = (target, message, kind = 'loading') => { target.replaceChildren(el('p', `data-state ${kind}`, message)); };
export const formatDate = value => { const date = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(date) ? 'Date to be confirmed' : new Intl.DateTimeFormat('en-NG', { day:'numeric', month:'short', year:'numeric' }).format(date); };
export async function submitMessage(form, staffId = '') { const data = new FormData(form); if (data.get('website')) return; const name=text(data.get('name')).trim(), email=text(data.get('email')).trim(), subject=text(data.get('subject')).trim(), message=text(data.get('message')).trim(); if (!name || !email || !subject || !message || message.length > 1500) throw new Error('Please complete every field. Messages must be 1,500 characters or fewer.'); await addDoc(collection(db, 'messages'), { name, email, subject, message, ...(staffId ? { staffId } : {}), createdAt: serverTimestamp() }); }
