// Platform config — deposit accounts shown to users for downpayment & installments
export const PLATFORM_CONFIG = {
  // Where users send 10% downpayment / installments
  depositAccounts: [
    {
      method: 'JazzCash',
      accountTitle: 'E-Qarza Securities (Pvt) Ltd',
      accountNumber: '03001234567',
      color: '#ED1C24',
    },
    {
      method: 'EasyPaisa',
      accountTitle: 'E-Qarza Securities (Pvt) Ltd',
      accountNumber: '03451234567',
      color: '#00A651',
    },
    {
      method: 'Bank Transfer (HBL)',
      accountTitle: 'E-Qarza Securities (Pvt) Ltd',
      accountNumber: 'PK36 HABB 0000 1234 5678 9012',
      color: '#00A651',
    },
  ],
  company: {
    name: 'E-Qarza Securities',
    email: 'support@eqarza.pk',
    hotline1: '0800-12345',
    hotline2: '0300-1234567',
    license: 'SECP Licensed & Secured — License #SEC/LN/2026/PK-0458',
  },
  // Loan tenor in weeks (1 month = 4 weeks)
  loanWeeks: 4,
  downpaymentPercent: 10,
}

export type PlatformConfig = typeof PLATFORM_CONFIG
