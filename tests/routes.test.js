import test from 'node:test'
import assert from 'node:assert/strict'
import { readRoute, routeHash, routeIsAdult } from '../src/lib/routes.js'
test('only known safe routes restore and adult routes retain the PIN boundary', () => {
  assert.equal(readRoute('#/talk'), null)
  assert.equal(readRoute('#/lesson?lesson=x'), null)
  const route = readRoute('#/lesson?lesson=adult.daily.001.a1&audience=adult')
  assert.equal(routeIsAdult(route), true)
  assert.equal(routeIsAdult(readRoute('#/kidLibrary')), false)
  assert.equal(readRoute('#/lesson?lesson=%3Cscript%3E&audience=kid'), null)
  assert.equal(
    routeHash(route),
    '#/lesson?lesson=adult.daily.001.a1&audience=adult'
  )
})
