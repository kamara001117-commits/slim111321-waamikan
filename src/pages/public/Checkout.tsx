import React, { useState, useEffect } from 'react';
import { useCart } from '@/src/lib/CartContext';
import { auth, db } from '@/src/lib/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, increment } from 'firebase/firestore';
import { Invoice, Product, Customer } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, CreditCard, ChevronRight, CheckCircle2, ShieldCheck, MapPin, Truck, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { generateAndUploadInvoicePDF } from '@/src/lib/documentService';
import { logActivity } from '@/src/lib/activity';

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();
  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<'info' | 'payment' | 'confirm'>('info');
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    hospital: '',
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setFormData(prev => ({
          ...prev,
          name: u.displayName || '',
          email: u.email || '',
        }));
      }
    });
    return unsub;
  }, []);

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const processOrder = async () => {
    setLoading(true);
    try {
      // 1. Get or Create Customer Profile
      let customerId = '';
      const customerQuery = query(collection(db, 'customers'), where('email', '==', formData.email));
      const customerSnap = await getDocs(customerQuery);
      
      if (!customerSnap.empty) {
        customerId = customerSnap.docs[0].id;
      } else {
        const newCustomer: Omit<Customer, 'id'> = {
          name: formData.hospital || formData.name,
          contactPerson: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          type: 'private',
          totalSpent: 0,
          invoiceCount: 0,
          createdAt: new Date().toISOString(),
        };
        const customerRef = await addDoc(collection(db, 'customers'), newCustomer);
        customerId = customerRef.id;
      }

      // 2. Prepare Invoice Data
      const invoiceNumber = `WAAM-WEB-${Date.now().toString().slice(-6)}`;
      const subtotal = cartTotal;
      const vat = subtotal * 0.05;
      const total = subtotal + vat;

      const invoiceData: Omit<Invoice, 'id'> = {
        invoiceNumber,
        customerId,
        customerName: formData.hospital || formData.name,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity
        })),
        subtotal,
        vat,
        total,
        paidAmount: 0,
        remainingBalance: total,
        status: 'sent',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user?.uid || null
      };

      // 3. Create Invoice
      const invoiceRef = await addDoc(collection(db, 'invoices'), invoiceData);
      const docId = invoiceRef.id;
      
      // 4. Update Inventory & Customer Stats
      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        await updateDoc(productRef, {
          stock: increment(-item.quantity)
        });
      }

      await updateDoc(doc(db, 'customers', customerId), {
        invoiceCount: increment(1)
      });

      // 5. Generate PDF (Simulated/Background)
      const finalInvoice = { id: docId, ...invoiceData } as Invoice;
      const pdfUrl = await generateAndUploadInvoicePDF(finalInvoice);
      await updateDoc(doc(db, 'invoices', docId), { pdfUrl });

      await logActivity('invoice', `Web Order ${invoiceNumber} created`, docId, `By: ${formData.email}`);

      // SUCCESS
      setOrderSuccess(invoiceNumber);
      clearCart();
    } catch (error) {
      console.error("Order processing failed:", error);
      alert("Something went wrong. Please try again.");
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
          className="bg-white p-12 rounded-[3rem] shadow-2xl border border-gray-100 max-w-xl w-full text-center space-y-8"
        >
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50/50">
            <CheckCircle2 size={64} />
          </div>
          <div>
            <h2 className="text-4xl font-black text-[#0B3C5D]">Order Placed!</h2>
            <p className="text-gray-400 mt-4 text-lg">
              Your order <span className="text-[#0B3C5D] font-bold">#{orderSuccess}</span> has been confirmed. 
              Our team will contact you shortly for delivery arrangements.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Link to="/products" className="bg-[#0B3C5D] text-white py-4 rounded-2xl font-black hover:bg-[#1F7A8C] transition-all">
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (cart.length === 0) {
    return navigate('/cart');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        
        {/* Left Side: Checkout Form */}
        <div className="space-y-12">
          <div>
            <h1 className="text-4xl font-black text-[#0B3C5D]">Checkout</h1>
            <p className="text-gray-400 mt-2">Complete your supply request details</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${step === 'info' ? 'bg-[#0B3C5D] text-white' : 'bg-green-100 text-green-700'}`}>
              1. Information
            </div>
            <ChevronRight size={16} className="text-gray-300" />
            <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${step === 'payment' ? 'bg-[#0B3C5D] text-white' : 'bg-gray-100 text-gray-400'}`}>
              2. Payment
            </div>
          </div>

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
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                    <input 
                      required
                      type="text"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      required
                      type="email"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                    <input 
                      required
                      type="tel"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Facility/Hospital Name</label>
                    <input 
                      required
                      type="text"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.hospital}
                      onChange={(e) => setFormData({...formData, hospital: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Delivery Address</label>
                    <textarea 
                      required
                      rows={3}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D] transition-all"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#0B3C5D] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#1F7A8C] transition-all shadow-xl shadow-blue-900/10"
                >
                  Continue to Payment
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
                    By confirming this order, we will generate a proforma invoice for your facility. 
                    Payment can be made via Bank Transfer or Mobile Money upon delivery or according to your 
                    account terms.
                  </p>
                </div>

                <div className="space-y-4">
                   <h3 className="font-bold text-[#0B3C5D]">Select Payment Prefrence</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-6 border-2 border-[#0B3C5D] bg-[#0B3C5D]/5 rounded-2xl flex items-center gap-4">
                        <CreditCard className="text-[#0B3C5D]" />
                        <div>
                          <p className="font-black text-[#0B3C5D]">Pay on Delivery</p>
                          <p className="text-xs text-gray-400 font-bold">Cheque or Bank Transfer</p>
                        </div>
                      </div>
                      <div className="p-6 border border-gray-100 bg-gray-50 rounded-2xl flex items-center gap-4 opacity-50 cursor-not-allowed">
                        <div className="w-6 h-6 rounded-full border border-gray-300" />
                        <div>
                          <p className="font-black text-gray-400">Electronic Payment</p>
                          <p className="text-xs text-gray-300">Credit Card / Mobile Money</p>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button 
                     onClick={() => setStep('info')}
                     className="flex-grow md:flex-grow-0 px-8 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black hover:bg-gray-100 transition-all"
                   >
                     Back
                   </button>
                   <button 
                    onClick={processOrder}
                    disabled={loading}
                    className="flex-grow bg-[#0B3C5D] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#1F7A8C] transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <ShoppingBag size={20} />}
                    {loading ? 'Processing...' : 'Place Order'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Order Summary */}
        <div className="lg:sticky lg:top-32 h-fit space-y-8">
           <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-6">
              <h3 className="text-xl font-bold text-[#0B3C5D]">Order Summary</h3>
              
              <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                      <img src={item.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow">
                      <p className="font-bold text-[#0B3C5D] text-sm leading-tight">{item.name}</p>
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-black text-[#0B3C5D] text-sm whitespace-nowrap">GH₵ {(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-gray-50 space-y-3">
                <div className="flex justify-between text-sm text-gray-400 font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>GH₵ {cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400 font-bold uppercase tracking-widest">
                  <span>VAT (5%)</span>
                  <span>GH₵ {(cartTotal * 0.05).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-gray-100">
                  <span className="text-lg font-black text-[#0B3C5D]">Total</span>
                  <span className="text-2xl font-black text-[#EAB308]">GH₵ {(cartTotal * 1.05).toLocaleString()}</span>
                </div>
              </div>
           </div>

           <div className="space-y-4">
              <div className="flex items-center gap-4 text-gray-400">
                <Truck size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Estimated Delivery: 2-3 Days</span>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                <MapPin size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Ships from Accra Central</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
