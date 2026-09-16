import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromReq } from '@/lib/session'

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.fullName || !body.cnic || !body.city || !body.address) {
    return NextResponse.json({ error: 'Missing required fields: fullName, cnic, city, address' }, { status: 400 })
  }
  if (!body.occupation || !['Job', 'Business'].includes(body.occupation)) {
    return NextResponse.json({ error: 'Occupation must be Job or Business' }, { status: 400 })
  }
  if (!body.monthlyIncome || body.monthlyIncome < 5000) {
    return NextResponse.json({ error: 'Monthly income must be at least PKR 5,000' }, { status: 400 })
  }

  if (body.cnicFrontImage && typeof body.cnicFrontImage !== 'string') {
    return NextResponse.json({ error: 'cnicFrontImage must be a string URL' }, { status: 400 })
  }
  if (body.cnicBackImage && typeof body.cnicBackImage !== 'string') {
    return NextResponse.json({ error: 'cnicBackImage must be a string URL' }, { status: 400 })
  }
  if (body.selfieImage && typeof body.selfieImage !== 'string') {
    return NextResponse.json({ error: 'selfieImage must be a string URL' }, { status: 400 })
  }

  const existing = await db.kyc.findUnique({ where: { userId: user.id } })
  const isResubmit = !!existing && (existing.cnicFrontImage || existing.cnicBackImage || existing.selfieImage)

  const data = {
    fullName: body.fullName,
    cnic: body.cnic,
    fatherName: body.fatherName || null,
    dob: body.dob || null,
    education: body.education || null,
    maritalStatus: body.maritalStatus || null,
    gender: body.gender || null,
    city: body.city,
    address: body.address,
    email: body.email || null,
    occupation: body.occupation,
    monthlyIncome: Number(body.monthlyIncome),
    employerName: body.employerName || null,
    hasExistingLoan: !!body.hasExistingLoan,
    existingLoanAmount: body.existingLoanAmount ? Number(body.existingLoanAmount) : null,
    existingLoanSource: body.existingLoanSource || null,
    referenceName: body.referenceName || null,
    referencePhone: body.referencePhone || null,
    referenceRelation: body.referenceRelation || null,
    cnicFrontImage: body.cnicFrontImage || existing?.cnicFrontImage || null,
    cnicBackImage: body.cnicBackImage || existing?.cnicBackImage || null,
    selfieImage: body.selfieImage || existing?.selfieImage || null,
    // Re-submitting with document images resets verification to PENDING
    kycStatus: body.cnicFrontImage || body.cnicBackImage || body.selfieImage ? 'PENDING' : (existing?.kycStatus || 'PENDING'),
    kycReviewedAt: isResubmit ? null : existing?.kycReviewedAt || null,
    kycAdminNote: isResubmit ? null : existing?.kycAdminNote || null,
  }

  const kyc = await db.kyc.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  })

  await db.user.update({ where: { id: user.id }, data: { name: body.fullName } })

  return NextResponse.json({ ok: true, kyc })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const kyc = await db.kyc.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ kyc })
}
