import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Product } from '@/src/types';
import { ShoppingCart, Search, Filter, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/src/lib/CartContext';

const Products = () => {
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({id: d.id, ...d.data()}) as Product));
      setLoading(false);
    });
  }, []);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categories = ['All', 'Consumables', 'Furniture', 'Imaging', 'IVD', 'Treatment', 'Life Support'];
  const filtered = products.filter(p => category === 'All' || p.category === category);

  return (
    <div className="bg-[#F7FAFC] min-h-screen pb-24">
      {/* Search/Filter Header */}
      <section className="bg-white border-b border-gray-100 py-12 px-4 sticky top-20 z-40 bg-opacity-95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
           <h1 className="text-4xl font-black text-[#0B3C5D]">Medical Supplies</h1>
           <div className="flex gap-4 overflow-x-auto pb-2 w-full md:w-auto">
             {categories.map(c => (
               <button 
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-6 py-2 rounded-full font-bold text-sm transition-all ${
                  category === c ? 'bg-[#0B3C5D] text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-80 bg-gray-200 animate-pulse rounded-[40px]"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {filtered.map((prod, idx) => (
              <motion.div 
                key={prod.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedProduct(prod)}
                className="bg-white rounded-[40px] overflow-hidden shadow-sm hover:shadow-2xl transition-all group border border-gray-100 flex flex-col cursor-pointer"
              >
                <div className="relative h-64 bg-gray-50 overflow-hidden">
                  <img 
                    src={prod.image || `https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=600`} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    alt={prod.name}
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm px-4 py-1 rounded-full text-[10px] font-black uppercase text-[#0B3C5D]">
                      {prod.category}
                    </span>
                  </div>
                </div>
                <div className="p-8 flex-grow space-y-4">
                   <h3 className="text-xl font-bold text-[#0B3C5D] group-hover:text-[#1F7A8C] transition-colors">{prod.name}</h3>
                   <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">{prod.description}</p>
                   <div className="pt-4 flex justify-between items-center border-t border-gray-50">
                     <p className="text-xl font-black text-[#EAB308]">GH₵ {prod.price.toLocaleString()}</p>
                     <button 
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
          <div className="text-center py-24 space-y-6">
            <div className="text-6xl text-gray-200">🏥</div>
            <h3 className="text-2xl font-bold text-gray-400">No products in this category yet.</h3>
            <p className="text-gray-500">Check back soon or contact us for custom orders.</p>
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
              className="relative bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 z-10 bg-white/20 backdrop-blur-sm text-white md:bg-gray-100 md:text-gray-500 p-2 rounded-full hover:bg-[#EAB308] hover:text-[#0B3C5D] transition-all"
              >
                <X size={24} />
              </button>

              <div className="w-full md:w-1/2 h-80 md:h-auto bg-gray-100">
                <img 
                  src={selectedProduct.image || `https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800`} 
                  className="w-full h-full object-cover"
                  alt={selectedProduct.name}
                />
              </div>

              <div className="flex-grow p-8 md:p-12 space-y-8 flex flex-col justify-center">
                <div>
                  <span className="px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">
                    {selectedProduct.category}
                  </span>
                  <h2 className="text-4xl font-black text-[#0B3C5D] leading-tight mb-4">{selectedProduct.name}</h2>
                  <p className="text-gray-500 leading-relaxed text-lg">{selectedProduct.description}</p>
                  
                  {selectedProduct.specs && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-[#1F7A8C] uppercase tracking-widest mb-2">Technical Specifications</p>
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
                    <p className="font-mono text-sm font-bold text-[#0B3C5D]">{selectedProduct.sku}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Availability</p>
                    <p className="text-sm font-bold text-green-600">{selectedProduct.stock > 0 ? 'In Stock' : 'Out of Stock'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 pt-8">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Unit Price</p>
                    <p className="text-3xl font-black text-[#EAB308]">GH₵ {selectedProduct.price.toLocaleString()}</p>
                  </div>
                  <button 
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
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-[#0B3C5D] text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-blue-400/20"
          >
            <CheckCircle2 size={24} className="text-green-400" />
            <span className="font-bold">{addedMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Products;
