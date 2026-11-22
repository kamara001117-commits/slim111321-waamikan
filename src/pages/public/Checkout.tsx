import React, { useState, useEffect } from 'react';
import { useCart } from '@/src/lib/CartContext';
import { useAuth } from '@/src/lib/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Truck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';

const Checkout = () => {
  const { user } = useAuth();
  const { cart, cartTotal, clearCart } = useCart();
  const [step, setStep] = useState<'info' | 'payment'>('info');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    hospital: '',
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.displayName || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStep('payment');
  };

  const processOrder = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const subtotal = Number(cartTotal.toFixed(2));
      const vat = Number((subtotal * 0.05).toFixed(2));
      const total = Number((subtotal + vat).toFixed(2));
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomSuffix}`;
      const now = new Date().toISOString();

      await addDoc(collection(db, 'web_orders'), {
        orderNumber,
        userId: user?.uid || null,
        customerName: (formData.hospital || formData.name).trim(),
        contactName: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        })),
        subtotal,
        vat,
        total,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      setOrderSuccess(orderNumber);
      clearCart();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'web_orders');
      setErrorMsg('Unable to submit your order right now. Please verify your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-2xl border border-gray-100 max-w-xl w-full text-center space-y-8"
        >
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50/50">
            <CheckCircle2 size={64} />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0B3C5D]">Order Submitted!</h2>
            <p className="text-gray-500 mt-4 text-base sm:text-lg leading-relaxed">
              Your supply request <span className="text-[#0B3C5D] font-bold">#{orderSuccess}</span>{' '}
              has been received. Our procurement team will review and issue your official invoice
              shortly.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user && (
              <Link
                to="/orders"
                className="bg-[#1F7A8C] text-white px-8 py-4 rounded-2xl font-black hover:bg-[#0B3C5D] transition-all"
              >
                Track My Orders
              </Link>
            )}
            <Link
              to="/products"
              className="bg-[#0B3C5D] text-white px-8 py-4 rounded-2xl font-black hover:bg-[#1F7A8C] transition-all"
            >
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (cart.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* Left Side: Checkout Form */}
        <div className="space-y-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0B3C5D]">Checkout</h1>
            <p className="text-gray-400 mt-2">Complete your supply request details</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-4">
            <div
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                step === 'info' ? 'bg-[#0B3C5D] text-white' : 'bg-green-100 text-green-700'
              }`}
            >
              1. Information
            </div>
            <ChevronRight size={16} className="text-gray-300" />
            <div
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                step === 'payment' ? 'bg-[#0B3C5D] text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              2. Confirmation
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'info' ? (
              <motion.form
                key="info-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleInfoSubmit}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Phone Number
                    </label>
                    <input
                      required
                      type="tel"
                      className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Facility / Hospital Name
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.hospital}
                      onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Delivery Address
                    </label>
                    <textarea
                      required
                      rows={3}
                      className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#0B3C5D] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#1F7A8C] transition-all shadow-xl shadow-blue-900/10"
                >
                  Continue to Confirmation
                  <ChevronRight size={20} />
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="payment-info"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                  <div className="flex items-center gap-3 text-[#0B3C5D]">
                    <ShieldCheck size={24} />
                    <h3 className="font-bold">Institutional Payment Policy</h3>
                  </div>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Submitting this order sends it directly to our procurement desk. An official
                    tax invoice will be generated for payment via Bank Transfer, Cheque, or Mobile
                    Money upon delivery or per your institutional credit terms.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-[#0B3C5D]">Select Payment Preference</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 border-2 border-[#0B3C5D] bg-[#0B3C5D]/5 rounded-2xl flex items-center gap-4">
                      <CreditCard className="text-[#0B3C5D]" />
                      <div>
                        <p className="font-black text-[#0B3C5D]">Pay on Delivery / Invoice</p>
                        <p className="text-xs text-gray-500 font-bold">
                          Cheque, Bank Transfer, or MoMo
                        </p>
                      </div>
                    </div>
                    <div className="p-6 border border-gray-100 bg-gray-50 rounded-2xl flex items-center gap-4 opacity-50 cursor-not-allowed">
                      <div className="w-6 h-6 rounded-full border border-gray-300" />
                      <div>
                        <p className="font-black text-gray-400">Online Card Gateway</p>
                        <p className="text-xs text-gray-400">Coming Soon</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep('info')}
                    className="flex-grow md:flex-grow-0 px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={processOrder}
                    disabled={loading}
                    className="flex-grow bg-[#0B3C5D] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#1F7A8C] transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <ShoppingBag size={20} />}
                    {loading ? 'Submitting Order...' : 'Place Order'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Order Summary */}
        <div className="lg:sticky lg:top-32 h-fit space-y-8">
          <div className="bg-white p-6 sm:p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-[#0B3C5D]">Order Summary</h3>

            <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={
                        item.image ||
                        'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=200'
                      }
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-[#0B3C5D] text-sm leading-tight truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-black text-[#0B3C5D] text-sm whitespace-nowrap">
                    GHC {(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-50 space-y-3">
              <div className="flex justify-between text-sm text-gray-400 font-bold uppercase tracking-widest">
                <span>Subtotal</span>
                <span>GHC {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400 font-bold uppercase tracking-widest">
                <span>VAT (5%)</span>
                <span>GHC {(cartTotal * 0.05).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-4 border-t border-gray-100">
                <span className="text-lg font-black text-[#0B3C5D]">Total</span>
                <span className="text-2xl font-black text-[#EAB308]">
                  GHC {(cartTotal * 1.05).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-2">
            <div className="flex items-center gap-4 text-gray-500">
              <Truck size={20} />
              <span className="text-sm font-bold uppercase tracking-widest">
                Estimated Delivery: 2-3 Days
              </span>
            </div>
            <div className="flex items-center gap-4 text-gray-500">
              <MapPin size={20} />
              <span className="text-sm font-bold uppercase tracking-widest">
                Dispatched from Oyibi, Accra
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
