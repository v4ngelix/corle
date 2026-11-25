import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDate } from '../src/surveyDate.ts'

test('survey dates display in Estonian day.month.year order', () => {
  assert.equal(formatDate('2025-06-03'), '03.06.2025')
  assert.equal(formatDate('2024-12-31'), '31.12.2024')
  assert.equal(formatDate(''), '')
})
