import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
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
