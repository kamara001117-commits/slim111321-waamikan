import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { Product } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { ShoppingCart, Search, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/src/lib/CartContext';

const Products = () => {
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const qParam = searchParams.get('search') || '';
    setSearchTerm(qParam);
  }, [searchParams]);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    );
  }, []);

  const categories = [
    'All',
    'Consumables',
    'Equipment',
    'Furniture',
    'Imaging',
    'IVD',
    'Treatment',
    'Life Support',
  ];

  const filtered = products.filter((p) => {
    const matchesCat = category === 'All' || p.category === category;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name?.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim()) {
      setSearchParams({ search: val }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-24">
      {/* Search/Filter Header */}
      <section className="bg-white border-b border-gray-100 py-8 sm:py-10 px-4 sticky top-20 z-40 bg-opacity-95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl sm:text-4xl font-black text-[#0B3C5D]">Medical Supplies</h1>
            <div className="relative w-full md:w-80">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search equipment or SKU..."
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1F7A8C]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all ${
                  category === c
                    ? 'bg-[#0B3C5D] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-80 bg-gray-200 animate-pulse rounded-[40px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filtered.map((prod, idx) => (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                onClick={() => setSelectedProduct(prod)}
                className="bg-white rounded-[2.2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all group border border-gray-100 flex flex-col cursor-pointer"
              >
                <div className="relative h-56 sm:h-64 bg-gray-50 overflow-hidden">
                  <img
                    src={
                      prod.image ||
                      'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=600'
                    }
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    alt={prod.name}
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm px-4 py-1 rounded-full text-[10px] font-black uppercase text-[#0B3C5D]">
                      {prod.category}
                    </span>
                  </div>
                </div>
                <div className="p-6 sm:p-8 flex-grow space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-bold text-[#0B3C5D] group-hover:text-[#1F7A8C] transition-colors">
                      {prod.name}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
                      {prod.description}
                    </p>
                  </div>
                  <div className="pt-4 flex justify-between items-center border-t border-gray-50">
                    <p className="text-xl font-black text-[#EAB308]">
                      GHC {(prod.price || 0).toLocaleString()}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(prod);
                        setAddedMessage(`${prod.name} added to cart`);
                        setTimeout(() => setAddedMessage(null), 2000);
                      }}
                      className="bg-[#0B3C5D] text-white p-3 rounded-2xl hover:bg-[#1F7A8C] transition-all"
                    >
                      <ShoppingCart size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <h3 className="text-2xl font-bold text-gray-400">
              No products match your selection.
            </h3>
            <p className="text-gray-500">
              Try clearing the search filter or contact us for custom institutional procurement.
            </p>
          </div>
        )}
      </section>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-10 bg-gray-100 text-gray-600 p-2 rounded-full hover:bg-[#EAB308] hover:text-[#0B3C5D] transition-all"
              >
                <X size={22} />
              </button>

              <div className="w-full md:w-1/2 h-72 md:h-auto bg-gray-100 shrink-0">
                <img
                  src={
                    selectedProduct.image ||
                    'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800'
                  }
                  className="w-full h-full object-cover"
                  alt={selectedProduct.name}
                />
              </div>

              <div className="flex-grow p-6 md:p-10 space-y-6 flex flex-col justify-center">
                <div>
                  <span className="px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">
                    {selectedProduct.category}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#0B3C5D] leading-tight mb-3">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-gray-500 leading-relaxed text-base">
                    {selectedProduct.description}
                  </p>

                  {selectedProduct.specs && (
                    <div className="mt-5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-[#1F7A8C] uppercase tracking-widest mb-2">
                        Technical Specifications
                      </p>
                      <div className="grid grid-cols-1 gap-1">
                        {selectedProduct.specs.split(';').map((spec, i) => (
                          <p key={i} className="text-sm text-gray-600 flex items-center gap-2">
                            <span className="w-1 h-1 bg-[#1F7A8C] rounded-full" />
                            {spec.trim()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">SKU</p>
                    <p className="font-mono text-sm font-bold text-[#0B3C5D]">
                      {selectedProduct.sku}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Availability</p>
                    <p
                      className={`text-sm font-bold ${
                        selectedProduct.stock > 0 ? 'text-green-600' : 'text-amber-600'
                      }`}
                    >
                      {selectedProduct.stock > 0 ? 'In Stock' : 'Pre-order / Request'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Unit Price</p>
                    <p className="text-2xl sm:text-3xl font-black text-[#EAB308]">
                      GHC {(selectedProduct.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addToCart(selectedProduct);
                      setAddedMessage(`${selectedProduct.name} added to cart`);
                      setTimeout(() => setAddedMessage(null), 2000);
                    }}
                    className="flex-grow md:flex-grow-0 bg-[#0B3C5D] text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#1F7A8C] transition-all shadow-xl shadow-blue-900/20"
                  >
                    <ShoppingCart size={20} />
                    Add to Cart
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Added Notification */}
      <AnimatePresence>
        {addedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-[#0B3C5D] text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 border border-blue-400/20"
          >
            <CheckCircle2 size={22} className="text-green-400 shrink-0" />
            <span className="font-bold text-sm">{addedMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Products;
