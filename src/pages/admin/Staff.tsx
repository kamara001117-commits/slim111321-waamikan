import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  setDoc,
  doc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { useOutletContext } from 'react-router-dom';
import { 
  UserPlus, 
  Shield, 
  Trash2, 
  Mail, 
  User as UserIcon,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';

interface StaffUser {
  uid?: string;
  email: string;
  role: 'admin' | 'super_admin' | 'staff' | 'user';
  name?: string;
  createdAt: string;
}

const Staff = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newStaff, setNewStaff] = useState({
    email: '',
    role: 'admin' as 'admin' | 'super_admin'
  });

  useEffect(() => {
    if (currentUserRole !== 'super_admin') {
      setLoading(false);
      return;
    }

    // Fetch all users with roles
    const q = query(collection(db, 'users'));
    const unsubscribeStaff = onSnapshot(q, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as StaffUser)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeStaff();
    };
  }, [currentUserRole]);

  const handleAddStaff = async () => {
    if (!newStaff.email) return;
    
    try {
      // In this system, we pre-define the role for an email.
      // We use a normalized version of the email as the ID if we don't have a UID yet,
      // or we can just search by email during login.
      // For simplicity, we'll store them in the 'users' collection.
      // Note: If the user doesn't exist in Auth yet, we are essentially "inviting" them.
      
      const userRef = doc(collection(db, 'users'));
      await setDoc(userRef, {
        email: newStaff.email.toLowerCase().trim(),
        role: newStaff.role,
        createdAt: new Date().toISOString(),
        invitedBy: auth.currentUser?.email
      });

      setIsModalOpen(false);
      setNewStaff({ email: '', role: 'admin' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleDeleteStaff = async (uid: string) => {
    if (!window.confirm('Are you sure you want to remove this user from staff?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  if (currentUserRole !== 'super_admin' && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Shield size={64} className="text-red-200" />
        <h2 className="text-2xl font-bold text-gray-800">Access Restricted</h2>
        <p className="text-gray-500">Only Super Admins can manage staff members.</p>
      </div>
    );
  }

  const filteredStaff = staff.filter(s => 
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Staff Management</h2>
          <p className="text-sm text-gray-400">Manage administrator roles and permissions</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0B3C5D] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all shadow-lg shadow-blue-900/10"
        >
          <UserPlus size={18} />
          Add Staff Member
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search staff by name or email..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#0B3C5D]/10 outline-none transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400 font-medium">Loading staff records...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 font-medium">No staff members found matching your search.</div>
        ) : (
          filteredStaff.map((user) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={user.uid}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Shield size={24} />
                </div>
                <button 
                  onClick={() => user.uid && handleDeleteStaff(user.uid)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-[#0B3C5D] text-lg truncate">
                    {user.name || 'Pending Registration'}
                  </h3>
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Mail size={14} />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full ${
                    user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role.replace('_', ' ')}
                  </span>
                  {user.name ? (
                    <div className="flex items-center gap-1 text-green-500 text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={12} />
                      Active
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-orange-500 text-[10px] font-black uppercase tracking-widest">
                      <AlertCircle size={12} />
                      Invited
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-[#0B3C5D] text-white">
                <h3 className="text-2xl font-bold">Add Staff Member</h3>
                <p className="text-blue-100 text-sm opacity-80">Grant administrative access to a new user</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                    <input 
                      type="email" 
                      placeholder="colleague@waamikan.com"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#0B3C5D]/10 outline-none transition-all font-medium"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">System Role</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setNewStaff({ ...newStaff, role: 'admin' })}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        newStaff.role === 'admin' 
                          ? 'border-[#0B3C5D] bg-blue-50 text-[#0B3C5D]' 
                          : 'border-gray-100 bg-white text-gray-400'
                      }`}
                    >
                      <UserIcon size={24} />
                      <span className="font-bold">Admin</span>
                    </button>
                    <button 
                      onClick={() => setNewStaff({ ...newStaff, role: 'super_admin' })}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        newStaff.role === 'super_admin' 
                          ? 'border-purple-500 bg-purple-50 text-purple-700' 
                          : 'border-gray-100 bg-white text-gray-400'
                      }`}
                    >
                      <Shield size={24} />
                      <span className="font-bold">Super Admin</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 font-bold text-gray-500"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddStaff}
                    className="flex-2 bg-[#0B3C5D] text-white px-8 py-4 rounded-2xl font-bold hover:shadow-xl transition-all"
                  >
                    Confirm Access
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

export default Staff;
