// Simple hash + OTP utilities (demo-grade; not for production)
import crypto from 'crypto'

export function hashPassword(p: string): string {
  return crypto.createHash('sha256').update(p).digest('hex')
}

export function verifyPassword(p: string, hash: string): boolean {
  return hashPassword(p) === hash
}

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function generateToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

// Pakistani bank list (most common)
export const PAKISTANI_BANKS = [
  'HBL (Habib Bank Limited)',
  'UBL (United Bank Limited)',
  'MCB Bank',
  'Bank Alfalah',
  'Meezan Bank',
  'Bank of Punjab (BOP)',
  'Allied Bank',
  'BankIslami Pakistan',
  'Faysal Bank',
  'Standard Chartered Bank',
  'HabibMetro Bank',
  'Askari Bank',
  'Soneri Bank',
  'Summit Bank',
  'JS Bank',
  'Dubai Islamic Bank Pakistan',
  'Bank of Khyber',
  'Sindh Bank',
  'Telenor Microfinance Bank',
  'NBP (National Bank of Pakistan)',
]

// Loan tiers based on monthly income
export const LOAN_TIERS = [
  { min: 0, max: 25000, limit: 4000 },
  { min: 25000, max: 50000, limit: 8000 },
  { min: 50000, max: 100000, limit: 18000 },
  { min: 100000, max: 200000, limit: 26000 },
  { min: 200000, max: Number.MAX_SAFE_INTEGER, limit: 55000 },
]

export function getEligibleLoanAmounts(monthlyIncome: number) {
  // user qualifies for all tiers whose min <= income
  return LOAN_TIERS.filter(t => monthlyIncome >= t.min).map(t => t.limit)
}

export function calcWeeklyInstallment(loanAmount: number, weeks = 4) {
  return Math.ceil(loanAmount / weeks)
}

export function calcDownpayment(loanAmount: number, pct = 10) {
  return Math.round((loanAmount * (pct / 100)) / 10) * 10 // round to nearest 10 PKR
}
