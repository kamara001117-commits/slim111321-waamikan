import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ChevronRight, Activity, Box, Heart, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home = () => {
  const businessAreas = [
    {
      title: "Medical Consumables",
      description: "Ultrasound papers, Eco Gel, X-Ray films, developers, and daily clinical essentials.",
      icon: <Box className="w-8 h-8 text-[#EAB308]" />,
      image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800"
    },
    {
      title: "Imaging & IVD",
      description: "Advanced X-Ray, CT Scan, MRI, and IVD solutions like Analyzers and Centrifuges.",
      icon: <Activity className="w-8 h-8 text-[#EAB308]" />,
      image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800"
    },
    {
      title: "Hospital Furniture",
      description: "High-grade beds, wheelchairs, and institutional recovery solutions.",
      icon: <Heart className="w-8 h-8 text-[#EAB308]" />,
      image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=800"
    },
    {
      title: "Treatment Systems",
      description: "Lithotripsy, Hemodialysis, and Critical Care solutions for OR/ICU settings.",
      icon: <Zap className="w-8 h-8 text-[#EAB308]" />,
      image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800"
    }
  ];

  const clients = [
    "St Johns hospital",
    "Wesley clinic",
    "Danpong hospital",
    "St Moses hospital"
  ];

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-[#0B3C5D]">
        {/* Full Cover Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=2000" 
            alt="Healthcare background" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B3C5D] via-[#0B3C5D]/80 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-3xl">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <span className="inline-block px-4 py-1 rounded-full bg-[#EAB308] text-[#0B3C5D] text-xs font-black uppercase tracking-widest mb-6">
                Leading Medical Supplies in Ghana
              </span>
              <h1 className="text-6xl lg:text-8xl font-black text-white leading-[0.95] mb-8 tracking-tighter">
                Advancing <br />
                <span className="text-[#EAB308] italic font-light">Health Outcomes</span>
              </h1>
              <p className="text-xl text-blue-50/80 mb-10 max-w-xl leading-relaxed font-medium">
                We deliver transformative solutions that support providers in navigating complex care settings and equipping them for high-precision diagnostic and surgical success.
              </p>
              <div className="flex flex-wrap gap-6">
                <Link to="/products" className="bg-[#EAB308] text-[#0B3C5D] px-10 py-5 rounded-2xl font-black flex items-center gap-3 hover:scale-105 transition-all group shadow-2xl shadow-yellow-500/20">
                  Discover WAAMIKAN
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/contact" className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-10 py-5 rounded-2xl font-black hover:bg-white/20 transition-all">
                  Contact Specialist
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Floating Decorative Elements */}
        <div className="absolute bottom-10 right-10 hidden lg:block z-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[3rem] w-64"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-[#EAB308]/20 rounded-2xl">
                <Activity className="text-[#EAB308]" size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-100">Precision Diagnostics</span>
            </div>
            <p className="text-[10px] text-blue-200/50 uppercase font-bold tracking-[0.2em]">Next-Gen CT/MRI</p>
          </motion.div>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-24 bg-[#F7FAFC]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-[#0B3C5D] mb-8">Touching Virtually Every Aspect of Health</h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            As a diversified healthcare services leader, we help healthcare providers access transformative technologies, support providers in navigating complex care settings, and equip care settings with technologies that drive more effective treatments.
          </p>
        </div>
      </section>

      {/* Business Areas Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {businessAreas.map((area, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="relative h-64 rounded-3xl overflow-hidden mb-6">
                  <img src={area.image} alt={area.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-6 left-6 p-2 bg-white rounded-xl">
                    {area.icon}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#0B3C5D] mb-3 flex items-center gap-2 group-hover:text-[#EAB308] transition-colors">
                  {area.title}
                  <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </h3>
                <p className="text-gray-500 leading-relaxed">{area.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories / Insights (Brief Replica) */}
      <section className="py-24 bg-[#0B3C5D] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-1/2">
              <span className="text-[#EAB308] font-bold tracking-widest uppercase text-sm mb-4 block">Stories & Insights</span>
              <h2 className="text-5xl font-bold mb-6">Innovative Supply Chain Solutions</h2>
              <p className="text-blue-100/70 text-lg mb-8 leading-relaxed">
                Discover how we are revolutionizing the delivery of medical products across Ghana through automated logistics and smart inventory management.
              </p>
              <button className="border-2 border-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-[#0B3C5D] transition-all">
                Read the Story
              </button>
            </div>
            <div className="lg:w-1/2 grid grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="h-48 bg-white/10 rounded-2xl backdrop-blur-sm p-8 flex flex-col justify-end">
                  <span className="text-3xl font-bold text-white">100+</span>
                  <p className="text-blue-100/50 text-sm">Pharmacies Served</p>
                </div>
                <div className="h-64 bg-white/10 rounded-2xl backdrop-blur-sm p-8 flex flex-col justify-end">
                  <span className="text-3xl font-bold text-white">17+</span>
                  <p className="text-blue-100/50 text-sm">Major Hospitals Served</p>
                </div>
              </div>
              <div className="mt-12 space-y-6">
                <div className="h-64 bg-white/10 rounded-2xl backdrop-blur-sm p-8 flex flex-col justify-end">
                  <span className="text-3xl font-bold text-white">2k+</span>
                  <p className="text-blue-100/50 text-sm">Products in Catalog</p>
                </div>
                <div className="h-48 bg-white/10 rounded-2xl backdrop-blur-sm p-8 flex flex-col justify-end">
                  <span className="text-3xl font-bold text-white">24/7</span>
                  <p className="text-blue-100/50 text-sm">Support Delivery</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clients Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-[#0B3C5D] mb-12">Trusted by Leading Healthcare Institutions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 opacity-60 grayscale">
            {clients.map((client, idx) => (
              <div key={idx} className="text-lg font-bold text-gray-500 border-2 border-gray-100 px-6 py-4 rounded-xl flex items-center justify-center text-center">
                {client}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[#EAB308]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-8">Partner with WAAMIKAN Today</h2>
          <p className="text-white/80 text-xl mb-10">
            Let's discuss how we can support your facility with reliable medical supplies and world-class equipment.
          </p>
          <Link to="/contact" className="bg-[#0B3C5D] text-white px-10 py-5 rounded-full font-bold text-lg hover:shadow-2xl transition-all inline-block">
            Start a Partnership
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
