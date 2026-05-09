import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    hospital: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'requests'), {
        ...formData,
        status: 'new',
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting request:", error);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <section className="bg-[#0B3C5D] text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-5xl font-bold">Contact WAAMIKAN</h1>
          <p className="text-xl text-blue-100/70">Partner with Ghana's trusted medical supply leader.</p>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Info */}
          <div className="space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-[#0B3C5D]">Get in Touch</h2>
              <p className="text-gray-600 leading-relaxed">
                Whether you're a major teaching hospital or a private clinic, we're ready to support your medical supply needs with precision and care.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="p-4 bg-blue-50 rounded-2xl text-[#0B3C5D]"><Phone /></div>
                <div>
                  <h4 className="font-bold text-gray-800">Phone</h4>
                  <p className="text-gray-500">+233(0) 20 898 7185</p>
                  <p className="text-gray-500">+233(0) 24 210 9859</p>
                </div>
              </div>
              <div className="flex items-start gap-6">
                <div className="p-4 bg-blue-50 rounded-2xl text-[#0B3C5D]"><Mail /></div>
                <div>
                  <h4 className="font-bold text-gray-800">Email</h4>
                  <p className="text-gray-500">Waamikan@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-6">
                <div className="p-4 bg-blue-50 rounded-2xl text-[#0B3C5D]"><MapPin /></div>
                <div>
                  <h4 className="font-bold text-gray-800">Locations</h4>
                  <p className="text-gray-500">Accra, Ghana</p>
                  <p className="text-gray-500">Kasoa, Central Region</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-[#F7FAFC] p-10 rounded-[40px] shadow-sm border border-gray-100">
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20"
              >
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                  <CheckCircle size={40} />
                </div>
                <h3 className="text-2xl font-bold text-[#0B3C5D]">Message Sent Successfully!</h3>
                <p className="text-gray-600">Our team will get back to your hospital within 24 hours.</p>
                <button onClick={() => setSubmitted(false)} className="text-[#0B3C5D] font-bold underline">Send another message</button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-[#0B3C5D] transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      required
                      type="email" 
                      className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-[#0B3C5D] transition-all"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hospital / Clinic</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-[#0B3C5D] transition-all"
                      value={formData.hospital}
                      onChange={(e) => setFormData({...formData, hospital: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">How can we help?</label>
                  <textarea 
                    required
                    rows={5}
                    className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-[#0B3C5D] transition-all"
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                  />
                </div>
                <button 
                  disabled={loading}
                  type="submit" 
                  className="w-full bg-[#0B3C5D] text-white py-5 rounded-2xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <Send size={20} />
                  {loading ? 'Sending...' : 'Send Inquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
