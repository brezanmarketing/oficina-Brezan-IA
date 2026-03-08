# OFICINA DE IA — JARVIS
## Catálogo Completo de Drivers de Integración

> Guía completa para conectar todas las integraciones disponibles y darle acceso total a Jarvis

---

## Estado Actual

| Integración | Categoría | Estado | Jarvis puede... |
|---|---|---|---|
| OpenAI (GPT-4o) | Modelos IA | ✅ Operativa | Razonar, planificar, generar texto y código |
| Google Gemini | Modelos IA | ✅ Operativa | Tareas rápidas, documentos largos, búsqueda |
| Telegram | Comunicación | ✅ Operativa | Enviar/recibir mensajes, notificaciones |
| Gmail | Email | ⚠️ Driver pendiente | Nada todavía |
| Serper | Web y Búsqueda | ⚠️ Driver pendiente | Nada todavía |
| Stripe | Pagos | ⚠️ Driver pendiente | Nada todavía |
| Google Drive | Productividad | ⚠️ Driver pendiente | Nada todavía |
| Google Calendar | Productividad | ⚠️ Driver pendiente | Nada todavía |
| Slack | Comunicación | ⚠️ Driver pendiente | Nada todavía |
| WhatsApp | Comunicación | ⚠️ Driver pendiente | Nada todavía |
| Notion | Productividad | ⚠️ Driver pendiente | Nada todavía |
| Airtable | Productividad | ⚠️ Driver pendiente | Nada todavía |
| GitHub | Infraestructura | ⚠️ Driver pendiente | Nada todavía |
| Typeform | Web | ⚠️ Driver pendiente | Nada todavía |
| n8n | Automatización | ⚠️ Driver pendiente | Nada todavía |
| HubSpot | CRM | ⚠️ Driver pendiente | Nada todavía |
| ElevenLabs | Modelos IA | ⚠️ Driver pendiente | Nada todavía |
| Replicate | Modelos IA | ⚠️ Driver pendiente | Nada todavía |
| Zapier | Automatización | ⚠️ Driver pendiente | Nada todavía |
| Twilio | Comunicación | ⚠️ Driver pendiente | Nada todavía |

---

## Arquitectura del Sistema de Drivers

Todos los drivers siguen el mismo patrón. Esto garantiza que añadir una nueva integración siempre funciona de la misma manera.

```typescript
// PATRÓN UNIVERSAL
// /office/tools/integrations/{nombre}/{nombre}.ts

import { getCredential } from '@/office/tools/credential-manager'
import { logToolCall }   from '@/office/jarvis/phase4/audit-logger'

export const {nombre}Driver = {

  // 1. Verificación de conexión (usado por el panel)
  async verify(): Promise<VerifyResult> {
    try {
      const key = await getCredential('{id}', '{key_name}')
      const res = await fetch('{verify_endpoint}', {
        headers: { Authorization: `Bearer ${key}` }
      })
      return { ok: res.ok, latency_ms: X }
    } catch(e) {
      return { ok: false, error: e.message }
    }
  },

  // 2. Funciones de negocio
  async functionName(params): Promise<r> {
    const key = await getCredential('{id}', '{key_name}')
    // llamada a la API...
    await logToolCall('jarvis', '{nombre}', params, result, ms)
    return result
  },

  // 3. Descripción para Jarvis (inyectada en system prompt)
  description: `
    Tool: {nombre}
    Cuando usar: [descripción de casos de uso]
    Funciones disponibles:
    - functionName(param): descripción
  `
}

// Registro en tool-registry.ts
// toolRegistry.register('{nombre}', {nombre}Driver)
```

### Prompt Maestro para Antigravity — Instalar todos los drivers

