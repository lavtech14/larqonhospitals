import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '../generated/prisma/enums.js';

export const REQUIRED_PERMISSIONS = 'auth:requiredPermissions';
export const AUTHENTICATED_ONLY = 'auth:authenticatedOnly';

export type Permission =
  | 'patients.demographics.read'
  | 'patients.demographics.create'
  | 'patients.demographics.update'
  | 'departments.read'
  | 'departments.manage'
  | 'doctors.read'
  | 'doctors.manage'
  | 'availability.read'
  | 'availability.manage'
  | 'appointments.read'
  | 'appointments.create'
  | 'appointments.cancel'
  | 'staff.read'
  | 'staff.manage'
  | 'appointments.own.read'
  | 'patients.account.manage';

const rolePermissions: Record<StaffRole, readonly Permission[]> = {
  ADMIN: [
    'patients.demographics.read',
    'patients.demographics.create',
    'patients.demographics.update',
    'departments.read',
    'departments.manage',
    'doctors.read',
    'doctors.manage',
    'availability.read',
    'availability.manage',
    'appointments.read',
    'appointments.create',
    'appointments.cancel',
    'staff.read',
    'staff.manage',
    'patients.account.manage',
  ],
  RECEPTIONIST: [
    'patients.demographics.read',
    'patients.demographics.create',
    'patients.demographics.update',
    'departments.read',
    'doctors.read',
    'availability.read',
    'appointments.read',
    'appointments.create',
    'appointments.cancel',
    'patients.account.manage',
  ],
  DOCTOR: [
    'departments.read',
    'doctors.read',
    'availability.read',
    'appointments.own.read',
  ],
  NURSE: ['departments.read', 'doctors.read', 'availability.read'],
  LAB_TECHNICIAN: [],
  LAB_REVIEWER: [],
  PHARMACIST: [],
  BILLING: [],
};

export function permissionsForRoles(roles: readonly string[]): Permission[] {
  const permissions = new Set<Permission>();

  for (const role of roles) {
    if (Object.hasOwn(rolePermissions, role)) {
      for (const permission of rolePermissions[role as StaffRole]) {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
}

export function RequirePermissions(
  first: Permission,
  ...remaining: Permission[]
) {
  return SetMetadata(REQUIRED_PERMISSIONS, [first, ...remaining]);
}

export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY, true);
