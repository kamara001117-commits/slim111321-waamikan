import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { safeFormatDate } from '@/src/lib/dateUtils';
import { Search, Activity, Filter, FileText, CreditCard, Package, Users, ShoppingBag } from 'lucide-react';
import { ActivityLog } from '@/src/lib/activity';

const Logs = () => {
  const [logs, setLogs] = useState<(ActivityLog & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(250));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog & { id: string })));
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'logs');
      }
    );

    return () => unsubscribe();
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <FileText size={16} className="text-blue-600" />;
      case 'payment':
        return <CreditCard size={16} className="text-green-600" />;
      case 'product':
        return <Package size={16} className="text-amber-600" />;
      case 'user':
        return <Users size={16} className="text-purple-600" />;
      case 'order':
      case 'purchase':
        return <ShoppingBag size={16} className="text-[#1F7A8C]" />;
      default:
        return <Activity size={16} className="text-gray-500" />;
    }
  };

  const filtered = logs.filter((log) => {
    const matchesType = typeFilter === 'ALL' || log.type === typeFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      log.action?.toLowerCase().includes(term) ||
      log.details?.toLowerCase().includes(term) ||
      log.userName?.toLowerCase().includes(term);
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B3C5D]">System Audit Logs</h1>
          <p className="text-sm text-gray-500">
            Real-time operational audit trail across invoicing, payments, inventory, and staff
          </p>
        </div>
        <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600">
          Showing {filtered.length} of {logs.length} events
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-gray-50/50">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search action, details, or staff..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1F7A8C]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter size={16} className="text-gray-400 shrink-0" />
            {['ALL', 'invoice', 'payment', 'product', 'purchase', 'order', 'crm', 'user'].map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                    typeFilter === t
                      ? 'bg-[#0B3C5D] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6">Module</th>
                <th className="py-3.5 px-6">Action</th>
                <th className="py-3.5 px-6">Details</th>
                <th className="py-3.5 px-6">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Loading audit logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No activity events match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 px-6 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {safeFormatDate(log.timestamp, 'dd MMM yyyy, HH:mm:ss')}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold uppercase">
                        {getTypeIcon(log.type)}
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-[#0B3C5D]">{log.action}</td>
                    <td className="py-3.5 px-6 text-gray-600 max-w-md">{log.details}</td>
                    <td className="py-3.5 px-6 text-xs text-gray-500 font-mono">
                      {log.userName || log.userId || 'system'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Logs;
