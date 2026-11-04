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
  | 'patients.account.manage'
  | 'encounters.check-in'
  | 'nursing.queue.read'
  | 'encounters.vitals.read'
  | 'encounters.vitals.record'
  | 'encounters.own.read'
  | 'encounters.own.start'
  | 'encounters.own.notes.write'
  | 'medicines.read'
  | 'medicines.manage'
  | 'prescriptions.own.read'
  | 'prescriptions.own.write'
  | 'prescriptions.own.issue'
  | 'encounters.own.publish'
  | 'lab-tests.read'
  | 'lab-tests.manage'
  | 'lab-orders.own.read'
  | 'lab-orders.own.create'
  | 'lab-orders.own.cancel'
  | 'lab.queue.read'
  | 'lab.samples.collect'
  | 'lab.results.read'
  | 'lab.results.write'
  | 'lab.results.release'
  | 'lab.samples.reject'
  | 'pharmacy.stock.read'
  | 'pharmacy.stock.receive'
  | 'pharmacy.prescriptions.read'
  | 'pharmacy.dispense'
  | 'billing.read'
  | 'billing.prices.manage'
  | 'billing.invoices.manage'
  | 'billing.payments.record'
  | 'rpm.read'
  | 'rpm.assign';

const rolePermissions: Record<StaffRole, readonly Permission[]> = {
  ADMIN: [
    'billing.read',
    'billing.prices.manage',
    'pharmacy.stock.read',
    'pharmacy.stock.receive',
    'nursing.queue.read',
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
    'encounters.check-in',
    'medicines.read',
    'medicines.manage',
    'lab-tests.read',
    'lab-tests.manage',
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
    'encounters.check-in',
  ],
  DOCTOR: [
    'departments.read',
    'doctors.read',
    'availability.read',
    'appointments.own.read',
    'encounters.own.read',
    'encounters.own.start',
    'encounters.own.notes.write',
    'medicines.read',
    'prescriptions.own.read',
    'prescriptions.own.write',
    'prescriptions.own.issue',
    'encounters.own.publish',
    'lab-tests.read',
    'lab-orders.own.read',
    'lab-orders.own.create',
    'lab-orders.own.cancel',

    'rpm.read',
    'rpm.assign',
  ],
  NURSE: [
    'departments.read',
    'doctors.read',
    'availability.read',
    'nursing.queue.read',
    'encounters.vitals.read',
    'encounters.vitals.record',
    'rpm.read',
  ],
  LAB_TECHNICIAN: [
    'lab-tests.read',
    'lab.queue.read',
    'lab.samples.collect',
    'lab.results.read',
    'lab.results.write',
    'lab.samples.reject',
  ],
  LAB_REVIEWER: [
    'lab-tests.read',
    'lab.queue.read',
    'lab.results.read',
    'lab.results.release',
  ],
  PHARMACIST: [
    'medicines.read',
    'pharmacy.stock.read',
    'pharmacy.stock.receive',
    'pharmacy.prescriptions.read',
    'pharmacy.dispense',
  ],
  BILLING: [
    'billing.read',
    'billing.invoices.manage',
    'billing.payments.record',
  ],
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