```
Necesito implementar el sistema de drivers de integración
para que Jarvis pueda usar todas las integraciones del panel.

ESTRUCTURA A CREAR:
/office/tools/integrations/
  gmail/gmail.ts
  serper/serper.ts
  stripe/stripe.ts
  google-drive/google-drive.ts
  google-calendar/google-calendar.ts
  slack/slack.ts
  whatsapp/whatsapp.ts
  notion/notion.ts
  airtable/airtable.ts
  github/github.ts
  typeform/typeform.ts
  n8n/n8n.ts
  hubspot/hubspot.ts
  elevenlabs/elevenlabs.ts
  replicate/replicate.ts
  index.ts  ← exporta todos los drivers

REGLAS para cada driver:
1. Leer credenciales SIEMPRE con getCredential()
2. Si no hay credencial → throw con mensaje:
   '{Nombre} no conectado. Añádelo en Conexiones API.'
3. Registrar cada llamada en audit_log
4. Exportar objeto con: verify(), funciones, y description
5. Manejar errores de API con mensajes claros

ACTUALIZAR tool-registry.ts:
Registrar todos los drivers nuevos.
Jarvis debe poder llamar a cualquier función así:
  await toolRegistry.execute('stripe.createPaymentLink', params)
  await toolRegistry.execute('drive.uploadFile', params)

ACTUALIZAR system prompt de Jarvis:
Añadir sección 'INTEGRACIONES DISPONIBLES' con la
descripción de cada driver para que Jarvis sepa
cuándo y cómo usar cada integración.

Implementar en este orden (de mayor a menor prioridad):
1. Gmail         6. WhatsApp    11. n8n
2. Serper        7. Notion      12. HubSpot
3. Stripe        8. Airtable    13. ElevenLabs
4. Google Drive  9. GitHub      14. Replicate
5. Google Cal   10. Typeform
```

---

## Tier 1 — Drivers Críticos

### 📧 Gmail — Email corporativo

**Credenciales:** Client ID / Client Secret / Refresh Token

**Cómo obtenerlas:** `console.cloud.google.com` → APIs → Gmail API → Habilitar → Credenciales → OAuth 2.0. Refresh Token via OAuth Playground con scope `gmail.modify`.

```typescript
// /office/tools/integrations/gmail/gmail.ts
import { google } from 'googleapis'

async function getClient() {
  const clientId     = await getCredential('gmail', 'Client ID')
  const clientSecret = await getCredential('gmail', 'Client Secret')
  const refreshToken = await getCredential('gmail', 'Refresh Token')
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

export const gmailDriver = {

  async verify() {
    const gmail = await getClient()
    const res = await gmail.users.getProfile({ userId: 'me' })
    return { ok: true, email: res.data.emailAddress }
  },

  async sendEmail(to: string, subject: string, body: string) {
    const gmail = await getClient()
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].join('\n')
    const encoded = Buffer.from(message).toString('base64url')
    return gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded }
    })
  },

  async listUnread(limit = 10) {
    const gmail = await getClient()
    const res = await gmail.users.messages.list({
      userId: 'me', q: 'is:unread', maxResults: limit
    })
    return res.data.messages || []
  },

  async searchEmails(query: string) {
    const gmail = await getClient()
    const res = await gmail.users.messages.list({
      userId: 'me', q: query, maxResults: 20
    })
    return res.data.messages || []
  },

  async replyToEmail(threadId: string, to: string, body: string) {
    const gmail = await getClient()
    const message = [
      `To: ${to}`,
      `In-Reply-To: ${threadId}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].join('\n')
    const encoded = Buffer.from(message).toString('base64url')
    return gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, threadId }
    })
  },

  description: `
    Tool: gmail
    Cuando usar: enviar emails, leer bandeja, responder clientes
    - sendEmail(to, subject, body): enviar email
    - listUnread(limit): emails sin leer
    - searchEmails(query): buscar emails
    - replyToEmail(threadId, to, body): responder hilo
  `
}
```

---

### 🔍 Serper — Búsqueda en Google en tiempo real

**Credenciales:** API Key

**Cómo obtenerla:** `serper.dev` → Dashboard → API Key. Plan gratuito: 2500 búsquedas/mes.

```typescript
// /office/tools/integrations/serper/serper.ts

async function getKey() {
  return getCredential('serper', 'API Key')
}

export const serperDriver = {

  async verify() {
    const key = await getKey()
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'test', num: 1 })
    })
    return { ok: res.ok }
  },

  async search(query: string, limit = 10) {
    const key = await getKey()
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: limit })
    })
    const data = await res.json()
    return data.organic || []
  },

  async searchNews(query: string) {
    const key = await getKey()
    const res = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 })
    })
    const data = await res.json()
    return data.news || []
  },

  description: `
    Tool: serper
    Cuando usar: buscar información actualizada en Google
    - search(query, limit): búsqueda general
    - searchNews(query): noticias recientes
  `
}
```

---

### 💳 Stripe — Pagos, facturas y suscripciones

**Credenciales:** Secret Key / Webhook Secret

**Cómo obtenerlas:** `dashboard.stripe.com` → Developers → API Keys → Secret Key.

```typescript
// /office/tools/integrations/stripe/stripe.ts
import Stripe from 'stripe'

