// lib/admin/nav.schema.ts

import type { AccessRule } from './guards'

export type AdminNavItem = {
  label: string
  href: string
  description?: string
  access?: AccessRule
}

export type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        description: 'Admin overview & quick links',
      },
      {
        label: 'Account',
        href: '/admin/account',
        description: 'Profile, email, password, roles & overrides',
        access: { anyOf: ['admin.access'] },
      },
    ],
  },

  {
    title: 'Commercial',
    items: [
      {
        label: 'Pricing',
        href: '/admin/pricing',
        description: 'Drafts, versions, publish & validation',
        access: { anyOf: ['pricing.read', 'admin.access'] },
      },
      {
        label: 'Portfolio pricing',
        href: '/admin/portfolio-pricing',
        description: 'Portfolio settings & scenarios',
        access: { anyOf: ['pricing.read', 'admin.access'] },
      },
      {
        label: 'Monthly spot',
        href: '/admin/monthly-spot',
        description: 'Spot tables & corrections',
        access: { anyOf: ['pricing.read', 'admin.access'] },
      },
      {
        label: 'Spot settings',
        href: '/admin/spot-settings',
        description: 'Area adjustments, certificates & fees',
        access: { anyOf: ['pricing.write', 'admin.access'] },
      },
      {
        label: 'Postal areas',
        href: '/admin/postal-areas',
        description: 'SE postal mapping and area logic',
        access: { anyOf: ['pricing.write', 'admin.access'] },
      },
      {
        label: 'Customer spec',
        href: '/admin/customer-spec',
        description: 'Customer specification calculator',
        access: { anyOf: ['pricing.read', 'admin.access'] },
      },
      {
        label: 'Calculator',
        href: '/admin/calculator',
        description: 'Internal pricing / margin utilities',
        access: { anyOf: ['pricing.read', 'admin.access'] },
      },
    ],
  },

  {
    title: 'Operations',
    items: [
      {
        label: 'Customers',
        href: '/admin/customers',
        description: 'Customer cards, signatures, legal acceptance & documents',
        access: { anyOf: ['agreements.read', 'agreements.write', 'admin.access'] },
      },
      {
        label: 'Contracts',
        href: '/admin/contracts',
        description: 'Contract lifecycle & settings',
        access: { anyOf: ['contracts.read', 'admin.access'] },
      },
      {
        label: 'Agreements',
        href: '/admin/agreements',
        description: 'Customer agreements and signing flows',
        access: { anyOf: ['agreements.read', 'agreements.write', 'admin.access'] },
      },
      {
        label: 'Settlements',
        href: '/admin/settlements',
        description: 'Reconciliation & settlement tools',
        access: { anyOf: ['settlements.read', 'admin.access'] },
      },
      {
        label: 'Integrations',
        href: '/admin/integrations',
        description: 'External integrations & connectors',
        access: { anyOf: ['integrations.read', 'admin.access'] },
      },
      {
        label: 'Billing',
        href: '/admin/billing',
        description: 'Billing operations and exports',
        access: { anyOf: ['billing.read', 'admin.access'] },
      },
      {
        label: 'Support tickets',
        href: '/admin/support-tickets',
        description: 'Support inbox (internal)',
        access: { anyOf: ['support.read', 'admin.access'] },
      },
      {
        label: 'Incidents',
        href: '/admin/incidents',
        description: 'Incident reporting & response',
        access: { anyOf: ['incidents.read', 'admin.access'] },
      },
    ],
  },

  {
    title: 'Security & Compliance',
    items: [
      {
        label: 'RBAC',
        href: '/admin/rbac',
        description: 'Roles, permissions & overrides',
        access: { anyOf: ['rbac.read', 'admin.access'] },
      },
      {
        label: 'RBAC assignments',
        href: '/admin/rbac/assignments',
        description: 'Assign roles, overrides, deactivate users',
        access: { anyOf: ['rbac.write', 'admin.access'] },
      },
      {
        label: 'RBAC permissions',
        href: '/admin/rbac/permissions',
        description: 'Create permissions & manage catalog',
        access: { anyOf: ['rbac.write', 'admin.access'] },
      },
      {
        label: 'RBAC roles',
        href: '/admin/rbac/roles',
        description: 'Create roles & toggle permissions',
        access: { anyOf: ['rbac.write', 'admin.access'] },
      },
      {
        label: 'Access',
        href: '/admin/access',
        description: 'Admin access visibility & diagnostics',
        access: { anyOf: ['admin.access'] },
      },
      {
        label: 'Audit pricing',
        href: '/admin/audit/pricing',
        description: 'Pricing publish & permission audit',
        access: { anyOf: ['audit.read', 'compliance.read', 'admin.access'] },
      },
      {
        label: 'Audit agreements',
        href: '/admin/audit/agreements',
        description: 'Legal acceptance logs',
        access: { anyOf: ['audit.read', 'compliance.read', 'admin.access'] },
      },
    ],
  },
]