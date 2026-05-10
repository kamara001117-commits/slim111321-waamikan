import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Employee, Attendance, Payroll, ExpenseClaim } from '@/src/types/erp';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { format } from 'date-fns';
import { 
  Users, 
  Briefcase, 
  Calendar, 
  DollarSign, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle,
  Clock,
  ArrowRight,
  UserPlus,
  FileText
} from 'lucide-react';
import { approveExpenseClaim, payExpenseClaim, createExpenseClaim } from '@/src/lib/expenseService';
import { generateMonthlyPayroll } from '@/src/lib/hrService';

const HR = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'claims'>('employees');
  const [loading, setLoading] = useState(true);

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [newClaim, setNewClaim] = useState({ employeeId: '', employeeName: '', total: 0, category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });

  const handleCreateClaim = async () => {
    try {
      await createExpenseClaim({
        ...newClaim,
        amount: Number(newClaim.total),
        status: 'Pending'
      });
      setShowAddClaim(false);
      setNewClaim({ employeeId: '', employeeName: '', total: 0, category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleRunPayroll = async () => {
    try {
      const month = format(new Date(), 'yyyy-MM');
      await generateMonthlyPayroll(month);
      alert(`Payroll for ${month} generated successfully.`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'employees'));

    const unsubPayroll = onSnapshot(
      query(collection(db, 'payroll'), orderBy('month', 'desc')), 
      (snap) => {
        setPayroll(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payroll)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'payroll')
    );

    const unsubClaims = onSnapshot(
      query(collection(db, 'expense_claims'), orderBy('date', 'desc')), 
      (snap) => {
        setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseClaim)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'expense_claims')
    );

    return () => {
      unsubEmployees();
      unsubPayroll();
      unsubClaims();
    };
  }, []);

  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    position: '',
    department: '',
    salary: 0,
    joiningDate: format(new Date(), 'yyyy-MM-dd')
  });

  const handleOnboard = async () => {
    try {
      await addDoc(collection(db, 'employees'), {
        ...newEmployee,
        status: 'active'
      });
      setShowAddEmployee(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">HR & Workforce</h2>
           <p className="text-sm font-medium text-gray-400 italic">Personnel management and organizational payroll</p>
        </div>
        <div className="flex gap-4">
           {activeTab === 'employees' && (
             <button 
               onClick={() => setShowAddEmployee(true)}
               className="flex items-center gap-2 px-6 py-4 bg-[#EAB308] text-white rounded-2xl font-black shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-all"
             >
               <UserPlus size={20} />
               ONBOARD EMPLOYEE
             </button>
           )}
           {activeTab === 'payroll' && (
             <button 
               onClick={handleRunPayroll}
               className="flex items-center gap-2 px-6 py-4 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all"
             >
               <Plus size={20} />
               GENERATE BATCH PAYROLL
             </button>
           )}
           {activeTab === 'claims' && (
             <button 
               onClick={() => setShowAddClaim(true)}
               className="flex items-center gap-2 px-6 py-4 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all"
             >
               <Plus size={20} />
               NEW EXPENSE CLAIM
             </button>
           )}
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {[
          { id: 'employees', name: 'Employees', icon: <Users size={18} /> },
          { id: 'payroll', name: 'Payroll', icon: <DollarSign size={18} /> },
          { id: 'claims', name: 'Expenses', icon: <FileText size={18} /> }
        ].map(tab => (
          <button
            key={tab.id}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {employees.map(employee => (
             <div key={employee.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 relative group overflow-hidden">
                <div className="relative z-10">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl border-2 border-[#EAB308] flex items-center justify-center text-[#0B3C5D] font-black text-xl">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </div>
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                        employee.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {employee.status}
                      </span>
                   </div>
                   <div className="space-y-4">
                      <div>
                         <h3 className="text-xl font-black text-[#0B3C5D] leading-tight uppercase tracking-tight">
                           {employee.firstName} {employee.lastName}
                         </h3>
                         <p className="text-[10px] text-[#1F7A8C] font-black uppercase tracking-widest mt-1">
                           {employee.position}
                         </p>
                      </div>
                      <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                         <p className="flex items-center gap-2"><Briefcase size={12} /> {employee.department}</p>
                         <p className="flex items-center gap-2"><Calendar size={12} /> Joined: {format(new Date(employee.joiningDate), 'MMM yyyy')}</p>
                      </div>
                   </div>
                   <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all">
                      <button className="text-[10px] font-black text-[#0B3C5D] uppercase tracking-widest flex items-center gap-2">
                        MANAGE PROFILE <ArrowRight size={14} />
                      </button>
                   </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
             </div>
           ))}
           {employees.length === 0 && (
             <div className="col-span-4 py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 font-medium">
                <Users size={48} className="mb-4 opacity-20" />
                <p>No employee records found. Start workforce onboarding.</p>
             </div>
           )}
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 text-white rounded-xl">
                   <DollarSign size={24} />
                </div>
                <div>
                   <h4 className="font-black text-[#0B3C5D] uppercase tracking-tight">Active Payroll Run</h4>
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Status: Pending Verification</p>
                </div>
             </div>
             <button 
               onClick={handleRunPayroll}
               className="px-6 py-3 bg-[#0B3C5D] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-colors"
             >
               Finalize All for {format(new Date(), 'MMMM')}
             </button>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
             <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Period</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Base</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Pay</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payroll.map(pay => (
                      <tr key={pay.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-6 font-mono text-xs font-black text-[#1F7A8C]">{pay.month}</td>
                        <td className="px-8 py-6">
                           <p className="font-black text-gray-800 uppercase tracking-tight">{pay.employeeName}</p>
                           <div className="flex gap-4 text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                              <span>All.: GHC {pay.allowances}</span>
                              <span>Ded.: GHC {pay.deductions}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right font-bold text-gray-400">GHC {pay.baseSalary.toLocaleString()}</td>
                        <td className="px-8 py-6 text-right font-black text-[#0B3C5D]">GHC {pay.netPay.toLocaleString()}</td>
                        <td className="px-8 py-6">
                           <div className="flex justify-center">
                              <span className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                                pay.status === 'paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                              }`}>
                                {pay.status}
                              </span>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Category / Reason</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {claims.map(claim => (
                    <tr key={claim.id}>
                      <td className="px-8 py-6 text-sm font-bold text-gray-400 italic">
                        {format(new Date(claim.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-8 py-6 font-black uppercase text-[#0B3C5D]">{claim.employeeName}</td>
                      <td className="px-8 py-6">
                         <p className="font-bold text-gray-800">{claim.category}</p>
                         <p className="text-[10px] text-gray-400 font-medium italic">{claim.description}</p>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-[#0B3C5D]">GHC {claim.amount.toLocaleString()}</td>
                      <td className="px-8 py-6">
                         <div className="flex justify-center gap-2">
                           {claim.status === 'Pending' ? (
                             <>
                               <button 
                                 onClick={() => approveExpenseClaim(claim.id, claim.amount, claim.employeeName)}
                                 className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                               >
                                 <CheckCircle2 size={18} />
                               </button>
                               <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                 <XCircle size={18} />
                               </button>
                             </>
                           ) : (
                             <span className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                               claim.status === 'Approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                               claim.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' :
                               'bg-red-50 text-red-600 border-red-100'
                             }`}>
                               {claim.status}
                             </span>
                           )}
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      )}
      {showAddEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddEmployee(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-8">
             <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-[#0B3C5D]">ONBOARD EMPLOYEE</h3>
                <button onClick={() => setShowAddEmployee(false)} className="text-gray-400"><Plus className="rotate-45" size={24} /></button>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="First Name" 
                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                    value={newEmployee.firstName}
                    onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Last Name" 
                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                    value={newEmployee.lastName}
                    onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})}
                  />
                </div>
                <input 
                  type="email" 
                  placeholder="Official Email" 
                  className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newEmployee.email}
                  onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="Position" 
                  className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newEmployee.position}
                  onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
                />
                <select 
                  className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newEmployee.department}
                  onChange={e => setNewEmployee({...newEmployee, department: e.target.value})}
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
                  className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newEmployee.salary || ''}
                  onChange={e => setNewEmployee({...newEmployee, salary: Number(e.target.value)})}
                />
             </div>
             <button 
               onClick={handleOnboard}
               className="w-full py-5 bg-[#EAB308] text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-yellow-200"
             >
                Confirm Onboarding
             </button>
          </div>
        </div>
      )}

      {showAddClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddClaim(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-[#0B3C5D]">NEW EXPENSE CLAIM</h3>
                <button onClick={() => setShowAddClaim(false)} className="text-gray-400"><Plus className="rotate-45" size={24} /></button>
             </div>
             <div className="space-y-4">
                <select 
                  className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                  onChange={e => {
                    const emp = employees.find(ep => ep.id === e.target.value);
                    setNewClaim({...newClaim, employeeId: e.target.value, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : ''});
                  }}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                </select>
                <input placeholder="Expense Category (e.g. Travel)" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewClaim({...newClaim, category: e.target.value})} />
                <input type="number" placeholder="Amount (GHC)" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewClaim({...newClaim, total: Number(e.target.value)})} />
                <textarea placeholder="Description" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none min-h-[100px]" onChange={e => setNewClaim({...newClaim, description: e.target.value})} />
             </div>
             <button onClick={handleCreateClaim} className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl shadow-xl">Submit Claim</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HR;
