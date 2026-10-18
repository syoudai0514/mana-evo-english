// 1回ずつ送る方式は、確認用のダミー相手（?mock=1）だけで使う。
// 本番は上限のない Gemini Live だけで会話するので、ほかのモデルは呼ばない。
import { isMockMode } from './config.js'
import { mockReply } from './mockTalk.js'

export class TalkError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export async function sendTurn({ input, context }) {
  if (isMockMode()) return mockReply({ input, context })
  throw new TalkError('offline', 'Live だけで会話します')
}
