/**
 * 鉴权与路由测试：登录/限流/会话验签/Origin 校验/404。
 * 每个用例独立 createApp 实例（限流器状态随实例隔离），listen(0) 随机端口。
 * 凭据全部运行时生成，不在源码中落任何字面量。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// 必须在导入被测模块前注入环境（config/db 在模块加载时读取）
const TEST_PASSWORD = ['pmtools', 'test', randomUUID().slice(0, 8)].join('-')
const TEST_SECRET = ['session', 'secret', randomUUID()].join('-')
const WRONG_PASSWORD = ['wrong', randomUUID().slice(0, 8)].join('-')

process.env.ADMIN_PASSWORD = TEST_PASSWORD
process.env.SESSION_SECRET = TEST_SECRET
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'admin-auth-')), 'articles.db')
process.env.ADMIN_ALLOWED_ORIGINS = 'http://localhost:5173'

const { createApp } = await import('./server.js')
const { signSession, SESSION_COOKIE } = await import('./auth.js')
const { config } = await import('./config.js')

async function startApp() {
  const server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  return { server, base: `http://127.0.0.1:${server.address().port}/background-api` }
}
const stop = (server) => new Promise((resolve) => server.close(resolve))

const ALLOWED_ORIGIN = 'http://localhost:5173'

test('health 无需鉴权', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/health`)
    assert.equal(res.status, 200)
    assert.equal((await res.json()).ok, true)
  } finally {
    await stop(server)
  }
})

test('未登录访问 /admin/session 返回 401', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/admin/session`)
    assert.equal(res.status, 401)
  } finally {
    await stop(server)
  }
})

test('登录：密码错误返回 401 且不下发 cookie', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: JSON.stringify({ password: WRONG_PASSWORD }),
    })
    assert.equal(res.status, 401)
    assert.equal(res.headers.get('set-cookie'), null)
  } finally {
    await stop(server)
  }
})

test('登录：缺少 Origin/Referer 的写操作返回 403', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    })
    assert.equal(res.status, 403)
  } finally {
    await stop(server)
  }
})

test('登录：白名单外的 Origin 返回 403', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    })
    assert.equal(res.status, 403)
  } finally {
    await stop(server)
  }
})

test('登录：Referer 兜底命中白名单可登录，cookie 属性齐全', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: `${ALLOWED_ORIGIN}/background`,
      },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    })
    assert.equal(res.status, 200)
    const cookie = res.headers.get('set-cookie') || ''
    assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=[^;]+`))
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /Secure/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Max-Age=604800/)
  } finally {
    await stop(server)
  }
})

test('会话：有效令牌通过，伪造签名与过期令牌均 401', async () => {
  const { server, base } = await startApp()
  try {
    const good = signSession(config.sessionSecret).token
    const forged = signSession(['forged', randomUUID()].join('-')).token
    const expired = signSession(config.sessionSecret, Date.now() - 8 * 24 * 60 * 60 * 1000).token

    const ok = await fetch(`${base}/admin/session`, {
      headers: { Cookie: `${SESSION_COOKIE}=${good}` },
    })
    assert.equal(ok.status, 200)

    const bad = await fetch(`${base}/admin/session`, {
      headers: { Cookie: `${SESSION_COOKIE}=${forged}` },
    })
    assert.equal(bad.status, 401)

    const old = await fetch(`${base}/admin/session`, {
      headers: { Cookie: `${SESSION_COOKIE}=${expired}` },
    })
    assert.equal(old.status, 401)
  } finally {
    await stop(server)
  }
})

test('退出：清除 cookie（Max-Age=0），跨源写操作 403', async () => {
  const { server, base } = await startApp()
  try {
    const forbidden = await fetch(`${base}/admin/logout`, { method: 'POST' })
    assert.equal(forbidden.status, 403)

    const ok = await fetch(`${base}/admin/logout`, {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN },
    })
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get('set-cookie') || '', /Max-Age=0/)
  } finally {
    await stop(server)
  }
})

test('登录限流：同 IP 第 11 次起 429', async () => {
  const { server, base } = await startApp()
  try {
    let last
    for (let i = 0; i < 11; i += 1) {
      last = await fetch(`${base}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
        body: JSON.stringify({ password: WRONG_PASSWORD }),
      })
      if (i < 10) assert.equal(last.status, 401)
    }
    assert.equal(last.status, 429)
  } finally {
    await stop(server)
  }
})

test('未知 API 路径返回 404', async () => {
  const { server, base } = await startApp()
  try {
    const res = await fetch(`${base}/nope`)
    assert.equal(res.status, 404)
  } finally {
    await stop(server)
  }
})
