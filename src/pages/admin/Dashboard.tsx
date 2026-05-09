import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useOutletContext } from 'react-router-dom';
import { 
  TrendingUp, 
  Package, 
  Users, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight,
  ShoppingCart,
  Download,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { format, startOfDay, startOfMonth, subDays, isAfter } from 'date-fns';
import { ActivityLog, Invoice } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';

const chartData = [
  { name: 'Mon', revenue: 4500 },
  { name: 'Tue', revenue: 5200 },
  { name: 'Wed', revenue: 4800 },
  { name: 'Thu', revenue: 6100 },
  { name: 'Fri', revenue: 5900 },
  { name: 'Sat', revenue: 3200 },
  { name: 'Sun', revenue: 2800 },
];

const Dashboard = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<'daily' | 'monthly' | 'all'>('all');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    inventoryCount: 0,
    newRequests: 0,
    outstandingPayments: 0,
    overdueTotal: 0,
    paidVsUnpaid: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0
  });

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      const invs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      setInvoices(invs);
      
      const now = new Date();
      let filtered = invs;
      
      if (filter === 'daily') {
        filtered = invs.filter(i => isAfter(new Date(i.createdAt), startOfDay(now)));
      } else if (filter === 'monthly') {
        filtered = invs.filter(i => isAfter(new Date(i.createdAt), startOfMonth(now)));
      }

      // Financial calculations
      const totalRevenue = invs.filter(i => i.status === 'paid' || i.status === 'partial').reduce((sum, i) => sum + (i.paidAmount || 0), 0);
      const outstanding = invs.reduce((sum, i) => sum + (i.remainingBalance || 0), 0);
      const overdueTotal = invs.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.total || 0), 0);
      const paidCount = invs.filter(i => i.status === 'paid').length;
      const unpaidCount = invs.filter(i => i.status !== 'paid').length;

      setStats(prev => ({
        ...prev,
        totalRevenue,
        outstandingPayments: outstanding,
        overdueTotal,
        paidVsUnpaid: invs.length > 0 ? (paidCount / invs.length) * 100 : 0,
        pendingInvoices: filtered.filter(i => i.status === 'sent' || i.status === 'partial').length,
        paidInvoices: filtered.filter(i => i.status === 'paid').length,
        overdueInvoices: filtered.filter(i => i.status === 'overdue').length
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setStats(prev => ({ ...prev, inventoryCount: snap.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const unsubRequests = onSnapshot(collection(db, 'requests'), (snap) => {
      setStats(prev => ({ ...prev, newRequests: snap.docs.filter(d => d.data().status === 'new').length }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubRequests();
      unsubLogs();
    };
  }, [filter, currentUserRole]);

  const exportToCSV = (type: 'invoices' | 'revenue' | 'customers') => {
    let headers: string[] = [];
    let rows: any[] = [];
    let fileName = `waamikan_export_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    if (type === 'invoices') {
      headers = ['Invoice Number', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Date'];
      rows = invoices.map(i => [
        i.invoiceNumber,
        i.customerName,
        i.total,
        i.paidAmount || 0,
        i.remainingBalance || 0,
        i.status,
        format(new Date(i.createdAt), 'yyyy-MM-dd')
      ]);
    } else if (type === 'revenue') {
      headers = ['Date', 'Invoice', 'Customer', 'Amount Paid', 'Remaining'];
      rows = invoices.filter(i => (i.paidAmount || 0) > 0).map(i => [
        format(new Date(i.createdAt), 'yyyy-MM-dd'),
        i.invoiceNumber,
        i.customerName,
        i.paidAmount,
        i.remainingBalance
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cards = [
    { name: 'Total Revenue', value: `GH₵ ${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp className="text-green-600" />, trend: '+12.5%', color: 'bg-green-50' },
    { name: 'Outstanding Payments', value: `GH₵ ${stats.outstandingPayments.toLocaleString()}`, icon: <Clock className="text-orange-600" />, trend: 'Action Required', color: 'bg-orange-50' },
    { name: 'Overdue Total', value: `GH₵ ${stats.overdueTotal.toLocaleString()}`, icon: <AlertCircle className="text-red-600" />, trend: 'Critical', color: 'bg-red-50' },
    { name: 'Collection Rate', value: `${stats.paidVsUnpaid.toFixed(1)}%`, icon: <CheckCircle className="text-blue-600" />, trend: 'Paid vs Unpaid', color: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Stats Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B3C5D]">Financial Analytics</h1>
          <p className="text-gray-400 text-sm">Enterprise-grade performance monitoring</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-gray-50 p-1 rounded-xl ring-1 ring-gray-100">
            {['all', 'daily', 'monthly'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-[#0B3C5D] text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button 
            onClick={() => exportToCSV('invoices')}
            className="flex items-center gap-2 px-6 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition-all border border-green-100"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 ${card.color} rounded-2xl`}>{card.icon}</div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${card.trend.includes('+') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {card.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">{card.name}</p>
            <h3 className="text-2xl font-black text-gray-800">{card.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-gray-800">Revenue Overview</h3>
            <select className="text-sm border-none bg-gray-50 p-2 rounded-lg outline-none font-bold text-gray-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#0B3C5D" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-800 mb-8">System Activity Logs</h3>
          <div className="space-y-6">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-[#0B3C5D] group-hover:bg-[#0B3C5D] group-hover:text-white transition-all">
                  {log.type === 'invoice' ? <FileText size={20} /> :
                   log.type === 'payment' ? <CreditCard size={20} /> :
                   log.type === 'crm' ? <Users size={20} /> : <Package size={20} />}
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-bold text-gray-800">{log.action}</p>
                  <p className="text-xs text-gray-400">By {log.userName} • {format(new Date(log.timestamp), 'p')}</p>
                </div>
                {log.details && (
                  <p className="text-[10px] font-black text-[#0B3C5D] bg-blue-50 px-2 py-1 rounded">{log.details}</p>
                )}
              </div>
            ))}
            {logs.length === 0 && <p className="text-center py-8 text-gray-400 italic">No activity logs yet.</p>}
          </div>
          <button className="w-full mt-8 py-4 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 font-bold text-sm hover:border-[#0B3C5D] hover:text-[#0B3C5D] transition-all">
            View Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