async function getClient() {
  const key = await getCredential('stripe', 'Secret Key')
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

export const stripeDriver = {

  async verify() {
    const s = await getClient()
    const balance = await s.balance.retrieve()
    return { ok: true, currency: balance.available[0]?.currency }
  },

  async createPaymentLink(amount_eur: number, description: string) {
    const s = await getClient()
    const product = await s.products.create({ name: description })
    const price = await s.prices.create({
      product: product.id,
      unit_amount: Math.round(amount_eur * 100),
      currency: 'eur'
    })
    const link = await s.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }]
    })
    return { url: link.url, id: link.id }
  },

  async getMonthlyRevenue() {
    const s = await getClient()
    const start = Math.floor(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
    )
    const charges = await s.charges.list({ created: { gte: start }, limit: 100 })
    const total = charges.data
      .filter(c => c.paid)
      .reduce((sum, c) => sum + c.amount, 0) / 100
    return { total_eur: total, count: charges.data.length }
  },

  async createInvoice(customer_email: string, items: { description: string, amount: number }[]) {
    const s = await getClient()
    let customers = await s.customers.list({ email: customer_email })
    let customer = customers.data[0]
    if (!customer) customer = await s.customers.create({ email: customer_email })
    for (const item of items) {
      await s.invoiceItems.create({
        customer: customer.id,
        amount: Math.round(item.amount * 100),
        currency: 'eur',
        description: item.description
      })
    }
    const invoice = await s.invoices.create({ customer: customer.id, auto_advance: true })
    await s.invoices.finalizeInvoice(invoice.id)
    return { invoice_url: invoice.hosted_invoice_url }
  },

  async listRecentPayments(limit = 10) {
    const s = await getClient()
    const charges = await s.charges.list({ limit })
    return charges.data.map(c => ({
      amount_eur: c.amount / 100,
      description: c.description,
      paid: c.paid,
      date: new Date(c.created * 1000).toISOString()
    }))
  },

  description: `
    Tool: stripe
    Cuando usar: cobros, pagos, facturas, ingresos
    - createPaymentLink(amount_eur, description): crea link de pago
    - getMonthlyRevenue(): ingresos del mes actual
    - createInvoice(email, items): genera y envía factura
    - listRecentPayments(limit): últimos pagos recibidos
  `
}
```

---

### 📁 Google Drive — Almacenamiento en la nube

**Credenciales:** Client ID / Client Secret / Refresh Token

**Cómo obtenerlas:** `console.cloud.google.com` → Drive API → OAuth 2.0. El mismo OAuth sirve para Drive y Calendar.

```typescript
// /office/tools/integrations/google-drive/google-drive.ts
import { google } from 'googleapis'

async function getClient() {
  const clientId     = await getCredential('gdrive', 'Client ID')
  const clientSecret = await getCredential('gdrive', 'Client Secret')
  const refreshToken = await getCredential('gdrive', 'Refresh Token')
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth })
}

export const driveDriver = {

  async verify() {
    const drive = await getClient()
    const res = await drive.about.get({ fields: 'user' })
    return { ok: true, email: res.data.user?.emailAddress }
  },

  async uploadFile(name: string, content: Buffer, mimeType: string) {
    const drive = await getClient()
    const res = await drive.files.create({
      requestBody: { name, mimeType },
      media: { mimeType, body: content },
      fields: 'id, webViewLink'
    })
    return { id: res.data.id, url: res.data.webViewLink }
  },

  async listFiles(folder?: string) {
    const drive = await getClient()
    const res = await drive.files.list({
      q: folder ? `'${folder}' in parents` : undefined,
      fields: 'files(id,name,mimeType,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 20
    })
    return res.data.files || []
  },

  async shareFile(fileId: string, email: string) {
    const drive = await getClient()
    await drive.permissions.create({
      fileId,
      requestBody: { type: 'user', role: 'reader', emailAddress: email }
    })
    return { shared: true }
  },

  description: `
    Tool: google-drive
    Cuando usar: guardar archivos en la nube, compartir con clientes
    - uploadFile(name, content, mimeType): sube archivo
    - listFiles(folder?): lista archivos del Drive
    - shareFile(fileId, email): compartir con un email
  `
}
```

---

### 📅 Google Calendar — Agenda y reuniones

**Credenciales:** Mismo OAuth que Google Drive (añadir scope `calendar`).

```typescript
// /office/tools/integrations/google-calendar/google-calendar.ts
import { google } from 'googleapis'

