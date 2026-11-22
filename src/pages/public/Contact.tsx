import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { COMPANY_INFO } from '@/src/constants/auth';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    hospital: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await addDoc(collection(db, 'requests'), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        hospital: formData.hospital.trim(),
        message: formData.message.trim(),
        status: 'new',
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '', email: '', hospital: '', message: '' });
      setSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
      setErrorMsg('Failed to send your inquiry. Please check your connection or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <section className="bg-[#0B3C5D] text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold">Contact WAAMIKAN</h1>
          <p className="text-lg sm:text-xl text-blue-100/70">
            Partner with Ghana&apos;s trusted medical supply &amp; hospital engineering leader.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Info */}
          <div className="space-y-10">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-[#0B3C5D]">Get in Touch</h2>
              <p className="text-gray-600 leading-relaxed">
                Whether you&apos;re a major teaching hospital or a private clinic, we&apos;re ready
                to support your medical supply, hospital project, and servicing needs.
              </p>
              <p className="text-sm text-[#1F7A8C] font-semibold bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                {COMPANY_INFO.projectsNotice}
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-5">
                <div className="p-4 bg-blue-50 rounded-2xl text-[#0B3C5D] shrink-0">
                  <Phone />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Phone</h4>
                  <p className="text-gray-500">{COMPANY_INFO.phone1}</p>
                  <p className="text-gray-500">{COMPANY_INFO.phone2}</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="p-4 bg-blue-50 rounded-2xl text-[#0B3C5D] shrink-0">
                  <Mail />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Email</h4>
                  <p className="text-gray-500">{COMPANY_INFO.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="p-4 bg-blue-50 rounded-2xl text-[#0B3C5D] shrink-0">
                  <MapPin />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Headquarters</h4>
                  <p className="text-gray-500">{COMPANY_INFO.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-[#F7FAFC] p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6 py-16"
              >
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                  <CheckCircle size={40} />
                </div>
                <h3 className="text-2xl font-bold text-[#0B3C5D]">Message Sent Successfully!</h3>
                <p className="text-gray-600">
                  Our team will get back to your facility within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-[#0B3C5D] font-bold underline"
                >
                  Send another message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMsg && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Full Name
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-[#0B3C5D] transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-[#0B3C5D] transition-all"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Hospital / Clinic
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-[#0B3C5D] transition-all"
                      value={formData.hospital}
                      onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    How can we help?
                  </label>
                  <textarea
                    required
                    rows={5}
                    className="w-full p-4 bg-white rounded-2xl border border-gray-200 outline-none focus:border-[#0B3C5D] transition-all"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
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
