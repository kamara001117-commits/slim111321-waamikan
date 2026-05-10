import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { SalesDocument } from '@/src/lib/salesService';
import { createWaybill, updateWaybillStatus } from '@/src/lib/logisticsService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { 
  Truck, 
  Package, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Clock, 
  Plus,
  ArrowRight,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

const Logistics = () => {
  const [waybills, setWaybills] = useState<any[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<SalesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWaybillModal, setShowWaybillModal] = useState(false);
  const [selectedDN, setSelectedDN] = useState<string>('');

  useEffect(() => {
    const unsubWaybills = onSnapshot(
      query(collection(db, 'waybills'), orderBy('createdAt', 'desc')), 
      (snap) => {
        setWaybills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'waybills')
    );

    const unsubDNs = onSnapshot(
      collection(db, 'sales_documents'), 
      (snap) => {
        setDeliveryNotes(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SalesDocument))
          .filter(d => d.type === 'DeliveryNote' && d.status === 'Pending')
        );
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales_documents')
    );

    return () => {
       unsubWaybills();
       unsubDNs();
    }
  }, []);

  const handleCreateWaybill = async () => {
    if (!selectedDN) return;
    const dn = deliveryNotes.find(d => d.id === selectedDN);
    if (!dn) return;

    try {
      await createWaybill({
        deliveryNoteId: dn.id,
        deliveryNoteNumber: dn.docNumber,
        customerName: dn.customerName,
        destination: 'Customer Address', // In real app, pull from customer doc
        items: dn.items,
        status: 'In Transit'
      });
      setShowWaybillModal(false);
      setSelectedDN('');
    } catch (error) {
      console.error(error);
      alert("Failed to create waybill");
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0B3C5D] flex items-center gap-3">
            <Truck size={32} />
            Logistics & Warehousing
          </h1>
          <p className="text-gray-500 mt-1">Manage shipments, deliveries, and transport tracking</p>
        </div>
        <button 
          onClick={() => setShowWaybillModal(true)}
          className="bg-[#0B3C5D] text-white px-6 py-3 rounded-xl hover:bg-[#1d4b6d] transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus size={20} />
          Create New Waybill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Navigation size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">In Transit</p>
              <h4 className="text-2xl font-bold text-gray-800">{waybills.filter(w => w.status === 'In Transit').length}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Delivered</p>
              <h4 className="text-2xl font-bold text-gray-800">{waybills.filter(w => w.status === 'Delivered').length}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Delivery</p>
              <h4 className="text-2xl font-bold text-gray-800">{deliveryNotes.length}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 overflow-hidden border border-gray-100">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#0B3C5D] text-white">
              <th className="px-8 py-6 font-semibold">Waybill #</th>
              <th className="px-8 py-6 font-semibold">Delivery Note</th>
              <th className="px-8 py-6 font-semibold">Customer</th>
              <th className="px-8 py-6 font-semibold">Status</th>
              <th className="px-8 py-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {waybills.map((waybill) => (
              <tr key={waybill.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-6 font-bold text-gray-900">{waybill.waybillNumber}</td>
                <td className="px-8 py-6 text-gray-600">{waybill.deliveryNoteNumber}</td>
                <td className="px-8 py-6 text-gray-600">{waybill.customerName}</td>
                <td className="px-8 py-6">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    waybill.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {waybill.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  {waybill.status !== 'Delivered' && (
                    <button 
                      onClick={() => updateWaybillStatus(waybill.id, 'Delivered')}
                      className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
                      title="Mark as Delivered"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showWaybillModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
            <h2 className="text-2xl font-bold text-[#0B3C5D] mb-6">Create New Waybill</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Select Delivery Note</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] focus:border-transparent outline-none transition-all"
                  value={selectedDN}
                  onChange={(e) => setSelectedDN(e.target.value)}
                >
                  <option value="">Choose a delivery note...</option>
                  {deliveryNotes.map(dn => (
                    <option key={dn.id} value={dn.id}>{dn.docNumber} - {dn.customerName}</option>
                  ))}
                </select>
              </div>

              {selectedDN && (
                <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-3 text-[#0B3C5D]">
                   <FileText size={20} />
                   <div className="text-sm">
                      <p className="font-bold">Summary</p>
                      <p>Customer: {deliveryNotes.find(d => d.id === selectedDN)?.customerName}</p>
                      <p>Total Items: {deliveryNotes.find(d => d.id === selectedDN)?.items.length}</p>
                   </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowWaybillModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateWaybill}
                  disabled={!selectedDN}
                  className="flex-1 px-6 py-3 bg-[#0B3C5D] text-white rounded-xl hover:bg-[#1d4b6d] transition-all shadow-md font-semibold disabled:opacity-50"
                >
                  Confirm Shipment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logistics;
