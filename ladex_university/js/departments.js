const departments = {
  'Computer Science': { department: 'Computer Science', faculty: 'Faculty of Science', code: 'CSC' },
  Accounting: { department: 'Accounting', faculty: 'Faculty of Management Sciences', code: 'ACC' },
  Microbiology: { department: 'Microbiology', faculty: 'Faculty of Science', code: 'MCB' },
  'English & Literary Studies': { department: 'English & Literary Studies', faculty: 'Faculty of Arts', code: 'ELS' },
  'International Relations': { department: 'International Relations', faculty: 'Faculty of Social Sciences', code: 'IRS' }
};

export const courseDepartments = Object.values(departments).map(item => item.department);
export const departmentFor = programme => departments[programme] || { department: 'General Studies', faculty: 'General', code: 'GEN' };
