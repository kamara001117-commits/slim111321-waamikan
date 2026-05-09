import React from 'react';
import { useCart } from '@/src/lib/CartContext';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 px-4">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
          <ShoppingBag size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-[#0B3C5D]">Your cart is empty</h2>
          <p className="text-gray-400 mt-2">Looks like you haven't added anything yet.</p>
        </div>
        <Link 
          to="/products" 
          className="bg-[#0B3C5D] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all"
        >
          Browse Products
          <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-[#0B3C5D]">Your Shopping Cart</h1>
        <p className="text-gray-400 font-medium">You have {cartCount} items in your selection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-6 group hover:shadow-md transition-shadow"
              >
                <div className="w-24 h-24 bg-gray-50 rounded-2xl overflow-hidden shrink-0">
                  <img 
                    src={item.image || `https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=200`} 
                    className="w-full h-full object-cover"
                    alt={item.name}
                  />
                </div>
                
                <div className="flex-grow text-center sm:text-left">
                  <span className="text-[10px] font-black text-[#1F7A8C] uppercase tracking-widest">{item.category}</span>
                  <h3 className="text-lg font-bold text-[#0B3C5D] mt-1">{item.name}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-1 uppercase">SKU: {item.sku}</p>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 text-gray-400 hover:text-[#0B3C5D] transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="w-8 text-center font-bold text-[#0B3C5D]">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 text-gray-400 hover:text-[#0B3C5D] transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <div className="text-center sm:text-right min-w-[120px]">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Price</p>
                  <p className="text-lg font-black text-[#EAB308]">GH₵ {(item.price * item.quantity).toLocaleString()}</p>
                </div>

                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0B3C5D] p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-900/20">
            <h3 className="text-xl font-bold mb-8">Summary</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-blue-100">
                <span>Subtotal</span>
                <span className="font-bold">GH₵ {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-blue-100">
                <span>Tax (Est.)</span>
                <span className="font-bold">GH₵ 0.00</span>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <span className="text-lg">Total</span>
                <span className="text-3xl font-black text-[#EAB308]">GH₵ {cartTotal.toLocaleString()}</span>
              </div>
            </div>

            <Link 
              to="/checkout"
              className="w-full bg-[#EAB308] text-[#0B3C5D] py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-lg active:scale-95"
            >
              Checkout
              <ArrowRight size={20} />
            </Link>

            <p className="text-[10px] text-blue-200/50 text-center mt-6 uppercase font-bold tracking-widest">
              Secure Checkout Powered by Waamikan
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 italic transition-transform hover:-rotate-1">
             <p className="text-gray-400 text-sm leading-relaxed">
               "Need a formal proforma invoice for your institution? Our team can generate one instantly after checkout."
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
