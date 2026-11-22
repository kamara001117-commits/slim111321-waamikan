import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ShieldCheck, FileText, Cookie, Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import { COMPANY_INFO } from '@/src/constants/auth';

export type InfoPageType = 'help' | 'privacy' | 'terms' | 'cookies';

const PAGE_CONTENT: Record<
  InfoPageType,
  {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    sections: { heading: string; body: string }[];
  }
> = {
  help: {
    title: 'Help & Support Center',
    subtitle: 'Procurement guidance, equipment servicing requests, and institutional order support.',
    icon: <HelpCircle size={28} className="text-[#1F7A8C]" />,
    sections: [
      {
        heading: 'Institutional & Hospital Procurement',
        body: 'Hospitals, clinics, and laboratories can request formal Proforma Invoices or Sales Quotes directly through our Contact & Quote page or by submitting a storefront order. Our team confirms availability, tax schedules, and delivery timelines prior to dispatch.',
      },
      {
        heading: 'Hospital Projects, Servicing & Repairs',
        body: COMPANY_INFO.projectsNotice,
      },
      {
        heading: 'Order Tracking & Downloadable Documents',
        body: 'Signed-in clients can inspect order statuses, print receipts, and download proforma/tax invoices directly from the My Orders portal.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: `How ${COMPANY_INFO.name} collects, protects, and uses institutional and customer data.`,
    icon: <ShieldCheck size={28} className="text-[#1F7A8C]" />,
    sections: [
      {
        heading: 'Information We Collect',
        body: 'We collect contact names, institutional designations, delivery addresses, phone numbers, and order history solely to fulfill medical equipment supply, issue official financial documents, and schedule technical servicing.',
      },
      {
        heading: 'Authentication & Data Security',
        body: 'User accounts are authenticated securely via Google Sign-In. Financial records, invoices, and customer profiles are stored with strict role-based access controls.',
      },
      {
        heading: 'Data Requests',
        body: `To request updates or deletion of your institutional contact records, contact us at ${COMPANY_INFO.email}.`,
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    subtitle: `Commercial and platform terms governing orders and services with ${COMPANY_INFO.name}.`,
    icon: <FileText size={28} className="text-[#1F7A8C]" />,
    sections: [
      {
        heading: 'Quotations & Proforma Invoices',
        body: 'All Sales Quotes and Proforma Invoices are denominated in Ghana Cedis (GHC) unless otherwise specified and remain valid for the period stated on the generated PDF document.',
      },
      {
        heading: 'Inspection, Warranty & Servicing',
        body: 'All medical devices and consumables should be inspected upon delivery against the accompanying Waybill. Warranty coverage and preventive maintenance schedules apply per manufacturer and contract terms.',
      },
      {
        heading: 'Payment Settlement',
        body: 'Official company receipts are issued upon verified payment via bank transfer, mobile money, cheque, or authorized cash settlement.',
      },
    ],
  },
  cookies: {
    title: 'Cookie & Storage Settings',
    subtitle: 'Essential browser storage used by the WAAMIKAN Enterprise platform.',
    icon: <Cookie size={28} className="text-[#1F7A8C]" />,
    sections: [
      {
        heading: 'Essential Session & Cart Storage',
        body: 'We use local browser storage solely to preserve your shopping cart items across page visits and maintain your signed-in Firebase Authentication session.',
      },
      {
        heading: 'No Third-Party Advertising Trackers',
        body: 'WAAMIKAN Enterprise does not sell browsing data or deploy third-party advertising cookies on customer or hospital procurement portals.',
      },
    ],
  },
};

const InfoPage: React.FC<{ type: InfoPageType }> = ({ type }) => {
  const content = PAGE_CONTENT[type];

  return (
    <div className="bg-[#F7FAFC] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-sm space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            {content.icon}
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0B3C5D]">{content.title}</h1>
            <p className="text-gray-500 mt-2 leading-relaxed">{content.subtitle}</p>
          </div>

          <div className="space-y-6 pt-4 border-t border-gray-100">
            {content.sections.map((section) => (
              <div key={section.heading} className="space-y-2">
                <h2 className="text-lg font-bold text-[#0B3C5D]">{section.heading}</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0B3C5D] text-white rounded-[2.5rem] p-8 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 text-sm">
            <p className="text-xs font-black uppercase tracking-widest text-[#EAB308]">
              {COMPANY_INFO.name}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-blue-100/80">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} /> {COMPANY_INFO.address}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail size={14} /> {COMPANY_INFO.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone size={14} /> {COMPANY_INFO.phone1} / {COMPANY_INFO.phone2}
              </span>
            </div>
          </div>
          <Link
            to="/contact"
            className="bg-[#EAB308] text-[#0B3C5D] px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shrink-0 hover:bg-white transition-colors"
          >
            Contact Support
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InfoPage;
