import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parse } from 'yaml'

test('frontend deployment preserves quote caches and the live publication lock', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'))
  const deployment = workflow.jobs.deploy.steps.find(step => step.env?.SOURCE === 'dist/')
  const exclusions = deployment.env.EXCLUDE.split(',').map(value => value.trim())
  const root = await mkdtemp(join(tmpdir(), 'market-deploy-test-'))
  try {
    const source = join(root, 'dist')
    const target = join(root, 'production')
    await mkdir(source)
    await mkdir(join(target, 'qdii'), { recursive: true })
    for (const file of ['data.json', 'world-data.json', 'worldpage-data.json', 'market-dashboard.json', 'market-dashboard.json.lock', '.market-dashboard-writing.tmp']) {
      await writeFile(join(target, 'qdii', file), '{}')
    }
    const result = execFileSync('rsync', ['-avzn', '--delete', ...exclusions.map(value => `--exclude=${value}`), `${source}/`, `${target}/`], { encoding: 'utf8' })
    assert.doesNotMatch(result, /deleting qdii\//)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('market publication rejects broken or stale snapshots without replacing the live data', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/market-dashboard.yml', import.meta.url), 'utf8'))
  const deployment = workflow.jobs.refresh.steps.find(step => step.env?.SCRIPT_AFTER)
  assert.equal(deployment.if, "github.ref == 'refs/heads/main'")
  assert.equal(deployment.env.SCRIPT_AFTER_REQUIRED, 'true')
  assert.doesNotMatch(deployment.env.ARGS, /--delete/)
  const root = await mkdtemp(join(tmpdir(), 'market-publication-test-'))
  const incoming = join(root, '.market-dashboard-incoming.json')
  const target = join(root, 'market-dashboard.json')
  const command = deployment.env.SCRIPT_AFTER.replaceAll('/var/www/pmtools/main/qdii/', `${root}/`)
  try {
    await writeFile(target, '{"old":true}')
    for (const payload of ['{invalid', JSON.stringify({ version: 1, indicators: [{ value: 123, stale: false, fetchedAt: '2020-01-01T00:00:00Z' }] }), JSON.stringify({ version: 1, indicators: [] })]) {
      await writeFile(incoming, payload)
      assert.throws(() => execFileSync('bash', ['-c', command], { stdio: 'pipe' }))
      assert.equal(await readFile(target, 'utf8'), '{"old":true}')
    }
    const snapshot = { version: 1, indicators: [{ id: 'dow', value: 123, stale: false, fetchedAt: new Date().toISOString() }] }
    await writeFile(incoming, JSON.stringify(snapshot), { mode: 0o600 })
    execFileSync('bash', ['-c', command], { stdio: 'pipe' })
    assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), snapshot)
    assert.equal((await stat(target)).mode & 0o777, 0o644)
    const cached = { id: 'gold', symbol: 'GC=F', value: 3000, history: [{ date: '2026-10-01', value: 3000 }], fetchedAt: '2026-10-01T00:00:00Z', stale: false }
    await writeFile(target, JSON.stringify({ version: 1, indicators: [cached] }))
    await writeFile(incoming, JSON.stringify({ ...snapshot, indicators: [...snapshot.indicators, { id: 'gold', symbol: 'GC=F', value: null, history: [], stale: true }] }))
    execFileSync('bash', ['-c', command], { stdio: 'pipe' })
    const retained = JSON.parse(await readFile(target, 'utf8')).indicators.find(item => item.id === 'gold')
    assert.equal(retained.value, cached.value)
    assert.deepEqual(retained.history, cached.history)
    assert.equal(retained.stale, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
