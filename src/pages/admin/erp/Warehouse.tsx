import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { InventoryLocation, InventoryMovement } from '@/src/types/erp';
import { Product } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeFormatDate } from '@/src/lib/dateUtils';
import { printStockReport } from '@/src/lib/documentService';
import {
  Layers,
  MapPin,
  ArrowRightLeft,
  ShieldAlert,
  Plus,
  Search,
  Box,
  ChevronRight,
  TrendingUp,
  Tag,
  X,
  Printer,
} from 'lucide-react';
import { createInventoryLocation, recordInternalTransfer } from '@/src/lib/inventoryService';

const Warehouse = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', code: '', type: 'Main' });
  const [transfer, setTransfer] = useState({ productId: '', fromLoc: '', toLoc: '', quantity: 0 });

  const handleCreateLocation = async () => {
    if (!newLocation.name.trim()) return;
    await createInventoryLocation({
      name: newLocation.name.trim(),
      code: newLocation.code.trim(),
      type: newLocation.type,
    });
    setShowLocationModal(false);
    setNewLocation({ name: '', code: '', type: 'Main' });
  };

  const handleTransfer = async () => {
    const qty = Number(transfer.quantity) || 0;
    if (!transfer.productId || !transfer.fromLoc || !transfer.toLoc || qty <= 0) return;
    await recordInternalTransfer({
      ...transfer,
      quantity: qty,
    });
    setShowTransferModal(false);
    setTransfer({ productId: '', fromLoc: '', toLoc: '', quantity: 0 });
  };

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubLocations = onSnapshot(
      collection(db, 'inventory_locations'),
      (snap) => {
        setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryLocation)));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'inventory_locations');
      }
    );

    const unsubMovements = onSnapshot(
      query(collection(db, 'inventory_movements'), orderBy('date', 'desc')),
      (snap) => {
        setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryMovement)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventory_movements')
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    return () => {
      unsubLocations();
      unsubMovements();
      unsubProducts();
    };
  }, [currentUserRole]);

  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[#0B3C5D]">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
            WAREHOUSE &amp; LOGISTICS
          </h2>
          <p className="text-sm font-medium text-gray-400 italic">
            Multi-location stock management and batch tracking
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => printStockReport(products)}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border border-gray-200 text-[#0B3C5D] rounded-2xl font-black shadow-sm hover:bg-gray-50 transition-all text-xs uppercase tracking-widest"
          >
            <Printer size={18} />
            PRINT STOCK
          </button>
          <button
            type="button"
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
          >
            <ArrowRightLeft size={18} />
            INTERNAL TRANSFER
          </button>
          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-[#EAB308] text-[#0B3C5D] rounded-2xl font-black shadow-lg shadow-yellow-200/50 hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
          >
            <Plus size={18} />
            NEW LOCATION
          </button>
        </div>
      </div>

      {/* Modals */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLocationModal(false)}
          />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-[#0B3C5D]">NEW LOCATION</h3>
              <button type="button" onClick={() => setShowLocationModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Location Name"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
              />
              <input
                placeholder="Short Code (e.g. WH-01)"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                value={newLocation.code}
                onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value })}
              />
              <select
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                value={newLocation.type}
                onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
              >
                <option value="Main">Main Warehouse</option>
                <option value="Shelf">Storage Shelf</option>
                <option value="Cold">Cold Storage</option>
                <option value="Virtual">Virtual / Transit</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreateLocation}
              className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl uppercase tracking-widest text-xs"
            >
              Register Location
            </button>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowTransferModal(false)}
          />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-[#0B3C5D]">INTERNAL TRANSFER</h3>
              <button type="button" onClick={() => setShowTransferModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <select
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                value={transfer.productId}
                onChange={(e) => setTransfer({ ...transfer, productId: e.target.value })}
              >
                <option value="">Select Item</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stock} in stock)
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <select
                  className="w-full px-4 py-4 bg-gray-50 rounded-2xl outline-none"
                  value={transfer.fromLoc}
                  onChange={(e) => setTransfer({ ...transfer, fromLoc: e.target.value })}
                >
                  <option value="">From Loc</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full px-4 py-4 bg-gray-50 rounded-2xl outline-none"
                  value={transfer.toLoc}
                  onChange={(e) => setTransfer({ ...transfer, toLoc: e.target.value })}
                >
                  <option value="">To Loc</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                min={1}
                placeholder="Quantity"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                value={transfer.quantity || ''}
                onChange={(e) => setTransfer({ ...transfer, quantity: Number(e.target.value) })}
              />
            </div>
            <button
              type="button"
              onClick={handleTransfer}
              className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl uppercase tracking-widest text-xs"
            >
              Execute Movement
            </button>
          </div>
        </div>
      )}

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {locations.map((location) => (
          <div
            key={location.id}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
          >
            <div className="flex justify-between items-start mb-10 relative z-10">
              <div className="p-4 bg-gray-50 rounded-2xl text-[#0B3C5D]">
                <MapPin size={24} />
              </div>
              <span className="text-[10px] font-black text-[#1F7A8C] bg-cyan-50 px-3 py-1 rounded-full uppercase tracking-widest border border-cyan-100">
                {location.code || 'WH'}
              </span>
            </div>
            <div className="space-y-1 relative z-10">
              <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">
                {location.name}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {location.type}
              </p>
              <div className="pt-6 flex justify-between items-center">
                <p className="text-sm font-black text-gray-800">ACTIVE</p>
                <span className="text-gray-300 group-hover:text-[#EAB308] transition-colors">
                  <ChevronRight size={24} />
                </span>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
          </div>
        ))}
        {!loading && locations.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 font-medium text-center px-4">
            <Layers size={48} className="mb-4 opacity-20" />
            <p>No storage locations defined. Standardize your logistic map.</p>
          </div>
        )}
      </div>

      {/* Stocks and Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
        {/* Live Stock List */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 sm:p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0B3C5D] text-white rounded-lg">
                <Box size={18} />
              </div>
              <h3 className="text-sm font-black text-[#0B3C5D] uppercase tracking-widest">
                Consolidated Stock
              </h3>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 w-full sm:w-56">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search stock..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none w-full"
              />
            </div>
          </div>
          <div className="flex-grow overflow-y-auto max-h-[600px]">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="p-6 border-b border-gray-50 last:border-0 flex justify-between items-center hover:bg-gray-50/30 transition-colors gap-4"
              >
                <div className="min-w-0">
                  <p className="font-black text-gray-800 uppercase tracking-tight truncate">
                    {product.name}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                    {product.category} • SKU: {product.sku}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-xl font-black ${
                      product.stock < 10 ? 'text-red-500' : 'text-[#0B3C5D]'
                    }`}
                  >
                    {product.stock}{' '}
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black ml-1">
                      Units
                    </span>
                  </p>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="py-16 text-center text-gray-400 italic text-sm">
                No products match your search.
              </div>
            )}
          </div>
        </div>

        {/* Stock Movements */}
        <div className="bg-[#0B3C5D] rounded-[2.5rem] shadow-xl text-white overflow-hidden flex flex-col">
          <div className="p-6 sm:p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 text-white rounded-lg">
                <TrendingUp size={18} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest">Stock Movement Log</h3>
            </div>
            <span className="text-[10px] font-black bg-orange-400 text-white px-3 py-1 rounded-full uppercase tracking-widest">
              Real-time
            </span>
          </div>
          <div className="flex-grow overflow-y-auto max-h-[600px] p-6 sm:p-8 space-y-6">
            {movements.map((move) => (
              <div key={move.id} className="flex gap-4 items-start group">
                <div className="mt-1">
                  {move.type === 'Transfer' ? (
                    <ArrowRightLeft size={16} className="text-blue-300" />
                  ) : (
                    <ShieldAlert size={16} className="text-red-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">
                    {move.type} of {move.quantity} Units
                  </p>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-relaxed">
                    {move.reason} • {safeFormatDate(move.date, 'MMM dd, HH:mm')}
                  </p>
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-white/40 italic text-sm">
                <Tag size={48} className="mb-4 opacity-10" />
                <p>No logged movements found in global stack.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Warehouse;
