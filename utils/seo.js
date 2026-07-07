export const SITE_NAME = 'MediCare Hospital ERP';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicare-erp.com';
export const DEFAULT_DESC = 'MediCare Hospital ERP — Comprehensive Hospital, Pharmacy and Inventory Management System.';

export const buildSEO = ({
  title,
  description = DEFAULT_DESC,
  path = '',
  noIndex = true // Internal ERP — default noIndex
}) => ({
  title: title ? `${title} | ${SITE_NAME}` : SITE_NAME,
  description,
  canonical: `${SITE_URL}${path}`,
  noIndex
});