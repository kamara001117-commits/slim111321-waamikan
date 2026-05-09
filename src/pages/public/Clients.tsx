import React from 'react';
import { motion } from 'motion/react';
import { Users, Building2, CheckCircle2 } from 'lucide-react';

const Clients = () => {
  const clients = [
    { name: "St John's Hospital & Fertility Center", location: "Tantra Hill, Accra", type: "Private" },
    { name: "Wesley Clinic", location: "Kasoa, Accra", type: "Clinic" },
    { name: "Ridge Hospital (GARH)", location: "Greater Accra", type: "Regional" },
    { name: "37 Military Hospital", location: "Accra", type: "Military" },
    { name: "Korle Bu Teaching Hospital", location: "Accra", type: "Teaching" },
    { name: "Nima Polyclinic", location: "Nima, Accra", type: "Public" },
    { name: "Health On Wheel (HOW)", location: "Ghana", type: "Service" },
    { name: "Shalom Family Hospital", location: "Accra", type: "Private" },
    { name: "Tamale Teaching Hospital", location: "Tamale", type: "Teaching" },
    { name: "Iran Clinic", location: "Asylum Down, Accra", type: "Clinic" },
    { name: "Elubo Government Hospital", location: "Western Region", type: "Public" },
    { name: "Sanford International Hospital", location: "Adenta, Accra", type: "Private" },
    { name: "St Moses Hospital & Fertility Center", location: "Pokuase, Accra", type: "Private" },
    { name: "ScanRay Diagnostic & Medical Center", location: "Trade Fair, Accra", type: "Diagnostic" },
    { name: "Kasoa Central Clinic", location: "Kasoa", type: "Clinic" },
    { name: "Sonotech Diagnostic Center", location: "Osu, Accra", type: "Diagnostic" },
    { name: "Ashongman Community Hospital", location: "Ashongman", type: "Public" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-[#0B3C5D] py-24 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <h1 className="text-5xl font-black mb-6 tracking-tight">Our Trusted Partners</h1>
            <p className="text-xl text-blue-100 leading-relaxed">
              We take pride in supporting Ghana's leading medical institutions with high-quality equipment and supplies.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { label: "Active Hospitals", value: "50+" },
              { label: "Regional Coverage", value: "16 Regions" },
              { label: "Supply Reliability", value: "99.9%" },
            ].map((stat, i) => (
              <div key={i} className="text-center space-y-2">
                <p className="text-5xl font-black text-[#0B3C5D]">{stat.value}</p>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {clients.map((client, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-blue-50 rounded-2xl text-[#0B3C5D]">
                    <Building2 size={32} />
                  </div>
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase rounded-full tracking-widest">
                    Active Partner
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{client.name}</h3>
                <p className="text-gray-500 flex items-center gap-2 text-sm">
                   <CheckCircle2 size={16} className="text-blue-500" />
                   {client.location}, Ghana
                </p>
                <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{client.type} institution</span>
                   <Users size={20} className="text-gray-200" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#1F7A8C]">
        <div className="max-w-4xl mx-auto px-4 text-center text-white space-y-8">
          <h2 className="text-4xl font-black tracking-tight">Become a Waamikan Partner</h2>
          <p className="text-xl opacity-90">Ready to upgrade your hospital's equipment? Join the network of excellence.</p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
             <a href="/contact" className="bg-white text-[#1F7A8C] px-10 py-5 rounded-2xl font-black text-xl shadow-2xl hover:bg-gray-100 transition-all">
                Request a Consultation
             </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Clients;
