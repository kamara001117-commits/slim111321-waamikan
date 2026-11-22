import { UserRole } from '../types';
export type { UserRole };

export const SUPER_ADMIN_EMAILS = [
  'marufadam7777@gmail.com',
  'waamikan@gmail.com',
];

export const ADMIN_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'staff',
  'finance_manager',
  'inventory_manager',
  'sales_staff',
  'hr_staff',
];

export const STAFF_ROLE_LABELS: Record<Exclude<UserRole, 'user'>, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'General Staff',
  finance_manager: 'Finance Manager',
  inventory_manager: 'Inventory Manager',
  sales_staff: 'Sales Staff',
  hr_staff: 'HR Staff',
};

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
};

export const isAdminRole = (role?: string | null): boolean => {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as UserRole);
};

export const COMPANY_INFO = {
  name: 'WAAMIKAN ENTERPRISE',
  shortName: 'WAAMIKAN Enterprise',
  tagline: 'Healthcare Solutions | Medical Imaging | Consumables',
  address: 'Oyibi, Accra Ghana',
  phone1: '+233(0) 53 721 2475',
  phone2: '+233(0) 20 898 7185',
  phonesDisplay: '+233(0) 53 721 2475 / +233(0) 20 898 7185',
  email: 'Waamikan@gmail.com',
  instagram: 'https://www.instagram.com/waamikan?igsh=b3p4ZTZ4cTVjY2N6',
  facebook: 'https://www.facebook.com/share/1CNAPxXuMc/?mibextid=wwXIfr',
  projectsNotice:
    'The company also undertakes hospital projects and provides equipment servicing and repairs for both public and private healthcare institutions.',
};
