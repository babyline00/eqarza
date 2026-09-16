// SMS/WhatsApp OTP delivery helpers (matrixsender.com only).
//   SMS       GET {site}/api/send/sms?secret=&mode=credits|devices&gateway/device=&phone=&message=
//   WhatsApp  GET {site}/api/send/whatsapp?secret=&account=&type=text&recipient=&message=
//
// Delivery channel is configurable ('sms' | 'whatsapp' | 'both') and OTP delivery can be
// disabled entirely (admin "OTP delivery" toggle + DEMO_MODE). See getSmsConfig().
//
// Config resolution order per field: DB Setting (admin-editable) -> environment variable -> built-in default.

export interface SmsSendResult {
  ok: boolean
  provider: 'matrixsender' | 'whatsapp'
  response?: string
  error?: string
}

export interface MatrixSenderConfig {
  endpoint: string
  secret: string
  mode: 'credits' | 'devices'
  gateway: string
  device: string
  sim: string
  account: string
}

// Convert local format 03XXXXXXXXX -> international 923XXXXXXXXX
export function normalizeMobile(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('92') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 11) return '92' + digits.slice(1)
  return '92' + digits
}

export function buildOtpMessage(otp: string): string {
  return `Dear customer, your E-Qarza verification OTP is ${otp}. It is valid for 5 minutes. Do not share it with anyone.`
}

function classifyMatrixSenderResponse(res: Response, text: string): boolean {
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    // non-JSON response
  }

  if (json) {
    const statusRaw = json.status?.toString() ?? ''
    const statusLower = statusRaw.toLowerCase()
    const numericStatus = Number(statusRaw)
    const err = json.error
    const failedNamed = ['error', 'failed', 'invalid', 'denied', 'forbidden'].includes(statusLower)
    const failedNumeric =
      (json.success === false || json.data === false || json.ok === false) ||
      (numericStatus > 0 && numericStatus !== 200 && numericStatus !== 201)
    return (
      res.ok && !failedNamed && !failedNumeric && (err === undefined || err === null || err === '')
    )
  }
  return res.ok && !/error|failed|denied|invalid/i.test(text)
}

function waEndpoint(smsEndpoint: string): string {
  return smsEndpoint.replace(/\/api\/send\/sms$/, '/api/send/whatsapp')
}

// matrixsender SMS: GET + query params.
//   secret, mode (credits|devices), phone, message
//   + gateway (credits) or device (+sim, devices)
export async function sendViaMatrixSender(phone: string, message: string, cfg: MatrixSenderConfig): Promise<SmsSendResult> {
  if (!cfg.secret) {
    return { ok: false, provider: 'matrixsender', error: 'MatrixSender API secret not configured' }
  }

  const params: Record<string, string> = {
    secret: cfg.secret,
    mode: cfg.mode,
    phone: normalizeMobile(phone),
    message,
  }
  if (cfg.mode === 'credits') {
    if (!cfg.gateway) {
      return { ok: false, provider: 'matrixsender', error: 'MatrixSender gateway not configured (credits mode)' }
    }
    params.gateway = cfg.gateway
  } else {
    if (!cfg.device) {
      return { ok: false, provider: 'matrixsender', error: 'MatrixSender device not configured (devices mode)' }
    }
    params.device = cfg.device
    params.sim = cfg.sim || '1'
  }

  const qs = new URLSearchParams(params).toString()
  const url = `${cfg.endpoint.replace(/\/+$/, '')}?${qs}`

  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) })
    const text = await res.text()
    return { ok: classifyMatrixSenderResponse(res, text), provider: 'matrixsender', response: text }
  } catch (e: any) {
    return { ok: false, provider: 'matrixsender', error: e?.message || 'SMS request failed' }
  }
}

// matrixsender WhatsApp: GET + query params.
//   secret, account (linked WhatsApp number), type=text, recipient, message
export async function sendViaWAMatrixSender(phone: string, message: string, cfg: MatrixSenderConfig): Promise<SmsSendResult> {
  if (!cfg.secret) {
    return { ok: false, provider: 'whatsapp', error: 'MatrixSender API secret not configured' }
  }
  if (!cfg.account) {
    return { ok: false, provider: 'whatsapp', error: 'MatrixSender WhatsApp account not configured' }
  }

  const params: Record<string, string> = {
    secret: cfg.secret,
    account: cfg.account,
    type: 'text',
    recipient: normalizeMobile(phone),
    message,
  }
  const qs = new URLSearchParams(params).toString()
  const url = `${waEndpoint(cfg.endpoint)}?${qs}`

  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) })
    const text = await res.text()
    return { ok: classifyMatrixSenderResponse(res, text), provider: 'whatsapp', response: text }
  } catch (e: any) {
    return { ok: false, provider: 'whatsapp', error: e?.message || 'WhatsApp request failed' }
  }
}

// Deliver OTP using the configured channel:
//   'whatsapp' -> WhatsApp -> (on failure) SMS
//   'sms'      -> SMS only
//   'both'     -> WhatsApp + SMS in parallel; success if ANY succeeds.
export async function sendOtpSms(phone: string, otp: string): Promise<SmsSendResult> {
  const { getSmsConfig } = await import('@/lib/settings')
  const config = await getSmsConfig()
  const message = buildOtpMessage(otp)
  const results: SmsSendResult[] = []

  if (config.channel === 'whatsapp' || config.channel === 'both') {
    const wa = await sendViaWAMatrixSender(phone, message, config.matrixsender)
    results.push(wa)
  }

  if (config.channel === 'sms' || config.channel === 'both' || !results.some((r) => r.ok)) {
    results.push(await sendViaMatrixSender(phone, message, config.matrixsender))
  }

  const ok = results.find((r) => r.ok)
  if (ok) return ok

  console.log(
    `[sms] all providers failed for channel=${config.channel}: ` +
      results.map((r) => `${r.provider} (${r.error || r.response})`).join('; ')
  )
  return {
    ok: false,
    provider: 'matrixsender',
    error: results.map((r) => `${r.provider}: ${r.error || r.response}`).join('. '),
  }
}

// Probe each gateway independently (no fallback) so the admin "send test message"
// screen can show exactly what each provider returned.
export async function probeSms(
  phone: string,
  message: string,
  overrides?: { matrixsender?: Partial<MatrixSenderConfig> }
): Promise<{ whatsapp: SmsSendResult; matrixsender: SmsSendResult }> {
  const { getSmsConfig } = await import('@/lib/settings')
  const config = await getSmsConfig()
  const matrix = { ...config.matrixsender, ...(overrides?.matrixsender ?? {}) }
  const [wa, sms] = await Promise.all([
    sendViaWAMatrixSender(phone, message, matrix),
    sendViaMatrixSender(phone, message, matrix),
  ])
  return { whatsapp: wa, matrixsender: sms }
}