async function getClient() {
  const clientId     = await getCredential('gcalendar', 'Client ID')
  const clientSecret = await getCredential('gcalendar', 'Client Secret')
  const refreshToken = await getCredential('gcalendar', 'Refresh Token')
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth })
}

export const calendarDriver = {

  async verify() {
    const cal = await getClient()
    const res = await cal.calendars.get({ calendarId: 'primary' })
    return { ok: true, email: res.data.id }
  },

  async getUpcomingEvents(days = 7) {
    const cal = await getClient()
    const now = new Date()
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const res = await cal.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })
    return res.data.items || []
  },

  async createEvent(title: string, startDate: string, endDate: string, attendees: string[] = []) {
    const cal = await getClient()
    const res = await cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        start: { dateTime: startDate },
        end: { dateTime: endDate },
        attendees: attendees.map(email => ({ email }))
      }
    })
    return { id: res.data.id, url: res.data.htmlLink }
  },

  async checkAvailability(date: string) {
    const cal = await getClient()
    const start = new Date(date)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const res = await cal.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }]
      }
    })
    return res.data.calendars?.primary?.busy || []
  },

  description: `
    Tool: google-calendar
    Cuando usar: agenda, reuniones, disponibilidad
    - getUpcomingEvents(days): próximos eventos
    - createEvent(title, start, end, attendees?): crear evento
    - checkAvailability(date): ver huecos libres
  `
}
```

---

### 💬 Slack — Comunicación con el equipo

**Credenciales:** Bot Token / Signing Secret

**Cómo obtenerlas:** `api.slack.com/apps` → New App → Bot Token Scopes: `chat:write`, `files:write`, `channels:read` → Install to Workspace.

```typescript
// /office/tools/integrations/slack/slack.ts
import { WebClient } from '@slack/web-api'

async function getClient() {
  const token = await getCredential('slack', 'Bot Token')
  return new WebClient(token)
}

export const slackDriver = {

  async verify() {
    const slack = await getClient()
    const res = await slack.auth.test()
    return { ok: res.ok, team: res.team, bot: res.user }
  },

  async sendMessage(channel: string, text: string) {
    const slack = await getClient()
    return slack.chat.postMessage({ channel, text })
  },

  async sendRichMessage(channel: string, title: string, body: string, color = '#5B21B6') {
    const slack = await getClient()
    return slack.chat.postMessage({
      channel,
      attachments: [{
        color, title, text: body,
        footer: 'J.A.R.V.I.S. — Brezan Solutions IA',
        ts: Math.floor(Date.now() / 1000).toString()
      }]
    })
  },

  async listChannels() {
    const slack = await getClient()
    const res = await slack.conversations.list({ limit: 50 })
    return res.channels?.map(c => ({ id: c.id, name: c.name, members: c.num_members }))
  },

  async uploadFile(channel: string, filename: string, content: Buffer, title: string) {
    const slack = await getClient()
    return slack.files.uploadV2({ channel_id: channel, filename, title, file: content })
  },

  description: `
    Tool: slack
    Cuando usar: comunicar al equipo, notificaciones, reportes
    - sendMessage(channel, text): mensaje simple
    - sendRichMessage(channel, title, body): mensaje con formato
    - listChannels(): listar canales disponibles
    - uploadFile(channel, filename, content): subir archivo
  `
}
```

---

### 📱 WhatsApp — Comunicación con clientes

**Credenciales:** Phone Number ID / Access Token / Verify Token

**Cómo obtenerlas:** `developers.facebook.com` → My Apps → WhatsApp → Getting Started. Para producción necesitas Business Verification.

```typescript
// /office/tools/integrations/whatsapp/whatsapp.ts

async function getConfig() {
  return {
    phoneId: await getCredential('whatsapp', 'Phone Number ID'),
    token:   await getCredential('whatsapp', 'Access Token')
  }
}

