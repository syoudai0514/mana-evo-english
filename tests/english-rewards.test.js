import test from 'node:test'
import assert from 'node:assert/strict'
import { initialState } from '../src/lib/state.js'
import {
  chooseRewardTarget,
  enqueueEnglishReward,
  manaEvoProfiles
} from '../src/lib/englishRewards.js'
test('daily reward is stable across repeats and tied to the selected account/profile', () => {
  const day = new Date(2026, 9, 22),
    target = chooseRewardTarget(initialState(), 'u', 'child-1')
  const first = enqueueEnglishReward(target, 'u', day)
  assert.equal(first.englishRewards.outbox.length, 1)
  assert.equal(first.englishRewards.outbox[0].captureItemDelta.star, 1)
  assert.deepEqual(enqueueEnglishReward(first, 'u', day), first)
  assert.deepEqual(enqueueEnglishReward(first, 'other', day), first)
  assert.equal(
    enqueueEnglishReward(first, 'u', new Date(2026, 9, 23)).englishRewards
      .outbox.length,
    2
  )
  assert.throws(() => chooseRewardTarget(first, 'u', '<script>'))
})
test('recipient profiles only come from a recognized mana-evo cloud payload', () => {
  const row = {
    schema_version: 1,
    payload: {
      appId: 'mana-evo',
      saveSchemaVersion: 1,
      learning: {
        profiles: {
          'child-1': { name: 'まな', state: {} },
          'bad:id': { name: 'bad', state: {} }
        }
      }
    }
  }
  assert.deepEqual(manaEvoProfiles([row]), [{ id: 'child-1', name: 'まな' }])
  assert.deepEqual(manaEvoProfiles([{ ...row, schema_version: 2 }]), [])
})
