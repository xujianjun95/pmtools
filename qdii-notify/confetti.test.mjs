import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('confetti total is durable and counts at most 30 presses per IP in a rolling minute', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pmtools-confetti-test-'))
  process.env.DB_PATH = join(directory, 'test.db')
  const { closeDb, countConfetti, getConfettiTotal } = await import('./db.js')

  try {
    const initialTotal = getConfettiTotal()
    assert.equal(initialTotal, 72_852)
    assert.equal(countConfetti('192.0.2.1', 99, 0), initialTotal + 20)
    assert.equal(countConfetti('192.0.2.1', 20, 45000), initialTotal + 30)
    assert.equal(countConfetti('192.0.2.1', 1, 59999), initialTotal + 30)
    assert.equal(countConfetti('192.0.2.2', 20, 59999), initialTotal + 50)
    for (const invalid of [0, -10, 1.5, '20', null, undefined]) {
      assert.equal(countConfetti('192.0.2.1', invalid, 59999), initialTotal + 50)
    }

    closeDb()
    assert.equal(getConfettiTotal(), initialTotal + 50)
    assert.equal(countConfetti('192.0.2.1', 20, 60000), initialTotal + 70)
    assert.equal(countConfetti('192.0.2.1', 1, 60001), initialTotal + 70)
  } finally {
    closeDb()
    await rm(directory, { recursive: true, force: true })
  }
})