export const whatsappDriver = {

  async verify() {
    const { phoneId, token } = await getConfig()
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    return { ok: res.ok, phone: data.display_phone_number }
  },

  async sendMessage(to: string, text: string) {
    // to = número internacional sin + (ej: 34612345678)
    const { phoneId, token } = await getConfig()
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to, type: 'text', text: { body: text }
        })
      }
    )
    return res.json()
  },

  async sendDocument(to: string, fileUrl: string, filename: string) {
    const { phoneId, token } = await getConfig()
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to,
          type: 'document',
          document: { link: fileUrl, filename }
        })
      }
    )
    return res.json()
  },

  description: `
    Tool: whatsapp
    Cuando usar: comunicar con clientes por WhatsApp
    - sendMessage(to, text): enviar mensaje (número sin +)
    - sendDocument(to, fileUrl, filename): enviar PDF/archivo
  `
}
```

---

## Tier 2 — Drivers Importantes

### 📝 Notion — Base de conocimiento

**Credenciales:** Integration Token

**Cómo obtenerla:** `notion.so/my-integrations` → New Integration → Internal Integration Token. Luego compartir las páginas con la integración.

```typescript
// /office/tools/integrations/notion/notion.ts
import { Client } from '@notionhq/client'

async function getClient() {
  const token = await getCredential('notion', 'Integration Token')
  return new Client({ auth: token })
}

export const notionDriver = {

  async verify() {
    const notion = await getClient()
    const res = await notion.users.me({})
    return { ok: true, user: res.name }
  },

  async createPage(parentId: string, title: string, content: string) {
    const notion = await getClient()
    return notion.pages.create({
      parent: { page_id: parentId },
      properties: { title: { title: [{ text: { content: title } }] } },
      children: [{
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ text: { content } }] }
      }]
    })
  },

  async searchPages(query: string) {
    const notion = await getClient()
    const res = await notion.search({ query, page_size: 10 })
    return res.results
  },

  async queryDatabase(dbId: string, filter?: object) {
    const notion = await getClient()
    const res = await notion.databases.query({
      database_id: dbId,
      ...(filter ? { filter } : {})
    })
    return res.results
  },

  description: `
    Tool: notion
    Cuando usar: documentar, guardar notas, base de conocimiento
    - createPage(parentId, title, content): crear página
    - searchPages(query): buscar en Notion
    - queryDatabase(dbId, filter?): consultar base de datos
  `
}
```

---

### 🗂 Airtable — Base de datos visual / CRM

**Credenciales:** API Key / Base ID

**Cómo obtenerlas:** `airtable.com/create/tokens` → Create token → Scopes: `data.records:read`, `data.records:write`. Base ID en la URL de tu base.

```typescript
// /office/tools/integrations/airtable/airtable.ts

async function getConfig() {
  return {
    key:    await getCredential('airtable', 'API Key'),
    baseId: await getCredential('airtable', 'Base ID')
  }
}

export const airtableDriver = {

  async verify() {
    const { key, baseId } = await getConfig()
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${key}` }
    })
    return { ok: res.ok }
  },

  async listRecords(table: string, filterFormula?: string) {
    const { key, baseId } = await getConfig()
    const params = filterFormula ? `?filterByFormula=${encodeURIComponent(filterFormula)}` : ''
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}${params}`, {
      headers: { Authorization: `Bearer ${key}` }
    })
    const data = await res.json()
    return data.records || []
  },

  async createRecord(table: string, fields: object) {
    const { key, baseId } = await getConfig()
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    })
    return res.json()
  },

  async updateRecord(table: string, recordId: string, fields: object) {
    const { key, baseId } = await getConfig()
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}/${recordId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    })
    return res.json()
  },

  description: `
    Tool: airtable
    Cuando usar: CRM, tracking de proyectos, inventario, pipeline
    - listRecords(table, filter?): listar registros
    - createRecord(table, fields): crear registro
    - updateRecord(table, id, fields): actualizar registro
  `
}
```

---

### 🐙 GitHub — Control del repositorio

**Credenciales:** Personal Access Token

**Cómo obtenerla:** `github.com/settings/tokens` → Generate new token (classic) → Scopes: `repo`, `issues`.

```typescript
// /office/tools/integrations/github/github.ts
import { Octokit } from '@octokit/rest'

async function getClient() {
  const token = await getCredential('github', 'Personal Access Token')
  return new Octokit({ auth: token })
}

