import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

type UserWithRelations = Prisma.UserGetPayload<{
  include: { kyc: true; loans: { include: { installments: true } } }
}>

// Permissions a staff account can hold. Super admin implicitly has all of them.
export type AdminPermissions = {
  users: boolean
  payments: boolean
  loans: boolean
  withdrawals: boolean
  kyc: boolean
}

export type AdminIdentity = {
  id: string
  username: string
  isStaff: boolean
  roleId?: string
  roleName?: string
  permissions: AdminPermissions | null // null = super admin (full access)
}

// Helper to verify user session from header.
// By default only the user's scalar columns are fetched (sessions are checked on
// every authenticated API call, so skipping the kyc + loans+installments joins
// makes those requests dramatically cheaper). Pass includeRelations=true only on
// routes that actually need user.kyc / user.loans.
export async function getUserFromReq(req: NextRequest, includeRelations = false): Promise<UserWithRelations | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  if (!token) return null

  if (includeRelations) {
    const user = await db.user.findFirst({
      where: { otp: token },
      include: {
        kyc: true,
        loans: { include: { installments: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!user) return null
    if (user.otpExpiresAt && user.otpExpiresAt.getTime() < Date.now()) return null
    if (user.blocked || user.deleted) return null
    return user
  }

  const user = await db.user.findFirst({ where: { otp: token } })
  if (!user) return null
  if (user.otpExpiresAt && user.otpExpiresAt.getTime() < Date.now()) return null
  if (user.blocked || user.deleted) return null
  return user as UserWithRelations
}

// Helper to verify an admin/staff session from the Bearer token.
// - Super admin tokens are looked up in the Admin table.
// - Staff tokens are looked up in the Staff table (blocked staff are rejected)
//   and come back with the permission set of their role.
export async function getAdminFromReq(req: NextRequest): Promise<AdminIdentity | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  if (!token) return null

  const admin = await db.admin.findFirst({ where: { passwordHash: token } })
  if (admin) {
    return { id: admin.id, username: admin.username, isStaff: false, permissions: null }
  }

  const staff = await db.staff.findFirst({
    where: { passwordHash: token },
    include: { role: true },
  })
  if (!staff || staff.blocked) return null
  return {
    id: staff.id,
    username: staff.username,
    isStaff: true,
    roleId: staff.roleId,
    roleName: staff.role.name,
    permissions: {
      users: staff.role.canUsers,
      payments: staff.role.canPayments,
      loans: staff.role.canLoans,
      withdrawals: staff.role.canWithdrawals,
      kyc: staff.role.canKyc,
    },
  }
}

// Module permission check: super admin passes everything; staff need the flag.
export function hasPerm(admin: AdminIdentity | null, module: keyof AdminPermissions): boolean {
  if (!admin) return false
  if (!admin.isStaff) return true
  return !!admin.permissions?.[module]
}

// Super-admin-only guard (settings, staff management, videos, bank, logs...).
export function isSuperAdmin(admin: AdminIdentity | null): boolean {
  return !!admin && !admin.isStaff
}

// Strict admin check — rejects staff accounts entirely.
// Used for routes that staff must never access.
export function isAdminOnly(admin: AdminIdentity | null): boolean {
  return !!admin && !admin.isStaff
}
