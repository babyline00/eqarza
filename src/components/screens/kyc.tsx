'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth, api, uploadFile, validateImageFile, pickFirstImage } from '@/lib/store'
import { playNotificationSound } from '@/lib/notification-sound'
import { PhoneFrame, ScreenHeader } from '@/components/phone-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  ChevronRight,
  Check,
  User,
  FileText,
  Camera,
  X,
  IdCard,
  Loader2,
} from 'lucide-react'

const PAKISTANI_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan',
  'Peshawar', 'Quetta', 'Hyderabad', 'Sialkot', 'Gujranwala', 'Bahawalpur',
  'Sargodha', 'Sukkur', 'Mardan', 'Mingora', 'Sheikhupura', 'Mandi Bahauddin',
  'Other',
]

const EDUCATION_OPTIONS = ['Matriculation', 'Intermediate', 'Bachelor\'s', 'Master\'s', 'MPhil / PhD', 'Other']
const MARITAL_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed']
const GENDER_OPTIONS = ['Male', 'Female', 'Other']

type DocImage = string | null

export function KycScreen() {
  const { setView } = useAuth()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(true)
  const [kycStatus, setKycStatus] = useState('')

  // Form state
  const [fullName, setFullName] = useState('')
  const [cnic, setCnic] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [dob, setDob] = useState('')
  const [education, setEducation] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [gender, setGender] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [occupation, setOccupation] = useState<'Job' | 'Business' | ''>('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [employerName, setEmployerName] = useState('')
  const [hasExistingLoan, setHasExistingLoan] = useState<'yes' | 'no' | ''>('')
  const [existingLoanAmount, setExistingLoanAmount] = useState<number | ''>('')
  const [existingLoanSource, setExistingLoanSource] = useState('')
  const [referenceName, setReferenceName] = useState('')
  const [referencePhone, setReferencePhone] = useState('')
  const [referenceRelation, setReferenceRelation] = useState('')

  // Document images
  const [cnicFrontImage, setCnicFrontImage] = useState<DocImage>(null)
  const [cnicBackImage, setCnicBackImage] = useState<DocImage>(null)
  const [selfieImage, setSelfieImage] = useState<DocImage>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  // Last-seen KYC status (undefined until prefill completes) — used to detect
  // live decisions made by the admin on the KYC Review screen
  const kycStatusRef = useRef<string | null | undefined>(undefined)

  // Prefill existing KYC data on mount
  useEffect(() => {
    api('/api/user/kyc')
      .then((res) => {
        const k = res.kyc
        kycStatusRef.current = k?.kycStatus || null
        if (!k) return
        setKycStatus(k.kycStatus || '')
        setFullName(k.fullName || '')
        setCnic(k.cnic || '')
        setFatherName(k.fatherName || '')
        setDob(k.dob || '')
        setEducation(k.education || '')
        setMaritalStatus(k.maritalStatus || '')
        setGender(k.gender || '')
        setCity(k.city || '')
        setAddress(k.address || '')
        setEmail(k.email || '')
        setOccupation(k.occupation || '')
        setMonthlyIncome(k.monthlyIncome ? String(k.monthlyIncome) : '')
        setEmployerName(k.employerName || '')
        setHasExistingLoan(k.hasExistingLoan ? 'yes' : 'no')
        setExistingLoanAmount(k.existingLoanAmount || '')
        setExistingLoanSource(k.existingLoanSource || '')
        setReferenceName(k.referenceName || '')
        setReferencePhone(k.referencePhone || '')
        setReferenceRelation(k.referenceRelation || '')
        setCnicFrontImage(k.cnicFrontImage || null)
        setCnicBackImage(k.cnicBackImage || null)
        setSelfieImage(k.selfieImage || null)
      })
      .catch((e) => {
        if (!e.message.includes('Unauthorized')) {
          toast({ title: 'Error', description: e.message, variant: 'destructive' })
        }
      })
      .finally(() => setPrefillLoading(false))
  }, [])

  // Live auto-refresh: when the admin responds on the KYC Review screen
  // (approve / reject / delete case), this screen updates itself without any
  // manual refresh. Only kycStatus is touched — never the form fields the
  // user may be editing.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || loading) return
      api('/api/user/kyc')
        .then((res) => {
          const k = res.kyc
          const next = k?.kycStatus || null
          const prev = kycStatusRef.current
          if (prev === undefined || next === prev) return
          kycStatusRef.current = next
          if (next === 'APPROVED') {
            playNotificationSound('loan')
            setKycStatus('APPROVED') // switches to the verified screen instantly
            toast({ title: 'KYC Approved! 🎉', description: 'Your documents were verified. You can now apply for a loan.' })
          } else if (next === 'REJECTED') {
            playNotificationSound('other')
            setKycStatus('REJECTED')
            toast({
              title: 'KYC needs attention',
              description: k?.kycAdminNote || 'Please re-upload clearer documents.',
              variant: 'destructive',
            })
          } else if (next === null && prev) {
            playNotificationSound('other')
            toast({ title: 'KYC case removed', description: 'Your submission was removed by our team. Please submit your documents again.' })
          }
        })
        .catch(() => {
          // silent — transient poll failures must not spam the user
        })
    }, 8000)
    return () => clearInterval(id)
  }, [loading])

  const steps = [
    { icon: User, title: 'Personal Information' },
    { icon: IdCard, title: 'Details & Documents' },
    { icon: FileText, title: 'Reference' },
  ]

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0:
        if (!fullName.trim()) return 'Full name is required'
        if (!fatherName.trim()) return 'Father\'s name is required'
        if (!/^\d{5}-\d{7}-\d$/.test(cnic)) return 'CNIC must be in format XXXXX-XXXXXXX-X'
        if (!city) return 'Please select your city'
        if (!address.trim()) return 'Address is required'
        if (!cnicFrontImage) return 'Please upload the front side of your CNIC'
        if (!cnicBackImage) return 'Please upload the back side of your CNIC'
        if (!selfieImage) return 'Please upload a clear selfie'
        return null
      case 1:
        if (!gender) return 'Please select your gender'
        if (!occupation) return 'Please select your occupation'
        if (!monthlyIncome || Number(monthlyIncome) < 5000) return 'Monthly income must be at least PKR 5,000'
        if (occupation === 'Job' && !employerName.trim()) return 'Employer name is required for job holders'
        if (!hasExistingLoan) return 'Please answer this question'
        if (hasExistingLoan === 'yes' && !existingLoanAmount) return 'Please select your existing loan amount'
        if (hasExistingLoan === 'yes' && !existingLoanSource.trim()) return 'Please tell us where you took the loan'
        return null
      case 2:
        if (!referenceName.trim()) return 'Reference name is required'
        if (!/^03\d{9}$/.test(referencePhone)) return 'Reference phone must be 03XXXXXXXXX'
        if (!referenceRelation.trim()) return 'Relationship is required'
        return null
    }
    return null
  }

  const next = () => {
    const err = validateStep(step)
    if (err) {
      toast({ title: 'Validation', description: err, variant: 'destructive' })
      return
    }
    if (step < steps.length - 1) setStep(step + 1)
  }

  const prev = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleImageUpload = async (key: string, file: File | null) => {
    if (!file) return
    const errMsg = validateImageFile(file)
    if (errMsg) {
      toast({ title: 'Invalid file', description: errMsg, variant: 'destructive' })
      return
    }
    setUploadingKey(key)
    try {
      const url = await uploadFile(file)
      if (key === 'cnicFront') setCnicFrontImage(url)
      else if (key === 'cnicBack') setCnicBackImage(url)
      else if (key === 'selfie') setSelfieImage(url)
      toast({ title: 'Uploaded!', description: 'Image uploaded successfully' })
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' })
    } finally {
      setUploadingKey(null)
    }
  }

  const submit = async () => {
    const err = validateStep(2)
    if (err) {
      toast({ title: 'Validation', description: err, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await api('/api/user/kyc', {
        method: 'POST',
        body: {
          fullName,
          cnic,
          fatherName,
          dob,
          education,
          maritalStatus,
          gender,
          city,
          address,
          email,
          occupation,
          monthlyIncome: Number(monthlyIncome),
          employerName,
          hasExistingLoan: hasExistingLoan === 'yes',
          existingLoanAmount: hasExistingLoan === 'yes' ? existingLoanAmount : null,
          existingLoanSource: hasExistingLoan === 'yes' ? existingLoanSource : null,
          referenceName,
          referencePhone,
          referenceRelation,
          cnicFrontImage,
          cnicBackImage,
          selfieImage,
        },
      })
      toast({ title: 'KYC Submitted!', description: 'Your documents are pending admin verification.' })
      setView('dashboard')
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const formatCnic = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '').slice(0, 13)
    let result = digits
    if (digits.length > 5) result = digits.slice(0, 5) + '-' + digits.slice(5)
    if (digits.length > 12) result = digits.slice(0, 5) + '-' + digits.slice(5, 12) + '-' + digits.slice(12)
    return result
  }

  if (prefillLoading) {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="Complete Your KYC" onBack={() => setView('dashboard')} />
        <div className="p-6 flex flex-col items-center justify-center py-20 text-emerald-600">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm animate-pulse">Loading your information...</p>
        </div>
      </PhoneFrame>
    )
  }

  if (kycStatus === 'APPROVED') {
    return (
      <PhoneFrame showBottomNav={false}>
        <ScreenHeader title="KYC Verification" onBack={() => setView('dashboard')} />
        <div className="p-6">
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-emerald-800">KYC Verified</h3>
            <p className="text-sm text-emerald-700 mt-1">
              Your identity documents have already been approved. No need to submit again — you can now apply for a
              loan.
            </p>
            <Button
              onClick={() => setView('eligibility')}
              className="w-full mt-4 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              Apply for Loan
            </Button>
          </div>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame showBottomNav={false}>
      <ScreenHeader title="Complete Your KYC" onBack={() => (step === 0 ? setView('dashboard') : prev())} />

      {/* Progress */}
      <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-emerald-700">
            Step {step + 1} of {steps.length}
          </p>
          <p className="text-xs font-semibold text-emerald-800">{steps[step].title}</p>
        </div>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-emerald-600' : i === step ? 'bg-amber-400' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-5 pb-24">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Full Name (as per CNIC)" required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ahmed Raza Khan" />
            </Field>
            <Field label="Father's Name" required>
              <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's full name" />
            </Field>
            <Field label="Date of Birth" required>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>

            <Field label="CNIC Number" required>
              <Input
                value={cnic}
                onChange={(e) => setCnic(formatCnic(e.target.value))}
                placeholder="XXXXX-XXXXXXX-X"
                maxLength={15}
              />
            </Field>

            <Field label="City" required>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue placeholder="Select your city" /></SelectTrigger>
                <SelectContent>
                  {PAKISTANI_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Present Address" required>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House #, Street, Area" />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
              📷 Please take clear photos of your <span className="font-bold">CNIC (front & back)</span> and a recent{' '}
              <span className="font-bold">selfie</span>. Blurry or illegible images will be rejected.
              <p className="mt-1.5 text-purple-700" dir="rtl">
                📷 براہِ کرم اپنی شناختی کارڈ اور سیلفی کی واضح تصاویر لیں
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
            <ImageUploadCard
              title="CNIC Front"
              subtitle="Photo & name side"
              image={cnicFrontImage}
              uploading={uploadingKey === 'cnicFront'}
              capture="environment"
              onFile={(f) => handleImageUpload('cnicFront', f)}
              onRemove={() => setCnicFrontImage(null)}
            />

            <ImageUploadCard
              title="CNIC Back"
              subtitle="Address side"
              image={cnicBackImage}
              uploading={uploadingKey === 'cnicBack'}
              capture="environment"
              onFile={(f) => handleImageUpload('cnicBack', f)}
              onRemove={() => setCnicBackImage(null)}
            />
          </div>

            <ImageUploadCard
              title="Selfie"
              subtitle="A clear photo of your face"
              image={selfieImage}
              uploading={uploadingKey === 'selfie'}
              capture="user"
              onFile={(f) => handleImageUpload('selfie', f)}
              onRemove={() => setSelfieImage(null)}
            />


          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            



            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">More Details</p>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Gender" required>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>{GENDER_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Education">
                  <Select value={education} onValueChange={setEducation}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{EDUCATION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Marital Status">
                  <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{MARITAL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">Employment & Income</p>
              <div className="space-y-4">
                <Field label="What is your source of income?" required>
                  <RadioGroup value={occupation} onValueChange={(v) => setOccupation(v as 'Job' | 'Business')}>
                    <div className="grid grid-cols-1 gap-3">
                      <RadioCard value="Job" label="Job" desc="Salaried employee" />
                      <RadioCard value="Business" label="Business" desc="Self-employed" />
                    </div>
                  </RadioGroup>
                </Field>

                {(occupation === 'Job' || occupation === 'Business') && (
                  <Field label={occupation === 'Job' ? 'Your Monthly Salary (PKR)' : 'Your Monthly Income (PKR)'} required>
                    <Input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      placeholder="e.g. 45000"
                    />
                    <p className="text-xs text-slate-500 mt-1">Minimum PKR 5,000 required</p>
                  </Field>
                )}

                {occupation === 'Job' && (
                  <Field label="Employer / Company Name" required>
                    <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder="Company name" />
                  </Field>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              ℹ️ This helps us determine your eligibility. Be honest — false information may lead to loan rejection.
            </div>
            <Field label="Have you taken a loan before from another app or JazzCash/EasyPaisa?" required>
              <RadioGroup value={hasExistingLoan} onValueChange={(v) => setHasExistingLoan(v as 'yes' | 'no')}>
                <div className="grid grid-cols-1 gap-3">
                  <RadioCard value="yes" label="Yes" desc="I have an active loan" />
                  <RadioCard value="no" label="No" desc="No existing loan" />
                </div>
              </RadioGroup>
            </Field>

            {hasExistingLoan === 'yes' && (
              <>
                <Field label="How much loan did you take?" required>
                  <RadioGroup
                    value={existingLoanAmount?.toString() || ''}
                    onValueChange={(v) => setExistingLoanAmount(Number(v))}
                  >
                    <div className="grid grid-cols-1 gap-2">
                      {['4000', '8000', '12000', '21000'].map(amt => (
                        <label
                          key={amt}
                          className={`flex items-center gap-2 border-2 rounded-xl p-3 cursor-pointer transition-colors ${
                            existingLoanAmount === Number(amt)
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <RadioGroupItem value={amt} id={`amt-${amt}`} />
                          <span className="text-sm font-semibold">Rs. {Number(amt).toLocaleString()}</span>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </Field>
                <Field label="From which app/source?" required>
                  <Input
                    value={existingLoanSource}
                    onChange={(e) => setExistingLoanSource(e.target.value)}
                    placeholder="e.g. JazzCash, EasyPaisa, Aitemaad, QarzMitra..."
                  />
                </Field>
              </>
            )}


            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
              ✅ Once submitted, our team will verify your documents (usually within 1 hour).
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              👥 We need one reference person (family/friend) for verification purposes only.
            </div>
            <Field label="Reference Person Name" required>
              <Input value={referenceName} onChange={(e) => setReferenceName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Reference Phone Number" required>
              <Input
                value={referencePhone}
                onChange={(e) => setReferencePhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="03XXXXXXXXX"
                maxLength={11}
              />
            </Field>
            <Field label="Relationship" required>
              <Select value={referenceRelation} onValueChange={setReferenceRelation}>
                <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                <SelectContent>
                  {['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Friend', 'Colleague', 'Other'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex gap-2 pb-safe">
        {step > 0 && (
          <Button
            onClick={prev}
            variant="outline"
            className="flex-1 h-12 rounded-xl font-semibold"
          >
            Back
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button
            onClick={next}
            className="flex-[2] h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={loading}
            className="flex-[2] h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit KYC'}
            {!loading && <Check className="w-4 h-4 ml-1" />}
          </Button>
        )}
      </div>
    </PhoneFrame>
  )
}

function ImageUploadCard({
  title,
  subtitle,
  image,
  uploading,
  capture,
  onFile,
  onRemove,
}: {
  title: string
  subtitle: string
  image: string | null
  uploading: boolean
  capture?: 'user' | 'environment'
  onFile: (f: File) => void
  onRemove: () => void
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
        {title} <span className="text-red-500">*</span>
      </Label>
      {image ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
          <img src={image} alt={title} loading="lazy" decoding="async" className="w-full h-40 object-cover" />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600"
            aria-label="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
          <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            ✓ Uploaded
          </span>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
          <div className="text-center">
            {uploading ? (
              <p className="text-sm text-emerald-600 animate-pulse flex items-center justify-center">
                <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...
              </p>
            ) : (
              <>
                <Camera className="w-7 h-7 mx-auto text-slate-400 mb-1" />
                <p className="text-xs font-semibold text-slate-700">{capture ? 'Tap to open camera' : 'Tap to upload'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG up to 8MB</p>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            capture={capture}
            className="hidden"
            onChange={(e) => {
              const f = pickFirstImage(e)
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  )
}

function RadioCard({ value, label, desc }: { value: string; label: string; desc?: string }) {
  return (
    <label
      className={`flex flex-col items-start gap-0.5 border-2 rounded-xl p-3 cursor-pointer transition-colors ${
        'border-slate-200 hover:border-emerald-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50'
      }`}
    >
      <div className="flex items-center gap-2 w-full">
        <RadioGroupItem value={value} id={`r-${value}`} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {desc && <span className="text-[11px] text-slate-500 pl-6">{desc}</span>}
    </label>
  )
}
