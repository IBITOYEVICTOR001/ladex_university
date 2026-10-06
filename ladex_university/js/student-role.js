import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getStudentRecord(db, uid) {
  try {
    const snapshot = await getDoc(doc(db, 'students', uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error('Role check failed:', error.code, error.message);
    return null;
  }
}
