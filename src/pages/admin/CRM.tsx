import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, orderBy, addDoc } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { CRMRequest, Customer, RequestNote } from '@/src/types';
import { useOutletContext } from 'react-router-dom';
import {
  Users,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  UserPlus,
  Send,
  MessageCircle,
  X,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { logActivity } from '@/src/lib/activity';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { safeFormatDate } from '@/src/lib/dateUtils';

const CRM = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [requests, setRequests] = useState<CRMRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'customers'>('requests');
  const [selectedRequest, setSelectedRequest] = useState<CRMRequest | null>(null);
  const [newNote, setNewNote] = useState('');
  const [isNoteProcessing, setIsNoteProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!currentUserRole) return;

    const qReq = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubReq = onSnapshot(
      qReq,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CRMRequest)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests');
      }
    );

    const qCust = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubCust = onSnapshot(
      qCust,
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      }
    );

    return () => {
      unsubReq();
      unsubCust();
    };
  }, [currentUserRole]);

  const updateStatus = async (id: string, status: any) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'requests', id), {
        status,
        lastContacted: now,
        updatedAt: now,
      });
      await logActivity('crm', `Changed request status to ${status}`, id, '');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `requests/${id}`);
    }
  };

  const addNote = async (requestId: string) => {
    if (!newNote.trim()) return;
    setIsNoteProcessing(true);
    const user = auth.currentUser;
    const note: RequestNote = {
      id: Math.random().toString(36).slice(2, 11),
      content: newNote.trim(),
      adminName: user?.displayName || user?.email || 'Admin',
      timestamp: new Date().toISOString(),
    };

    try {
      const reqRef = doc(db, 'requests', requestId);
      const req = requests.find((r) => r.id === requestId);
      const updatedNotes = [...(req?.notes || []), note];
      const now = new Date().toISOString();
      await updateDoc(reqRef, {
        notes: updatedNotes,
        lastContacted: now,
        updatedAt: now,
      });
      setSelectedRequest((prev) => (prev ? { ...prev, notes: updatedNotes } : prev));
      setNewNote('');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `requests/${requestId}`);
      alert('Failed to save note.');
    } finally {
      setIsNoteProcessing(false);
    }
  };

  const promoteToCustomer = async (req: CRMRequest) => {
    try {
      const existing = customers.find(
        (c) => c.email?.toLowerCase() === req.email?.toLowerCase()
      );
      if (existing) {
        alert('This client already exists in the database.');
        return;
      }

      const now = new Date().toISOString();
      await addDoc(collection(db, 'customers'), {
        name: req.hospital || req.name,
        contactPerson: req.name,
        email: req.email,
        phone: '',
        address: '',
        type: 'public',
        totalSpent: 0,
        invoiceCount: 0,
        lastContacted: now,
        createdAt: now,
      });
      await updateDoc(doc(db, 'requests', req.id), { status: 'responded', updatedAt: now });
      await logActivity(
        'crm',
        'Converted request to client',
        req.id,
        `Client: ${req.hospital || req.name}`
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'customers');
      alert('Failed to convert lead to client.');
    }
  };

  const exportCustomersToCSV = () => {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Address',
      'Type',
      'Total Spent',
      'Invoice Count',
      'Last Contacted',
    ];
    const rows = customers.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.email || '',
      c.phone || '',
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.type || '',
      c.totalSpent || 0,
      c.invoiceCount || 0,
      c.lastContacted ? safeFormatDate(c.lastContacted, 'yyyy-MM-dd HH:mm') : 'Never',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers.join(',') +
      '\n' +
      rows.map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `waamikan_customers_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRequests = requests.filter(
    (r) =>
      (r.hospital || r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B3C5D]">CRM Portal</h1>
          <p className="text-gray-400 font-medium">
            Manage institutional relationships and leads
          </p>
        </div>
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search leads or clients..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-[#1F7A8C] outline-none w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'customers' && (
            <button
              type="button"
              onClick={exportCustomersToCSV}
              className="flex items-center gap-2 px-5 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition-all border border-green-100 text-sm"
            >
              <Users size={18} />
              Export Clients
            </button>
          )}
          <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl ring-1 ring-gray-100">
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                activeTab === 'requests'
                  ? 'bg-[#0B3C5D] text-white shadow-lg shadow-blue-900/20'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Leads ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                activeTab === 'customers'
                  ? 'bg-[#0B3C5D] text-white shadow-lg shadow-blue-900/20'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Clients ({customers.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((req) => (
            <motion.div
              layout
              key={req.id}
              className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6 hover:shadow-xl transition-all group"
            >
              <div className="flex justify-between items-start">
                <div className="p-4 bg-blue-50 text-[#0B3C5D] rounded-2xl group-hover:bg-[#0B3C5D] group-hover:text-white transition-all">
                  <Mail size={24} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest ${
                      req.status === 'new'
                        ? 'bg-blue-100 text-blue-700'
                        : req.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-700'
                        : req.status === 'responded'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {req.status === 'in_progress' ? 'Working' : req.status}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-[#0B3C5D] hover:bg-blue-50 transition-all"
                    >
                      <MessageSquare size={16} />
                    </button>
                    <select
                      className="p-2 bg-gray-50 rounded-lg text-gray-500 hover:text-[#0B3C5D] border-none text-[10px] focus:ring-0 cursor-pointer"
                      value={req.status}
                      onChange={(e) => updateStatus(req.id, e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="in_progress">Working</option>
                      <option value="responded">Responded</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-black text-gray-800 text-xl mb-1">
                  {req.hospital || req.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <UserPlus size={14} /> {req.name}
                </div>
              </div>
              <div className="bg-gray-50/50 p-4 rounded-2xl italic text-sm text-gray-500 line-clamp-2 border border-gray-100/50">
                &ldquo;{req.message}&rdquo;
              </div>
              <div className="pt-4 border-t border-gray-50 flex flex-col gap-4">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  <span>Received: {safeFormatDate(req.createdAt, 'MMM d, yyyy')}</span>
                  {req.lastContacted && (
                    <span className="text-[#1F7A8C]">
                      Active: {safeFormatDate(req.lastContacted, 'PP p')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => promoteToCustomer(req)}
                  className="w-full py-3 bg-gray-50 text-[#0B3C5D] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#0B3C5D] hover:text-white transition-all border border-gray-100"
                >
                  Convert to Enterprise Client
                </button>
              </div>
            </motion.div>
          ))}
          {filteredRequests.length === 0 && (
            <div className="col-span-full bg-white p-16 rounded-[3rem] border-2 border-dashed border-gray-100 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <MessageCircle size={32} />
              </div>
              <p className="text-gray-400 font-bold">
                No incoming hospital requests match your filter.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Institution / Person
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Connect
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Metrics
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Last Interaction
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-6">
                      <p className="font-black text-[#0B3C5D] text-lg leading-tight">{c.name}</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase mt-1">
                        <MapPin size={12} /> {c.address || 'Accra, Ghana'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Mail size={14} className="text-gray-300" /> {c.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Phone size={14} className="text-gray-300" />{' '}
                          {c.phone || '+233 --- --- ---'}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          String(c.type).toLowerCase() === 'public'
                            ? 'bg-orange-50 text-orange-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {String(c.type).toLowerCase() === 'public'
                          ? 'Govt Hospital'
                          : 'Private Facility'}
                      </span>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">
                        GHC {c.totalSpent?.toLocaleString() || 0} Spent
                      </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {c.lastContacted ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-gray-600">
                            {safeFormatDate(c.lastContacted, 'PP')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {safeFormatDate(c.lastContacted, 'p')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No recent logs</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Detail Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedRequest(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b flex justify-between items-center bg-[#0B3C5D] text-white">
                <div>
                  <h3 className="text-xl font-bold">
                    {selectedRequest.hospital || selectedRequest.name}
                  </h3>
                  <p className="text-sm opacity-80">Request Details</p>
                </div>
                <button type="button" onClick={() => setSelectedRequest(null)}>
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow">
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Original Message
                  </p>
                  <p className="text-gray-700 italic">&ldquo;{selectedRequest.message}&rdquo;</p>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Users size={16} /> {selectedRequest.name}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Mail size={16} /> {selectedRequest.email}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <MessageCircle size={18} className="text-blue-500" />
                    Internal Notes
                  </h4>
                  <div className="space-y-3">
                    {selectedRequest.notes?.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-blue-600 uppercase">
                            {note.adminName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {safeFormatDate(note.timestamp, 'PP p')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                    {(!selectedRequest.notes || selectedRequest.notes.length === 0) && (
                      <p className="text-sm text-gray-400 italic">No notes added yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add an internal note..."
                    className="flex-grow p-3 bg-white border border-gray-200 rounded-xl text-sm"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNote(selectedRequest.id)}
                  />
                  <button
                    type="button"
                    onClick={() => addNote(selectedRequest.id)}
                    disabled={isNoteProcessing}
                    className="p-3 bg-[#0B3C5D] text-white rounded-xl hover:bg-[#1F7A8C] transition-all disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRM;
