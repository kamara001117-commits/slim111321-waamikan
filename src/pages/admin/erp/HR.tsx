import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { Employee, Payroll, ExpenseClaim } from '@/src/types/erp';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeFormatDate } from '@/src/lib/dateUtils';
import { format } from 'date-fns';
import {
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  Plus,
  CheckCircle2,
  XCircle,
  UserPlus,
  FileText,
  Printer,
  Download,
  CreditCard,
} from 'lucide-react';
import {
  approveExpenseClaim,
  rejectExpenseClaim,
  payExpenseClaim,
  createExpenseClaim,
} from '@/src/lib/expenseService';
import { generateMonthlyPayroll } from '@/src/lib/hrService';
import { printDocument, downloadDocument } from '@/src/lib/documentService';

const HR = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'claims'>('employees');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [newClaim, setNewClaim] = useState({
    employeeId: '',
    employeeName: '',
    total: 0,
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleCreateClaim = async () => {
    const amount = Number(newClaim.total) || 0;
    if (!newClaim.employeeId || amount <= 0) return;

    try {
      await createExpenseClaim({
        ...newClaim,
        amount,
        status: 'Pending',
      });
      setShowAddClaim(false);
      setNewClaim({
        employeeId: '',
        employeeName: '',
        total: 0,
        category: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error: any) {
      setStatusMessage(error?.message || 'Failed to submit expense claim.');
    }
  };

  const handleRunPayroll = async () => {
    setStatusMessage(null);
    try {
      const month = format(new Date(), 'yyyy-MM');
      await generateMonthlyPayroll(month);
      setStatusMessage(`Payroll for ${month} generated successfully.`);
    } catch (error: any) {
      setStatusMessage(error?.message || 'Unable to generate payroll.');
    }
  };

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubEmployees = onSnapshot(
      collection(db, 'employees'),
      (snap) => {
        setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'employees');
      }
    );

    const unsubPayroll = onSnapshot(
      query(collection(db, 'payroll'), orderBy('month', 'desc')),
      (snap) => {
        setPayroll(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payroll)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payroll')
    );

    const unsubClaims = onSnapshot(
      query(collection(db, 'expense_claims'), orderBy('date', 'desc')),
      (snap) => {
        setClaims(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseClaim)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'expense_claims')
    );

    return () => {
      unsubEmployees();
      unsubPayroll();
      unsubClaims();
    };
  }, [currentUserRole]);

  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    position: '',
    department: '',
    salary: 0,
    joiningDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleOnboard = async () => {
    if (!newEmployee.firstName.trim() || !newEmployee.lastName.trim()) return;
    try {
      const ref = doc(collection(db, 'employees'));
      const employeeId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();
      await setDoc(ref, {
        id: ref.id,
        employeeId,
        firstName: newEmployee.firstName.trim(),
        lastName: newEmployee.lastName.trim(),
        email: newEmployee.email.trim(),
        position: newEmployee.position.trim(),
        department: newEmployee.department.trim(),
        salary: Number(newEmployee.salary) || 0,
        joiningDate: newEmployee.joiningDate || format(new Date(), 'yyyy-MM-dd'),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      setShowAddEmployee(false);
      setNewEmployee({
        firstName: '',
        lastName: '',
        email: '',
        position: '',
        department: '',
        salary: 0,
        joiningDate: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'employees');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">
            HR &amp; Workforce
          </h2>
          <p className="text-sm font-medium text-gray-400 italic">
            Personnel management and organizational payroll
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'employees' && (
            <button
              type="button"
              onClick={() => setShowAddEmployee(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#EAB308] text-[#0B3C5D] rounded-2xl font-black shadow-lg shadow-yellow-200/50 hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
            >
              <UserPlus size={18} />
              ONBOARD EMPLOYEE
            </button>
          )}
          {activeTab === 'payroll' && (
            <button
              type="button"
              onClick={handleRunPayroll}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
            >
              <Plus size={18} />
              GENERATE BATCH PAYROLL
            </button>
          )}
          {activeTab === 'claims' && (
            <button
              type="button"
              onClick={() => setShowAddClaim(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
            >
              <Plus size={18} />
              NEW EXPENSE CLAIM
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-[#0B3C5D] rounded-2xl text-sm font-bold flex items-center justify-between">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {[
          { id: 'employees', name: 'Employees', icon: <Users size={18} /> },
          { id: 'payroll', name: 'Payroll', icon: <DollarSign size={18} /> },
          { id: 'claims', name: 'Expenses', icon: <FileText size={18} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#0B3C5D] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.name}
          </button>
        ))}
      </div>

      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 relative group overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl border-2 border-[#EAB308] flex items-center justify-center text-[#0B3C5D] font-black text-xl">
                    {(employee.firstName?.[0] || '').toUpperCase()}
                    {(employee.lastName?.[0] || '').toUpperCase()}
                  </div>
                  <span
                    className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      employee.status === 'active'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {employee.status || 'active'}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-[#0B3C5D] leading-tight uppercase tracking-tight">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-[10px] text-[#1F7A8C] font-black uppercase tracking-widest mt-1">
                      {employee.position || 'Staff'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <p className="flex items-center gap-2">
                      <Briefcase size={12} /> {employee.department || 'General'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar size={12} /> Joined:{' '}
                      {safeFormatDate(employee.joiningDate || (employee as any).hireDate, 'MMM yyyy')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
            </div>
          ))}
          {!loading && employees.length === 0 && (
            <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 font-medium text-center px-4">
              <Users size={48} className="mb-4 opacity-20" />
              <p>No employee records found. Start workforce onboarding.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 text-white rounded-xl">
                <DollarSign size={24} />
              </div>
              <div>
                <h4 className="font-black text-[#0B3C5D] uppercase tracking-tight">
                  Active Payroll Run
                </h4>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                  Monthly Salary Processing
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunPayroll}
              className="px-6 py-3 bg-[#0B3C5D] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-colors"
            >
              Finalize All for {format(new Date(), 'MMMM')}
            </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Period
                    </th>
                    <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Employee
                    </th>
                    <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Base
                    </th>
                    <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Net Pay
                    </th>
                    <th className="px-6 sm:px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payroll.map((pay) => (
                    <tr key={pay.id} className="hover:bg-gray-50/50 group transition-colors">
                      <td className="px-6 sm:px-8 py-5 font-mono text-xs font-black text-[#1F7A8C]">
                        {pay.month}
                      </td>
                      <td className="px-6 sm:px-8 py-5">
                        <p className="font-black text-gray-800 uppercase tracking-tight">
                          {pay.employeeName}
                        </p>
                        <div className="flex gap-4 text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                          <span>All.: GHC {pay.allowances || 0}</span>
                          <span>Ded.: GHC {pay.deductions || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right font-bold text-gray-400">
                        GHC {(Number(pay.baseSalary) || 0).toLocaleString()}
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right font-black text-[#0B3C5D]">
                        GHC {(Number(pay.netPay) || 0).toLocaleString()}
                      </td>
                      <td className="px-6 sm:px-8 py-5">
                        <div className="flex justify-center">
                          <span
                            className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                              pay.status === 'paid'
                                ? 'bg-green-50 text-green-600 border-green-100'
                                : 'bg-gray-50 text-gray-500 border-gray-100'
                            }`}
                          >
                            {pay.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => downloadDocument('Payslip', pay)}
                            className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => printDocument('Payslip', pay)}
                            className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-[#0B3C5D] hover:text-white transition-all"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {payroll.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-gray-400 italic">
                        No payroll runs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Date
                  </th>
                  <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Employee
                  </th>
                  <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Category / Reason
                  </th>
                  <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Amount
                  </th>
                  <th className="px-6 sm:px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {claims.map((claim) => {
                  const statusStr = String(claim.status || 'Pending');
                  return (
                    <tr key={claim.id} className="hover:bg-gray-50/50">
                      <td className="px-6 sm:px-8 py-5 text-sm font-bold text-gray-400 italic">
                        {safeFormatDate(claim.date, 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 sm:px-8 py-5 font-black uppercase text-[#0B3C5D]">
                        {claim.employeeName}
                      </td>
                      <td className="px-6 sm:px-8 py-5">
                        <p className="font-bold text-gray-800">{claim.category}</p>
                        <p className="text-[10px] text-gray-400 font-medium italic">
                          {claim.description}
                        </p>
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right font-black text-[#0B3C5D]">
                        GHC {(Number(claim.amount) || 0).toLocaleString()}
                      </td>
                      <td className="px-6 sm:px-8 py-5">
                        <div className="flex justify-center items-center gap-2">
                          {statusStr === 'Pending' || statusStr === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  approveExpenseClaim(claim.id, claim.amount, claim.employeeName)
                                }
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectExpenseClaim(claim.id)}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                                  statusStr === 'Approved'
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : statusStr === 'Paid'
                                    ? 'bg-green-50 text-green-600 border-green-100'
                                    : 'bg-red-50 text-red-600 border-red-100'
                                }`}
                              >
                                {statusStr}
                              </span>
                              {statusStr === 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => payExpenseClaim(claim.id, claim.amount, 'cash')}
                                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-green-700 flex items-center gap-1"
                                >
                                  <CreditCard size={12} /> Pay
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => printDocument('Expense Claim', claim)}
                            className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-[#0B3C5D] hover:text-white transition-colors"
                            title="Print Claim"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-gray-400 italic">
                      No expense claims filed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddEmployee(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-[#0B3C5D]">ONBOARD EMPLOYEE</h3>
              <button type="button" onClick={() => setShowAddEmployee(false)} className="text-gray-400">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newEmployee.firstName}
                  onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newEmployee.lastName}
                  onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                />
              </div>
              <input
                type="email"
                placeholder="Official Email"
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
              />
              <input
                type="text"
                placeholder="Position"
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                value={newEmployee.position}
                onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
              />
              <select
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
              >
                <option value="">Select Department</option>
                <option value="Executive">Executive</option>
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
              </select>
              <input
                type="number"
                placeholder="Monthly Salary (GHC)"
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                value={newEmployee.salary || ''}
                onChange={(e) => setNewEmployee({ ...newEmployee, salary: Number(e.target.value) })}
              />
            </div>
            <button
              type="button"
              onClick={handleOnboard}
              className="w-full py-4 bg-[#EAB308] text-[#0B3C5D] font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-yellow-200"
            >
              Confirm Onboarding
            </button>
          </div>
        </div>
      )}

      {showAddClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddClaim(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-[#0B3C5D]">NEW EXPENSE CLAIM</h3>
              <button type="button" onClick={() => setShowAddClaim(false)} className="text-gray-400">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <select
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none"
                value={newClaim.employeeId}
                onChange={(e) => {
                  const emp = employees.find((ep) => ep.id === e.target.value);
                  setNewClaim({
                    ...newClaim,
                    employeeId: e.target.value,
                    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '',
                  });
                }}
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
              <input
                placeholder="Expense Category (e.g. Travel)"
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none"
                value={newClaim.category}
                onChange={(e) => setNewClaim({ ...newClaim, category: e.target.value })}
              />
              <input
                type="number"
                min={0.01}
                step="0.01"
                placeholder="Amount (GHC)"
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none"
                value={newClaim.total || ''}
                onChange={(e) => setNewClaim({ ...newClaim, total: Number(e.target.value) })}
              />
              <textarea
                placeholder="Description"
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none min-h-[100px]"
                value={newClaim.description}
                onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={handleCreateClaim}
              className="w-full py-4 bg-[#0B3C5D] text-white font-black rounded-2xl shadow-xl"
            >
              Submit Claim
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HR;
