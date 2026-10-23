import { todayKey } from './state.js'

const safeProfile = (id) => typeof id === 'string' && /^[\w-]{1,80}$/.test(id)
export function manaEvoProfiles(rows) {
  const profiles = new Map()
  for (const row of rows || []) {
    const p = row?.payload
    if (
      row?.schema_version !== 1 ||
      p?.appId !== 'mana-evo' ||
      p.saveSchemaVersion !== 1
    )
      continue
    for (const [id, profile] of Object.entries(p.learning?.profiles || {})) {
      if (safeProfile(id) && profile?.state && !profiles.has(id))
        profiles.set(id, { id, name: String(profile.name || id).slice(0, 40) })
    }
  }
  return [...profiles.values()]
}

// One star per account/target/day. Stable across devices, repeats and imports.
// The English app only publishes intent; ManaEvo owns the durable grant ledger.
export function enqueueEnglishReward(state, accountId, date = new Date()) {
  const bridge = state.englishRewards
  if (
    !accountId ||
    bridge?.version !== 1 ||
    bridge.accountId !== accountId ||
    !safeProfile(bridge.targetProfileId)
  )
    return state
  const day = todayKey(date)
  const id = `mee:v1:${accountId}:${bridge.targetProfileId}:${day}`
  if ((bridge.outbox || []).some((event) => event.id === id)) return state
  const event = {
    id,
    version: 1,
    sourceApp: 'mana-evo-english',
    accountId,
    targetProfileId: bridge.targetProfileId,
    day,
    kind: 'english-daily',
    captureItemDelta: { star: 1, silver: 0, gold: 0 },
    ticketDelta: 0
  }
  return {
    ...state,
    englishRewards: { ...bridge, outbox: [...(bridge.outbox || []), event] }
  }
}

export function chooseRewardTarget(state, accountId, targetProfileId) {
  if (!accountId || !safeProfile(targetProfileId))
    throw new Error('受取先を確認してください')
  return {
    ...state,
    englishRewards: {
      version: 1,
      accountId,
      targetProfileId,
      outbox: state.englishRewards?.outbox || []
    }
  }
}
