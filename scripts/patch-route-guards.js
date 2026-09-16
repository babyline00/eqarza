/* eslint-disable */
// One-off codemod: adds permission guards to admin API routes.
// Module routes get hasPerm(admin, '<module>'); config routes become super-admin-only.
const fs = require('fs')
const path = require('path')

const API = '/home/z/my-project/src/app/api/admin'

const MODULE_ROUTES = {
  users: 'users',
  kyc: 'kyc',
  withdrawals: 'withdrawals',
  loans: 'loans',
  'approve-downpayment': 'payments',
  'reject-downpayment': 'payments',
  'confirm-installment': 'payments',
  'reject-installment': 'payments',
}

const SUPER_ROUTES = ['settings', 'bank-details', 'videos', 'app-upload', 'activity', 'change-password']

const IMPORT_RE = /import \{ getAdminFromReq(?:, \w+)? \} from '@\/lib\/session'/
const GUARD_RE = /^(\s*)if \(!admin\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/gm

function patch(file, kind, mod) {
  const p = path.join(API, file, 'route.ts')
  if (!fs.existsSync(p)) {
    console.log('SKIP (missing):', file)
    return
  }
  let src = fs.readFileSync(p, 'utf8')
  if (src.includes('hasPerm(admin') || src.includes('isSuperAdmin(admin')) {
    console.log('SKIP (already patched):', file)
    return
  }
  const importName = kind === 'module' ? 'hasPerm' : 'isSuperAdmin'
  src = src.replace(IMPORT_RE, `import { getAdminFromReq, ${importName} } from '@/lib/session'`)

  const extra =
    kind === 'module'
      ? `$1if (!hasPerm(admin, '${mod}')) return NextResponse.json({ error: 'You do not have permission for this section' }, { status: 403 })`
      : `$1if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })`

  const count = [...src.matchAll(GUARD_RE)].length
  src = src.replace(GUARD_RE, `$&\n${extra.replace(/\$1/g, '$1')}`)
  fs.writeFileSync(p, src)
  console.log(`PATCHED ${file}: ${count} guard(s) +${kind}:${kind === 'module' ? mod : 'super'}`)
}

for (const [file, mod] of Object.entries(MODULE_ROUTES)) patch(file, 'module', mod)
for (const file of SUPER_ROUTES) patch(file, 'super')
console.log('done')
