import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useOutletContext, Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  Users,
  FileText,
  Download,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  format,
  startOfDay,
  startOfMonth,
  isAfter,
  subMonths,
  eachMonthOfInterval,
} from 'date-fns';
import { ActivityLog, Invoice, Product } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { safeDate, safeFormatDate } from '@/src/lib/dateUtils';

const Dashboard = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
    overdueInvoices: 0,
    avgOrderValue: 0,
    modulePulse: [
      { name: 'Core ERP', status: 'Stable', health: 100 },
      { name: 'Inventory', status: 'Active', health: 98 },
      { name: 'Accounting', status: 'In Sync', health: 100 },
      { name: 'CRM', status: 'Active', health: 95 },
    ],
  });

  const [monthlyRevenue, setMonthlyRevenue] = useState<{ name: string; revenue: number }[]>([]);

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snap) => {
        const invs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
        setInvoices(invs);

        const now = new Date();
        let filtered = invs;

        if (filter === 'daily') {
          const dayStart = startOfDay(now);
          filtered = invs.filter((i) => {
            const d = safeDate(i.createdAt);
            return d ? isAfter(d, dayStart) : false;
          });
        } else if (filter === 'monthly') {
          const monthStart = startOfMonth(now);
          filtered = invs.filter((i) => {
            const d = safeDate(i.createdAt);
            return d ? isAfter(d, monthStart) : false;
          });
        }

        const totalRevenue = filtered
          .filter((i) => i.status === 'paid' || i.status === 'partial')
          .reduce((sum, i) => sum + (i.paidAmount || 0), 0);
        const outstanding = filtered.reduce((sum, i) => sum + (i.remainingBalance || 0), 0);
        const overdueTotal = filtered
          .filter((i) => i.status === 'overdue')
          .reduce((sum, i) => sum + (i.total || 0), 0);
        const paidCount = filtered.filter((i) => i.status === 'paid').length;
        const avgVal =
          filtered.length > 0
            ? filtered.reduce((sum, i) => sum + (i.total || 0), 0) / filtered.length
            : 0;

        setStats((prev) => ({
          ...prev,
          totalRevenue,
          outstandingPayments: outstanding,
          overdueTotal,
          paidVsUnpaid: filtered.length > 0 ? (paidCount / filtered.length) * 100 : 0,
          pendingInvoices: filtered.filter(
            (i) => i.status === 'sent' || i.status === 'partial'
          ).length,
          paidInvoices: paidCount,
          overdueInvoices: filtered.filter((i) => i.status === 'overdue').length,
          avgOrderValue: avgVal,
        }));

        const months = eachMonthOfInterval({
          start: subMonths(now, 5),
          end: now,
        });

        const mRev = months.map((m) => {
          const mStr = format(m, 'MMM');
          const mYearKey = format(m, 'MMM yyyy');
          const revenue = invs
            .filter((i) => {
              const d = safeDate(i.createdAt);
              return d ? format(d, 'MMM yyyy') === mYearKey : false;
            })
            .filter((i) => i.status === 'paid' || i.status === 'partial')
            .reduce((sum, i) => sum + (i.paidAmount || 0), 0);
          return { name: mStr, revenue };
        });
        setMonthlyRevenue(mRev);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const prods = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        setProducts(prods);
        setStats((prev) => ({ ...prev, inventoryCount: snap.size }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const unsubRequests = onSnapshot(
      collection(db, 'requests'),
      (snap) => {
        setStats((prev) => ({
          ...prev,
          newRequests: snap.docs.filter((d) => d.data().status === 'new').length,
        }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'requests');
      }
    );

    const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(10));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'logs');
      }
    );

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubRequests();
      unsubLogs();
    };
  }, [filter, currentUserRole]);

  const topProducts = [...products]
    .sort((a, b) => (b.stock || 0) - (a.stock || 0))
    .slice(0, 4);

  const exportToCSV = (type: 'invoices' | 'revenue') => {
    let headers: string[] = [];
    let rows: any[] = [];
    const fileName = `waamikan_export_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    if (type === 'invoices') {
      headers = ['Invoice Number', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Date'];
      rows = invoices.map((i) => [
        i.invoiceNumber,
        `"${(i.customerName || '').replace(/"/g, '""')}"`,
        i.total || 0,
        i.paidAmount || 0,
        i.remainingBalance || 0,
        i.status,
        safeFormatDate(i.createdAt, 'yyyy-MM-dd'),
      ]);
    } else {
      headers = ['Date', 'Invoice', 'Customer', 'Amount Paid', 'Remaining'];
      rows = invoices
        .filter((i) => (i.paidAmount || 0) > 0)
        .map((i) => [
          safeFormatDate(i.createdAt, 'yyyy-MM-dd'),
          i.invoiceNumber,
          `"${(i.customerName || '').replace(/"/g, '""')}"`,
          i.paidAmount || 0,
          i.remainingBalance || 0,
        ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers.join(',') +
      '\n' +
      rows.map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cards = [
    {
      name: 'Total Revenue',
      value: `GHC ${stats.totalRevenue.toLocaleString()}`,
      icon: <TrendingUp className="text-green-600" />,
      trend: 'Collected',
      color: 'bg-green-50',
    },
    {
      name: 'Outstanding Payments',
      value: `GHC ${stats.outstandingPayments.toLocaleString()}`,
      icon: <Clock className="text-orange-600" />,
      trend: 'Receivable',
      color: 'bg-orange-50',
    },
    {
      name: 'Overdue Total',
      value: `GHC ${stats.overdueTotal.toLocaleString()}`,
      icon: <AlertCircle className="text-red-600" />,
      trend: `${stats.overdueInvoices} Overdue`,
      color: 'bg-red-50',
    },
    {
      name: 'Collection Rate',
      value: `${stats.paidVsUnpaid.toFixed(1)}%`,
      icon: <CheckCircle className="text-blue-600" />,
      trend: `${stats.paidInvoices} Paid`,
      color: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Stats Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm gap-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B3C5D]">Financial Analytics</h1>
          <p className="text-gray-400 text-sm">Enterprise-grade performance monitoring</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-gray-50 p-1 rounded-xl ring-1 ring-gray-100">
            {['all', 'daily', 'monthly'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  filter === f
                    ? 'bg-[#0B3C5D] text-white shadow-lg shadow-blue-900/20'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => exportToCSV('invoices')}
            className="flex items-center gap-2 px-5 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition-all border border-green-100 text-sm"
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
            transition={{ delay: idx * 0.08 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 ${card.color} rounded-2xl`}>{card.icon}</div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
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
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-gray-800">Revenue Velocity</h3>
            <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
              <Calendar size={14} /> Last 6 Months
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B3C5D" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#0B3C5D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '20px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0B3C5D"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-800 mb-6">System Pulse &amp; Activity</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {stats.modulePulse.map((m, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {m.name}
                  </span>
                  <span className="text-[10px] font-black text-green-500 uppercase">
                    {m.status}
                  </span>
                </div>
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${m.health}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Live Audit Trail
              </p>
              <Link
                to="/admin/logs"
                className="text-[10px] font-black text-[#1F7A8C] uppercase hover:underline"
              >
                All Logs →
              </Link>
            </div>
            {logs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-4 bg-gray-50/50 p-3 rounded-2xl hover:bg-gray-50 transition-all"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#0B3C5D] shrink-0">
                  {log.type === 'invoice' ? (
                    <FileText size={16} />
                  ) : log.type === 'payment' ? (
                    <CreditCard size={16} />
                  ) : log.type === 'crm' ? (
                    <Users size={16} />
                  ) : (
                    <Package size={16} />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-xs font-black text-gray-800 leading-tight truncate">
                    {log.action}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                    {log.userName} • {safeFormatDate(log.timestamp, 'p')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">Inventory Status</h3>
            <Link
              to="/admin/inventory"
              className="text-xs font-black text-[#1F7A8C] uppercase tracking-widest hover:underline"
            >
              Full Catalog →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-[2rem] border border-gray-100"
              >
                <div className="w-20 h-20 bg-white rounded-3xl overflow-hidden border border-gray-100 flex-shrink-0">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-grow overflow-hidden">
                  <p className="font-black text-[#0B3C5D] truncate uppercase tracking-tight">
                    {p.name}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {p.category}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-grow h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${p.stock < 10 ? 'bg-red-500' : 'bg-[#1F7A8C]'}`}
                        style={{ width: `${Math.min(((p.stock || 0) / 100) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-[#0B3C5D]">{p.stock} Units</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0B3C5D] rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
          <div className="relative z-10 space-y-6">
            <div className="p-4 bg-white/10 rounded-2xl w-fit">
              <Zap className="text-yellow-400" size={30} />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight leading-tight uppercase">
                Live Operations
              </h3>
              <p className="text-blue-100/60 text-sm font-medium mt-1">
                Real-time commercial metrics
              </p>
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-end border-b border-white/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                  Avg. Invoice Value
                </span>
                <span className="text-xl font-black">
                  GHC {Math.round(stats.avgOrderValue).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-end border-b border-white/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                  Pending Inquiries
                </span>
                <span className="text-xl font-black">{stats.newRequests} Open</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                  Catalog SKUs
                </span>
                <span className="text-xl font-black">{stats.inventoryCount} Products</span>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-700" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
