// Seeds rich demo data through the REAL user APIs so the admin dashboard
// has meaningful content in every section.
const BASE = 'http://localhost:3000'

async function api(path, opts = {}, token) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${data.error || JSON.stringify(data)}`)
  return data
}

// 1x1 PNG (transparent) as base data URI buffer
function pngBuf() {
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  return Buffer.from(b64, 'base64')
}

async function uploadImage(token, filename) {
  const fd = new FormData()
  fd.append('file', new Blob([pngBuf()], { type: 'image/png' }), filename)
  const res = await fetch(BASE + '/api/upload', {
    method: 'POST',
    body: fd,
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`upload failed: ${JSON.stringify(data)}`)
  return data.url
}

async function makeUser(phone, name, kyc) {
  // OTP request (demo mode returns code inline when sms disabled)
  const otpRes = await api('/api/auth/send-otp', { method: 'POST', body: { phone } })
  const otp = otpRes.otp
  if (!otp) throw new Error(`no inline OTP for ${phone} — is sms_otp disabled?`)
  const v = await api('/api/auth/verify-otp', { method: 'POST', body: { phone, otp } })
  const token = v.token
  if (kyc) {
    const [front, back, selfie] = await Promise.all([
      uploadImage(token, 'cnic-front.png'),
      uploadImage(token, 'cnic-back.png'),
      uploadImage(token, 'selfie.png'),
    ])
    await api('/api/user/kyc', {
      method: 'POST',
      body: {
        fullName: name,
        cnic: kyc.cnic,
        fatherName: kyc.father,
        dob: kyc.dob,
        education: 'Bachelor',
        maritalStatus: 'Single',
        gender: kyc.gender,
        city: kyc.city,
        address: kyc.address,
        email: kyc.email,
        occupation: kyc.occupation,
        monthlyIncome: kyc.income,
        employerName: kyc.employer,
        hasExistingLoan: false,
        cnicFrontImage: front,
        cnicBackImage: back,
        selfieImage: selfie,
      },
    }, token)
  }
  return { token, phone, name }
}

async function adminLogin() {
  const res = await api('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } })
  return res.token
}

async function main() {
  const admin = await adminLogin()
  console.log('[1] admin logged in')

  // Configure loan packages + markup like production
  for (const [key, value] of [
    ['loan_packages', '8000,14000,18500,24000'],
    ['markup_pct', '5'],
    ['loyalty_reduce_pct', '1'],
    ['loyalty_min_markup_pct', '2'],
    ['downpayment_pct', '10'],
    ['referral_bonus', '200'],
  ]) {
    await api('/api/admin/settings', { method: 'POST', body: { key, value } }, admin)
  }
  console.log('[2] loan config saved (packages 8000/14000/18500/24000, markup 5%)')

  // Users: various states
  const u1 = await makeUser('03001110001', 'Muhammad Afzal', { cnic: '42301-4620634-5', father: 'Aleem Ashad', dob: '1994-10-16', gender: 'M', city: 'Karachi', address: 'Gulshan Block 4', email: 'afzal@example.com', occupation: 'Job', income: 85000, employer: 'Private Co' })
  const u2 = await makeUser('03001110002', 'Khawaja Awais', { cnic: '38403-6336197-7', father: 'Muhammad Aslam', dob: '1992-03-08', gender: 'M', city: 'Lahore', address: 'Johar Town', email: 'awais@example.com', occupation: 'Business', income: 120000, employer: 'Self' })
  const u3 = await makeUser('03001110003', 'Maryam Tahir', { cnic: '31720-2018333-2', father: 'Tahir Mehmood', dob: '1996-07-21', gender: 'F', city: 'Islamabad', address: 'G-11 Markaz', email: 'maryam@example.com', occupation: 'Job', income: 60000, employer: 'School' })
  const u4 = await makeUser('03001110004', 'Ali Raza', { cnic: '35201-9407052-7', father: 'Raza Muhammad', dob: '1990-01-15', gender: 'M', city: 'Lahore', address: 'Model Town', email: 'aliraza@example.com', occupation: 'Job', income: 95000, employer: 'Tech Firm' })
  const u5 = await makeUser('03001110005', 'Ali Usman Chohan', { cnic: '35201-3336423-1', father: 'Usman Chohan', dob: '1988-11-02', gender: 'M', city: 'Lahore', address: 'DHA Phase 4', email: 'usman@example.com', occupation: 'Business', income: 150000, employer: 'Self' })
  console.log('[3] 5 users registered with KYC submissions')

  // KYC reviews: approve u1, u2, u4, u5; reject u3
  for (const u of [u1, u2, u4, u5]) {
    await api('/api/admin/kyc', { method: 'POST', body: { userId: (await userIdByPhone(u.phone)), status: 'APPROVED' } }, admin)
  }
  const u3id = await userIdByPhone(u3.phone)
  await api('/api/admin/kyc', { method: 'POST', body: { userId: u3id, status: 'REJECTED', note: 'Blurry / unclear photo' } }, admin)
  console.log('[4] KYC: 4 approved, 1 rejected (Maryam)')

  async function userIdByPhone(phone) {
    const res = await api('/api/admin/users', {}, admin)
    return res.users.find((u) => u.phone === phone)?.id
  }

  // Loans for u1 (rejected DP), u2 (pending DP proof), u4 (full flow to withdrawal + paid), u5 (installments in progress)
  async function applyLoan(u, amount) {
    const sel = await api('/api/loan/select', { method: 'POST', body: { amount } }, u.token)
    const loan = sel.loan
    await api('/api/loan/withdrawal-account', {
      method: 'POST',
      body: { loanId: loan.id, method: 'EasyPaisa', accountTitle: u.name, accountNumber: u.phone },
    }, u.token)
    const proof = await uploadImage(u.token, 'downpayment-proof.png')
    await api('/api/loan/downpayment', { method: 'POST', body: { loanId: loan.id, proofImage: proof } }, u.token)
    return loan.id
  }

  const l1 = await applyLoan(u1, 8000) // will reject DP
  const l2 = await applyLoan(u2, 14000) // pending DP
  const l4 = await applyLoan(u4, 8000) // full flow
  const l5 = await applyLoan(u5, 24000) // dp approved, inst1 pending proof
  console.log('[5] 4 loans applied with downpayment proofs')

  // Reject l1 downpayment
  await api('/api/admin/reject-downpayment', { method: 'POST', body: { loanId: l1, note: 'Not a valid payment receipt' } }, admin)

  // Approve l2, l4, l5 downpayments
  for (const l of [l2, l4, l5]) {
    await api('/api/admin/approve-downpayment', { method: 'POST', body: { loanId: l } }, admin)
  }
  console.log('[6] downpayments: 1 rejected, 3 approved (installments created)')

  async function payInstallment(u, loan, instNum) {
    const res = await api('/api/loan/select', {}, u.token)
    const loanFull = res.loans.find((x) => x.id === loan)
    const inst = loanFull.installments.find((i) => i.installmentNumber === instNum)
    const proof = await uploadImage(u.token, `installment-${instNum}.png`)
    await api('/api/loan/installment', { method: 'POST', body: { loanId: loan, installmentId: inst.id, proofImage: proof } }, u.token)
    return inst.id
  }

  // u4: pay inst1 → admin confirms (unlocks withdrawal) → pay inst2 (stays pending proof)
  const i4a = await payInstallment(u4, l4, 1)
  // u5: pay inst1 → stays pending (admin not confirmed yet)
  const i5a = await payInstallment(u5, l5, 1)
  console.log('[7] installment proofs uploaded: 2 pending confirm')

  // Confirm u4 inst1 → ACTIVE + withdrawal unlocked
  await api('/api/admin/confirm-installment', { method: 'POST', body: { installmentId: i4a } }, admin)
  console.log('[8] installment #1 of Ali Raza confirmed — withdrawal request now PENDING')

  // u4 pays installment #2 (proof pending review)
  await payInstallment(u4, l4, 2)
  console.log('[8b] installment #2 proof uploaded (pending)')

  // Mark u4 withdrawal paid with txn id (directly via admin API)
  await api('/api/admin/withdrawals', { method: 'PATCH', body: { id: l4, action: 'mark_paid', txnId: 'TXN998877' } }, admin)
  console.log('[9] withdrawal marked PAID with TXN998877')

  const stats = await api('/api/admin/stats', {}, admin)
  console.log('[10] stats:', JSON.stringify(stats))
  console.log('DONE ✅')
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message)
  process.exit(1)
})
