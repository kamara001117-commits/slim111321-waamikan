import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Award, Users, Globe } from 'lucide-react';

const About = () => {
  const values = [
    { title: "On-Time Delivery", desc: "We understand the urgency of medical care and ensure we deliver on time.", icon: <Globe className="text-[#0B3C5D]" /> },
    { title: "Value for Money", desc: "Premium products and services that provide real value for your investment.", icon: <CheckCircle2 className="text-[#0B3C5D]" /> },
    { title: "Effective Service", desc: "We are effective and efficient in our service delivery to all our clients.", icon: <Award className="text-[#0B3C5D]" /> },
    { title: "Automated Systems", desc: "Our system is automated software tailored for quality goods and services delivery.", icon: <Users className="text-[#0B3C5D]" /> },
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-50 py-24 border-b border-gray-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <span className="text-[#EAB308] font-bold tracking-widest uppercase text-sm">Founded January 16, 2017</span>
            <h1 className="text-5xl lg:text-7xl font-bold text-[#0B3C5D] leading-tight">
              A Legacy of <br />
              <span className="text-gray-400 font-light">Healthcare Excellence</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              WAAMIKAN Enterprise is specialized in the supply of medical products, its consumables, and general supply of goods and services.
            </p>
          </div>
          <div className="relative">
             <div className="rounded-[40px] overflow-hidden shadow-2xl">
                <img src="https://images.unsplash.com/photo-1576091160550-2173bdb999ef?auto=format&fit=crop&q=80&w=1200" className="w-full h-[500px] object-cover" alt="Waamikan team" />
             </div>
             <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-3xl shadow-xl max-w-xs border border-gray-100 hidden lg:block">
                <p className="text-2xl font-black text-[#0B3C5D]">9+ Years</p>
                <p className="text-gray-500 text-sm font-medium">Of dedicated medical equipment distribution.</p>
             </div>
          </div>
        </div>
      </section>

      {/* Mission/Vision */}
      <section className="py-24 max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#0B3C5D] text-white p-12 rounded-[50px] space-y-6"
        >
          <h2 className="text-3xl font-bold">Our Mission</h2>
          <p className="text-blue-100/70 text-lg leading-relaxed">
            To provide quality medical services consistently to our valued customers and embracing professional standards and ethics.
          </p>
          <div className="pt-6 border-t border-white/10">
             <p className="italic text-lg">“Your needs Our Priorities”</p>
             <p className="text-xs text-blue-100/30 font-bold uppercase tracking-widest mt-2">— OUR MOTTO</p>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="bg-[#EAB308] text-white p-12 rounded-[50px] space-y-6"
        >
          <h2 className="text-3xl font-bold">Our Vision</h2>
          <p className="text-white/80 text-lg leading-relaxed">
            To be the market leader and the preferred provider of suppliers of medical products, consumable products, and medical management services in Ghana and beyond.
          </p>
        </motion.div>
      </section>

      {/* Values */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-[#0B3C5D] text-center mb-16">Why Engage Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v, i) => (
              <div key={i} className="bg-white p-10 rounded-[40px] shadow-sm hover:shadow-xl transition-all border border-gray-100 space-y-4 text-center">
                 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-3xl">
                   {v.icon}
                 </div>
                 <h4 className="text-xl font-bold text-gray-800">{v.title}</h4>
                 <p className="text-gray-500 leading-relaxed text-sm">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Note */}
      <section className="py-24 max-w-4xl mx-auto px-4 text-center space-y-10">
        <h2 className="text-4xl font-bold text-[#0B3C5D]">Our Human Resource</h2>
        <p className="text-xl text-gray-600 leading-relaxed">
          We have a very strong work force that is always available for any task the company has to undergo. They are well abreast with the latest technologies; they also have the requisite managerial, administrative, and technical know-how to execute a task to achieve the desired results that best fit the clients’ needs.
        </p>
      </section>
    </div>
  );
};

export default About;