export const githubDriver = {

  async verify() {
    const octokit = await getClient()
    const { data } = await octokit.users.getAuthenticated()
    return { ok: true, user: data.login, repos: data.public_repos }
  },

  async listRepos() {
    const octokit = await getClient()
    const { data } = await octokit.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 10 })
    return data.map(r => ({ name: r.name, updated: r.updated_at, language: r.language }))
  },

  async getRecentCommits(repo: string, limit = 10) {
    const octokit = await getClient()
    const { data: user } = await octokit.users.getAuthenticated()
    const { data } = await octokit.repos.listCommits({ owner: user.login, repo, per_page: limit })
    return data.map(c => ({
      message: c.commit.message,
      author: c.commit.author?.name,
      date: c.commit.author?.date
    }))
  },

  async createIssue(repo: string, title: string, body: string) {
    const octokit = await getClient()
    const { data: user } = await octokit.users.getAuthenticated()
    const { data } = await octokit.issues.create({ owner: user.login, repo, title, body })
    return { url: data.html_url, number: data.number }
  },

  description: `
    Tool: github
    Cuando usar: monitorear código, crear issues, ver commits
    - listRepos(): listar repositorios
    - getRecentCommits(repo, limit): últimos commits
    - createIssue(repo, title, body): crear issue
  `
}
```

---

### ⚡ n8n — Puente con 400+ aplicaciones

**Credenciales:** API Key / Base URL

**Cómo obtenerlas:** Si es self-hosted: Settings → API → Create API Key. Si es n8n.cloud: Settings → API.

```typescript
// /office/tools/integrations/n8n/n8n.ts

async function getConfig() {
  return {
    baseUrl: await getCredential('n8n', 'Base URL'),
    apiKey:  await getCredential('n8n', 'API Key')
  }
}

export const n8nDriver = {

  async verify() {
    const { baseUrl, apiKey } = await getConfig()
    const res = await fetch(`${baseUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    })
    return { ok: res.ok }
  },

  async triggerWorkflow(webhookPath: string, data: object) {
    // Crear workflows en n8n con Webhook trigger y llamarlos desde aquí
    const { baseUrl } = await getConfig()
    const res = await fetch(`${baseUrl}/webhook/${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async listWorkflows() {
    const { baseUrl, apiKey } = await getConfig()
    const res = await fetch(`${baseUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey }
    })
    const data = await res.json()
    return data.data?.map((w: any) => ({ id: w.id, name: w.name, active: w.active }))
  },

  description: `
    Tool: n8n
    Cuando usar: automatizaciones complejas, apps sin driver nativo
    - triggerWorkflow(webhookPath, data): disparar flujo de n8n
    - listWorkflows(): ver flujos disponibles
    Nota: crear un workflow en n8n por cada caso de uso,
    Jarvis lo dispara con triggerWorkflow()
  `
}
```

---

## Tabla resumen — Credenciales por integración

| Integración | Tier | Credenciales requeridas | Verificación |
|---|---|---|---|
| 📧 Gmail | 1 | Client ID / Client Secret / Refresh Token | GET /gmail/v1/users/me/profile |
| 🔍 Serper | 1 | API Key | POST /search con q:test |
| 💳 Stripe | 1 | Secret Key / Webhook Secret | GET /v1/balance |
| 📁 Google Drive | 1 | Client ID / Client Secret / Refresh Token | GET /drive/v3/files |
| 📅 Google Calendar | 1 | Client ID / Client Secret / Refresh Token | GET /calendar/v3/calendars/primary |
| 💬 Slack | 1 | Bot Token / Signing Secret | GET /api.test |
| 📱 WhatsApp | 1 | Phone Number ID / Access Token | GET /{phoneId} |
| 📝 Notion | 2 | Integration Token | GET /v1/users/me |
| 🗂 Airtable | 2 | API Key / Base ID | GET /meta/bases/{id}/tables |
| 🐙 GitHub | 2 | Personal Access Token | GET /user |
| 📋 Typeform | 2 | Personal Access Token | GET /forms |
| ⚡ n8n | 2 | API Key / Base URL | GET /api/v1/workflows |
| 🧡 HubSpot | 3 | Access Token | GET /crm/v3/objects/contacts |
| 🔊 ElevenLabs | 3 | API Key / Voice ID | GET /v1/voices |
| 🎨 Replicate | 3 | API Token | GET /v1/models |
| ⚡ Zapier | 3 | API Key | GET /v1/zaps |
| 📞 Twilio | 3 | Account SID / Auth Token | GET /Accounts/SID |
| 📧 Mailchimp | 3 | API Key / Server Prefix | GET /3.0/ping |
| 📆 Cal.com | 3 | API Key | GET /v1/bookings |
| 🖼 Stability AI | 3 | API Key | GET /v1/engines/list |

---

> **Orden recomendado:** Conecta primero Gmail y Serper (ya tienes las credenciales), luego Stripe y Drive cuando empieces a facturar y generar documentos. No conectes todo a la vez — solo lo que vayas a usar.
