import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { useOutletContext } from 'react-router-dom';
import {
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { STAFF_ROLE_LABELS, UserRole, isAdminRole } from '@/src/constants/auth';
import { logActivity } from '@/src/lib/activity';

type StaffRoleKey = Exclude<UserRole, 'user'>;

interface ActiveUserRecord {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  name?: string;
  createdAt?: string;
}

interface StaffInviteRecord {
  email: string;
  role: StaffRoleKey;
  invitedBy?: string;
  createdAt: string;
}

const ROLE_OPTIONS = Object.entries(STAFF_ROLE_LABELS) as [StaffRoleKey, string][];

const Staff = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [users, setUsers] = useState<ActiveUserRecord[]>([]);
  const [invites, setInvites] = useState<StaffInviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newInvite, setNewInvite] = useState<{
    email: string;
    role: StaffRoleKey;
  }>({
    email: '',
    role: 'staff',
  });

  useEffect(() => {
    if (currentUserRole !== 'super_admin') {
      setLoading(false);
      return;
    }

    let usersLoaded = false;
    let invitesLoaded = false;

    const unsubUsers = onSnapshot(
      query(collection(db, 'users')),
      (snapshot) => {
        setUsers(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as ActiveUserRecord)));
        usersLoaded = true;
        if (usersLoaded && invitesLoaded) setLoading(false);
      },
      (error) => {
        usersLoaded = true;
        if (usersLoaded && invitesLoaded) setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const unsubInvites = onSnapshot(
      query(collection(db, 'staff_invites')),
      (snapshot) => {
        setInvites(snapshot.docs.map((d) => ({ ...d.data(), email: d.id } as StaffInviteRecord)));
        invitesLoaded = true;
        if (usersLoaded && invitesLoaded) setLoading(false);
      },
      (error) => {
        invitesLoaded = true;
        if (usersLoaded && invitesLoaded) setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'staff_invites');
      }
    );

    return () => {
      unsubUsers();
      unsubInvites();
    };
  }, [currentUserRole]);

  const handleAddInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLower = newInvite.email.trim().toLowerCase();
    if (!emailLower || !emailLower.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'staff_invites', emailLower), {
        email: emailLower,
        role: newInvite.role,
        invitedBy: auth.currentUser?.email || auth.currentUser?.uid || 'super_admin',
        createdAt: now,
      });

      // If this user already has a profile in `users`, update their role immediately as well
      const existingUser = users.find((u) => u.email?.toLowerCase() === emailLower);
      if (existingUser) {
        await updateDoc(doc(db, 'users', existingUser.uid), {
          role: newInvite.role,
          updatedAt: now,
        });
      }

      await logActivity('user', `Granted ${newInvite.role} access to ${emailLower}`, emailLower, '');
      setIsModalOpen(false);
      setNewInvite({ email: '', role: 'staff' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff_invites');
      setErrorMsg('Failed to save staff invite. Check permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userRecord: ActiveUserRecord, nextRole: UserRole) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', userRecord.uid), {
        role: nextRole,
        updatedAt: now,
      });
      await logActivity(
        'user',
        `Updated role for ${userRecord.email} to ${nextRole}`,
        userRecord.uid,
        ''
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userRecord.uid}`);
    }
  };

  const handleDeleteUser = async (userRecord: ActiveUserRecord) => {
    if (userRecord.uid === auth.currentUser?.uid) {
      alert('You cannot remove your own active Super Admin session.');
      return;
    }
    if (!window.confirm(`Remove staff access for ${userRecord.email}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userRecord.uid));
      const emailLower = userRecord.email?.toLowerCase();
      if (emailLower && invites.some((inv) => inv.email.toLowerCase() === emailLower)) {
        await deleteDoc(doc(db, 'staff_invites', emailLower));
      }
      await logActivity('user', `Removed staff user ${userRecord.email}`, userRecord.uid, '');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userRecord.uid}`);
    }
  };

  const handleDeleteInvite = async (emailId: string) => {
    if (!window.confirm(`Revoke pending staff invite for ${emailId}?`)) return;
    try {
      await deleteDoc(doc(db, 'staff_invites', emailId));
      await logActivity('user', `Revoked staff invite for ${emailId}`, emailId, '');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff_invites/${emailId}`);
    }
  };

  if (currentUserRole !== 'super_admin' && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Shield size={64} className="text-red-200" />
        <h2 className="text-2xl font-bold text-gray-800">Access Restricted</h2>
        <p className="text-gray-500">Only Super Admins can manage staff members and roles.</p>
      </div>
    );
  }

  const staffUsers = users.filter((u) => isAdminRole(u.role));
  const pendingInvites = invites.filter(
    (inv) => !users.some((u) => u.email?.toLowerCase() === inv.email.toLowerCase())
  );

  const term = searchTerm.toLowerCase();
  const filteredUsers = staffUsers.filter(
    (s) =>
      s.email?.toLowerCase().includes(term) ||
      s.displayName?.toLowerCase().includes(term) ||
      s.name?.toLowerCase().includes(term)
  );
  const filteredInvites = pendingInvites.filter((inv) =>
    inv.email.toLowerCase().includes(term)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Staff &amp; Role Management</h2>
          <p className="text-sm text-gray-500">
            Invite team members and manage operational permissions
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsModalOpen(true);
          }}
          className="bg-[#0B3C5D] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all shadow-lg shadow-blue-900/10"
        >
          <UserPlus size={18} />
          Invite Staff Member
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search active staff or pending invites by name or email..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#0B3C5D]/10 outline-none transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Active Staff */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
          Active Staff Accounts ({filteredUsers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-400 font-medium">
              Loading staff records...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded-3xl border border-gray-100 text-gray-400 font-medium">
              No active staff members match your search.
            </div>
          ) : (
            filteredUsers.map((member) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                key={member.uid}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-2xl ${
                      member.role === 'super_admin'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <Shield size={24} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(member)}
                    title="Remove Staff Access"
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#0B3C5D] text-lg truncate">
                      {member.displayName || member.name || member.email.split('@')[0]}
                    </h4>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Mail size={14} />
                      <span className="truncate">{member.email}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                      className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[#0B3C5D] outline-none"
                    >
                      {ROLE_OPTIONS.map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                      <option value="user">Customer (Demote)</option>
                    </select>
                    <div className="flex items-center gap-1 text-green-600 text-[10px] font-black uppercase tracking-widest shrink-0">
                      <CheckCircle2 size={12} />
                      Active
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invites */}
      {filteredInvites.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
            Pending Staff Invites ({filteredInvites.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvites.map((invite) => (
              <div
                key={invite.email}
                className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                    <Clock size={22} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteInvite(invite.email)}
                    title="Revoke Invite"
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div>
                  <h4 className="font-bold text-[#0B3C5D] truncate">{invite.email}</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Role activates automatically upon Google Sign-In
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                    {STAFF_ROLE_LABELS[invite.role] || invite.role}
                  </span>
                  <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Invited
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 sm:p-8 border-b border-gray-100 bg-[#0B3C5D] text-white">
                <h3 className="text-2xl font-bold">Invite Staff Member</h3>
                <p className="text-blue-100 text-sm opacity-80">
                  Pre-authorize a Google email with a specific ERP role
                </p>
              </div>

              <form onSubmit={handleAddInvite} className="p-6 sm:p-8 space-y-6">
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Google Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                    <input
                      required
                      type="email"
                      placeholder="colleague@gmail.com"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0B3C5D]/20 outline-none transition-all font-medium"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Assigned System Role
                  </label>
                  <select
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-[#0B3C5D] outline-none"
                    value={newInvite.role}
                    onChange={(e) =>
                      setNewInvite({ ...newInvite, role: e.target.value as StaffRoleKey })
                    }
                  >
                    {ROLE_OPTIONS.map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3.5 font-bold text-gray-500 rounded-2xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#0B3C5D] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-[#1F7A8C] transition-all disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Staff;
