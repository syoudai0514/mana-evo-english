// サーバーから Gemini Live（上限のない Live モデルだけ）につなぐ。
// 台本づくり（関数で返してもらう）と、1行ずつ声で読ませる読み手。
const KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

const ALLOWED: Record<string, RegExp> = {
  '3-flash': /^gemini-3(\.1)?-flash-live(-preview)?$/,
  '3.8': /^gemini-3\.8-live$/,
  '2.5-audio': /^gemini-2\.5-flash-native-audio/
}
let models: string[] | null = null

export async function pickModel(order: string[]): Promise<string | null> {
  if (!models) {
    const names: string[] = []
    let pageToken = ''
    for (let page = 0; page < 5; page += 1) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { 'x-goog-api-key': KEY } })
      if (!response.ok) break
      const data = await response.json()
      for (const model of data.models ?? []) {
        const name = String(model.name).replace(/^models\//, '')
        if ((model.supportedGenerationMethods ?? []).includes('bidiGenerateContent') && Object.values(ALLOWED).some((re) => re.test(name))) names.push(name)
      }
      pageToken = data.nextPageToken ?? ''
      if (!pageToken) break
    }
    models = names
  }
  for (const id of order) {
    const hit = models.filter((name) => ALLOWED[id]?.test(name)).sort((a, b) => Number(b.endsWith('latest')) - Number(a.endsWith('latest')))[0]
    if (hit) return hit
  }
  return null
}

type Handlers = {
  onAudio?: (base64: string) => void
  onTranscript?: (text: string) => void
  onTool?: (name: string, args: Record<string, unknown>) => void
  onTurnComplete?: () => void
  onClose?: (reason: string) => void
}

export class LiveConn {
  ws: WebSocket | null = null
  handlers: Handlers = {}
  openedAt = 0
  closed = false

  async open({ model, system, voice = 'Kore', tools = null }: { model: string; system: string; voice?: string; tools?: unknown[] | null }) {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${WS}?key=${KEY}`)
      ws.binaryType = 'arraybuffer'
      this.ws = ws
      const timer = setTimeout(() => { reject(new Error('live timeout')); this.close() }, 10000)
      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: { responseModalities: ['AUDIO'], temperature: 0.9, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
            systemInstruction: { parts: [{ text: system }] },
            ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
            outputAudioTranscription: {},
            realtimeInputConfig: { automaticActivityDetection: { disabled: true } }
          }
        }))
      }
      let ready = false
      ws.onmessage = (event) => {
        let message
        try { message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)) } catch { return }
        if (message.setupComplete && !ready) { ready = true; this.openedAt = Date.now(); clearTimeout(timer); resolve(); return }
        this.handle(message)
      }
      ws.onerror = () => {}
      ws.onclose = (event) => {
        clearTimeout(timer)
        this.closed = true
        if (!ready) reject(new Error(`live closed ${event.code} ${event.reason}`))
        else this.handlers.onClose?.(`${event.code} ${event.reason}`)
      }
    })
  }

  get age() { return Date.now() - this.openedAt }
  get usable() { return !this.closed && this.ws?.readyState === WebSocket.OPEN && this.age < 110000 }

  handle(message: any) {
    for (const call of message.toolCall?.functionCalls ?? []) {
      this.handlers.onTool?.(call.name, call.args ?? {})
      this.ws?.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { ok: true } }] } }))
    }
    const content = message.serverContent
    if (!content) return
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && /^audio\//.test(part.inlineData.mimeType ?? '')) this.handlers.onAudio?.(part.inlineData.data)
    }
    if (content.outputTranscription?.text) this.handlers.onTranscript?.(content.outputTranscription.text)
    if (content.turnComplete) this.handlers.onTurnComplete?.()
  }

  sendText(text: string) {
    this.ws?.send(JSON.stringify({ realtimeInput: { text } }))
  }

  close() {
    this.closed = true
    try { this.ws?.close() } catch { /* already closed */ }
  }
}

// 関数で台本をもらう（3.8 Live → 3 Flash Live の順で）。だめなら null
export async function askFunction(system: string, declaration: { name: string }, message: string, timeoutMs = 70000) {
  for (const order of [['3.8'], ['3-flash']]) {
    const model = await pickModel(order)
    if (!model) continue
    const conn = new LiveConn()
    try {
      await conn.open({ model, system, tools: [declaration] })
      const result = await new Promise<Record<string, unknown> | null>((resolve) => {
        let got: Record<string, unknown> | null = null
        let misses = 0
        const timer = setTimeout(() => resolve(got), timeoutMs)
        conn.handlers = {
          onTool: (name, args) => { if (name === declaration.name && !got) { got = args; setTimeout(() => { clearTimeout(timer); resolve(got) }, 1500) } },
          onTurnComplete: () => {
            if (got) return
            misses += 1
            if (misses > 1) { clearTimeout(timer); resolve(null); return }
            conn.sendText(`Call ${declaration.name} now for the previous message. Do not speak.`)
          },
          onClose: () => { clearTimeout(timer); resolve(got) }
        }
        conn.sendText(message)
      })
      if (result) return result
    } catch (error) {
      console.warn('askFunction', model, String((error as Error)?.message ?? error))
    } finally {
      conn.close()
    }
  }
  return null
}
