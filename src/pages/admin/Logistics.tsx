import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { SalesDocument } from '@/src/lib/salesService';
import { createWaybill, updateWaybillStatus } from '@/src/lib/logisticsService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { downloadDocument, printDocument } from '@/src/lib/documentService';
import {
  Truck,
  Navigation,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  Printer,
  Download,
} from 'lucide-react';

const Logistics = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [waybills, setWaybills] = useState<any[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<SalesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWaybillModal, setShowWaybillModal] = useState(false);
  const [selectedDN, setSelectedDN] = useState<string>('');
  const [destination, setDestination] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubWaybills = onSnapshot(
      query(collection(db, 'waybills'), orderBy('createdAt', 'desc')),
      (snap) => {
        setWaybills(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'waybills');
      }
    );

    const unsubDNs = onSnapshot(
      collection(db, 'sales_documents'),
      (snap) => {
        setDeliveryNotes(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as SalesDocument))
            .filter((d) => d.type === 'DeliveryNote' && d.status === 'Pending')
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'sales_documents')
    );

    return () => {
      unsubWaybills();
      unsubDNs();
    };
  }, [currentUserRole]);

  const handleCreateWaybill = async () => {
    if (!selectedDN) return;
    const dn = deliveryNotes.find((d) => d.id === selectedDN);
    if (!dn) return;

    setCreating(true);
    try {
      await createWaybill({
        deliveryNoteId: dn.id,
        deliveryNoteNumber: dn.docNumber,
        customerName: dn.customerName,
        destination: destination.trim() || 'Client Facility Address',
        driverName: driverName.trim(),
        vehicleNumber: vehicleNumber.trim(),
        items: dn.items || [],
        status: 'In Transit',
      });
      setShowWaybillModal(false);
      setSelectedDN('');
      setDestination('');
      setDriverName('');
      setVehicleNumber('');
    } catch (error) {
      console.error(error);
      alert('Failed to create waybill');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B3C5D] flex items-center gap-3">
            <Truck size={30} />
            Logistics &amp; Dispatch
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage shipments, waybills, and delivery tracking
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWaybillModal(true)}
          className="bg-[#0B3C5D] text-white px-6 py-3 rounded-xl hover:bg-[#1d4b6d] transition-all flex items-center gap-2 shadow-lg font-bold text-sm"
        >
          <Plus size={18} />
          Create New Waybill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Navigation size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">In Transit</p>
              <h4 className="text-2xl font-bold text-gray-800">
                {waybills.filter((w) => w.status === 'In Transit').length}
              </h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Delivered</p>
              <h4 className="text-2xl font-bold text-gray-800">
                {waybills.filter((w) => w.status === 'Delivered').length}
              </h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Delivery Notes</p>
              <h4 className="text-2xl font-bold text-gray-800">{deliveryNotes.length}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[680px]">
            <thead>
              <tr className="bg-[#0B3C5D] text-white">
                <th className="px-6 py-5 font-semibold text-sm">Waybill #</th>
                <th className="px-6 py-5 font-semibold text-sm">Delivery Note</th>
                <th className="px-6 py-5 font-semibold text-sm">Customer / Destination</th>
                <th className="px-6 py-5 font-semibold text-sm">Status</th>
                <th className="px-6 py-5 font-semibold text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Loading waybills...
                  </td>
                </tr>
              ) : waybills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No waybills recorded yet.
                  </td>
                </tr>
              ) : (
                waybills.map((waybill) => (
                  <tr key={waybill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5 font-bold text-gray-900">
                      {waybill.waybillNumber}
                    </td>
                    <td className="px-6 py-5 text-gray-600">{waybill.deliveryNoteNumber}</td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-gray-800">{waybill.customerName}</p>
                      <p className="text-xs text-gray-400">{waybill.destination}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          waybill.status === 'Delivered'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {waybill.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => printDocument('Waybill', waybill)}
                          className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:text-[#EAB308] transition-all"
                          title="Print Waybill"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDocument('Waybill', waybill)}
                          className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:text-[#0B3C5D] transition-all"
                          title="Download Waybill PDF"
                        >
                          <Download size={18} />
                        </button>
                        {waybill.status !== 'Delivered' && (
                          <button
                            type="button"
                            onClick={() => updateWaybillStatus(waybill.id, 'Delivered')}
                            className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
                            title="Mark as Delivered"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showWaybillModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-[#0B3C5D] mb-6">Create New Waybill</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Select Pending Delivery Note
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none"
                  value={selectedDN}
                  onChange={(e) => setSelectedDN(e.target.value)}
                >
                  <option value="">Choose a delivery note...</option>
                  {deliveryNotes.map((dn) => (
                    <option key={dn.id} value={dn.id}>
                      {dn.docNumber} - {dn.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Destination Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Korle Bu Teaching Hospital, Accra"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="Driver full name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Vehicle Registration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GR-4521-24"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0B3C5D] outline-none"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                  />
                </div>
              </div>

              {selectedDN && (
                <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-3 text-[#0B3C5D]">
                  <FileText size={20} />
                  <div className="text-sm">
                    <p className="font-bold">Dispatch Summary</p>
                    <p>
                      Customer: {deliveryNotes.find((d) => d.id === selectedDN)?.customerName}
                    </p>
                    <p>
                      Total Items:{' '}
                      {deliveryNotes.find((d) => d.id === selectedDN)?.items?.length || 0}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowWaybillModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateWaybill}
                  disabled={!selectedDN || creating}
                  className="flex-1 px-6 py-3 bg-[#0B3C5D] text-white rounded-xl hover:bg-[#1d4b6d] transition-all shadow-md font-semibold disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Confirm Shipment'}
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
