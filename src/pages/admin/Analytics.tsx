import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  collection, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Invoice, Product } from '@/src/types';
import { 
  TrendingUp, 
  Clock, 
  Package, 
  AlertCircle, 
  DollarSign, 
  ArrowUpRight,
  PieChart as PieIcon,
  LayoutDashboard,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';

const Analytics = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#0B3C5D', '#1F7A8C', '#EAB308', '#D1D5DB', '#F87171', '#34D399'];

  useEffect(() => {
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => {
      unsubInvoices();
      unsubProducts();
    };
  }, []);

  // Data Processing
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const outstandingPayments = invoices.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0);
  const activeProducts = products.filter(p => p.stock > 0).length;

  // Monthly Revenue Trends (Last 6 months)
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  });

  const revenueTrendData = last6Months.map(month => {
    const monthName = format(month, 'MMM');
    const monthlyInvoices = invoices.filter(inv => isSameMonth(new Date(inv.createdAt), month));
    
    return {
      name: monthName,
      revenue: monthlyInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
      potential: monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0),
      outstanding: monthlyInvoices.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0)
    };
  });

  // Category Distribution
  const categoryDataMap = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryDataMap).map(([name, value]) => ({ 
    name, 
    value: Number(value) 
  }));

  const kpis = [
    { 
      label: 'Total Revenue', 
      value: `GH₵ ${totalRevenue.toLocaleString()}`, 
      icon: <DollarSign size={24} />, 
      color: 'bg-green-100 text-green-700',
      description: 'Total actual cash received'
    },
    { 
      label: 'Outstanding', 
      value: `GH₵ ${outstandingPayments.toLocaleString()}`, 
      icon: <Clock size={24} />, 
      color: 'bg-orange-100 text-orange-700',
      description: 'Pending payments from clients'
    },
    { 
      label: 'Inventory Items', 
      value: products.length.toString(), 
      icon: <Package size={24} />, 
      color: 'bg-blue-100 text-blue-700',
      description: 'Total unique products tracked'
    },
    { 
      label: 'Active Stock', 
      value: activeProducts.toString(), 
      icon: <CheckCircle2 size={24} />, 
      color: 'bg-indigo-100 text-indigo-700',
      description: 'Products with stock level > 0'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3C5D]"></div>
      </div>
    );
  }

  const collectionRate = totalRevenue + outstandingPayments > 0 
    ? (totalRevenue / (totalRevenue + outstandingPayments)) * 100 
    : 0;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-[#0B3C5D] flex items-center gap-3">
              <TrendingUp />
              Business Intelligence
            </h1>
            <p className="text-gray-400 font-medium">Visualizing Waamikan's commercial performance</p>
          </div>
          <div className="bg-blue-50 px-6 py-3 rounded-2xl flex items-center gap-3">
            <LayoutDashboard className="text-[#0B3C5D]" size={20} />
            <span className="text-sm font-bold text-[#0B3C5D]">Last 6 Months Report</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className={`p-4 rounded-2xl ${kpi.color} w-fit mb-6 transition-transform group-hover:scale-110`}>
              {kpi.icon}
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
            <h3 className="text-3xl font-black text-[#0B3C5D]">{kpi.value}</h3>
            <p className="text-[10px] text-gray-400 mt-2 font-medium">{kpi.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Trends */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-black text-[#0B3C5D]">Revenue Trends</h3>
              <p className="text-sm text-gray-400">Cash Flow vs Scheduled Payments</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#0B3C5D] rounded-full" />
                <span className="text-xs font-bold text-gray-400">Actual Cash</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#1F7A8C] rounded-full opacity-40" />
                <span className="text-xs font-bold text-gray-400">Outstanding</span>
              </div>
            </div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B3C5D" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0B3C5D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#9CA3AF' }}
                  tickFormatter={(val) => `GH₵${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '20px'
                  }}
                  itemStyle={{ fontWeight: 800, color: '#0B3C5D' }}
                  labelStyle={{ marginBottom: '8px', color: '#9CA3AF', fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#0B3C5D" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  name="Paid Revenue"
                />
                <Area 
                  type="monotone" 
                  dataKey="outstanding" 
                  stroke="#1F7A8C" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent" 
                  name="Outstanding"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col">
          <div className="mb-10 text-center">
            <h3 className="text-xl font-black text-[#0B3C5D]">Inventory Mix</h3>
            <p className="text-sm text-gray-400">Products by Category</p>
          </div>
          
          <div className="h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-black text-[#0B3C5D]">{products.length}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total SKUs</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-bold text-gray-600">{entry.name}</span>
                </div>
                <span className="text-xs font-black text-[#0B3C5D]">
                  {products.length > 0 ? Math.round((entry.value / products.length) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
              <AlertCircle size={20} />
            </div>
            <h4 className="font-black text-[#0B3C5D]">Collection Efficiency</h4>
          </div>
          <div className="flex items-end gap-6">
            <div className="flex-grow">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-400">Total Billed VS Total Collected</span>
                <span className="text-xs font-black text-[#0B3C5D]">
                  {collectionRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-lg overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${collectionRate}%` }}
                  className="h-full bg-green-500"
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Cash Gap</p>
              <p className="text-xl font-black text-red-500">GH₵{outstandingPayments.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#0B3C5D] p-8 rounded-[3rem] text-white flex items-center justify-between overflow-hidden relative group">
          <div className="relative z-10">
            <h4 className="text-2xl font-black mb-2 italic">Ready for growth?</h4>
            <p className="text-blue-200 text-sm max-w-[240px]">Explore sales forecasts and inventory planning tools.</p>
            <button className="mt-6 bg-[#EAB308] text-[#0B3C5D] px-8 py-3 rounded-xl font-black flex items-center gap-2 hover:scale-105 transition-all">
              Launch Forecasting
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 scale-150 rotate-12 transition-transform group-hover:rotate-0">
             <PieIcon size={200} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
