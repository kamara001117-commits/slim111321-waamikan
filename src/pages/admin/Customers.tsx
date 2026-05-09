import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Customer, Invoice } from '@/src/types';
import { useOutletContext } from 'react-router-dom';
import { Users, Mail, Phone, MapPin, History, TrendingUp, Search, X, Eye, FileText, Plus, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';

const Customers = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  // ...
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    type: 'Private' as 'Public' | 'Private'
  });

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        totalSpent: 0,
        invoiceCount: 0,
        createdAt: new Date().toISOString(),
        lastContacted: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewCustomer({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        type: 'Private'
      });
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Failed to add customer. Please try again.");
    }
  };

  useEffect(() => {
    if (!currentUserRole) return;

    const qCust = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => unsubscribe();
  }, [currentUserRole]);

  const viewCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    const qInv = query(
      collection(db, 'invoices'),
      where('customerId', '==', customer.id),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(qInv);
    setCustomerInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-[#0B3C5D]">Client Management</h1>
          <p className="text-gray-400 font-medium">Manage institutional relationships and details</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-grow md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-[#1F7A8C] outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#0B3C5D] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={18} />
            Add Client
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <motion.div 
            key={customer.id}
            whileHover={{ y: -4 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4 cursor-pointer"
            onClick={() => viewCustomerDetail(customer)}
          >
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-50 rounded-2xl text-[#0B3C5D]">
                <Users size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Spent</p>
                <p className="text-lg font-black text-[#0B3C5D]">GH₵ {(customer.totalSpent || 0).toLocaleString()}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-800 line-clamp-1">{customer.name}</h3>
              <p className="text-sm text-gray-400">{customer.contactPerson || 'No contact person'}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail size={14} /> {customer.email}
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone size={14} /> {customer.phone}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#1F7A8C]">
               <span>{customer.invoiceCount || 0} Invoices</span>
               <span className="px-2 py-1 bg-[#1F7A8C]/10 rounded-lg">{customer.type}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-[#0B3C5D]">Register New Client</h3>
                  <p className="text-sm text-gray-400">Enter client information to create a new profile</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Institution Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      placeholder="e.g. Greater Accra Hospital"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact Person</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={newCustomer.contactPerson}
                      onChange={(e) => setNewCustomer({...newCustomer, contactPerson: e.target.value})}
                      placeholder="Full Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Entity Type</label>
                    <select 
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={newCustomer.type}
                      onChange={(e) => setNewCustomer({...newCustomer, type: e.target.value as any})}
                    >
                      <option value="Private">Private Facility</option>
                      <option value="Public">Public/Government</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      required
                      type="email" 
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      placeholder="client@hospital.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      placeholder="+233 24 000 0000"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Physical Address</label>
                    <textarea 
                      rows={3}
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                      placeholder="GPS Location or Street Address"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-grow px-8 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-grow bg-[#0B3C5D] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#1F7A8C] transition-all shadow-xl shadow-blue-900/10"
                  >
                    <Save size={18} />
                    Create Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)} />
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b flex justify-between items-center bg-[#0B3C5D] text-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl"><Users size={32} /></div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedCustomer.name}</h3>
                    <p className="text-sm opacity-80">Client Profile & History</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)}><X size={24} /></button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 flex-grow">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 space-y-6">
                       <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-4">
                          <h4 className="font-bold text-gray-800 uppercase text-xs tracking-widest">Contact Info</h4>
                          <div className="space-y-3">
                             <div className="flex items-center gap-3">
                                <Mail size={18} className="text-gray-400" />
                                <span className="text-sm font-medium">{selectedCustomer.email}</span>
                             </div>
                             <div className="flex items-center gap-3">
                                <Phone size={18} className="text-gray-400" />
                                <span className="text-sm font-medium">{selectedCustomer.phone || 'N/A'}</span>
                             </div>
                             <div className="flex items-start gap-3">
                                <MapPin size={18} className="text-gray-400 mt-0.5" />
                                <span className="text-sm font-medium">{selectedCustomer.address || 'No address provided'}</span>
                             </div>
                          </div>
                       </div>

                       <div className="bg-[#1F7A8C]/5 rounded-3xl p-6 border border-[#1F7A8C]/10 space-y-2">
                          <p className="text-[10px] font-bold text-[#1F7A8C] uppercase tracking-widest text-center">Lifetime Revenue</p>
                          <p className="text-3xl font-black text-[#1F7A8C] text-center">GH₵ {(selectedCustomer.totalSpent || 0).toLocaleString()}</p>
                       </div>
                    </div>

                    <div className="col-span-2 space-y-4">
                       <h4 className="font-black text-gray-800 text-lg flex items-center gap-2">
                          <History size={20} className="text-[#0B3C5D]" />
                          Billing History
                       </h4>
                       <div className="space-y-3">
                          {customerInvoices.map(inv => (
                            <div key={inv.id} className="flex justify-between items-center p-5 bg-white border border-gray-100 rounded-3xl hover:border-blue-200 transition-all shadow-sm">
                               <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-2xl ${inv.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                                     <FileText size={20} />
                                  </div>
                                  <div>
                                     <p className="font-bold text-[#0B3C5D]">{inv.invoiceNumber}</p>
                                     <p className="text-xs text-gray-400">{format(new Date(inv.createdAt), 'PPP')}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="font-black text-gray-800">GH₵ {inv.total.toLocaleString()}</p>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                                    inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {inv.status}
                                  </span>
                               </div>
                            </div>
                          ))}
                          {customerInvoices.length === 0 && <p className="text-center py-12 text-gray-400 italic">No invoices found for this client.</p>}
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;
