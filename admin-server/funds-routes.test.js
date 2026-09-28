import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const directory=mkdtempSync(path.join(tmpdir(),'fund-routes-'))
process.env.ADMIN_PASSWORD=randomUUID()
process.env.SESSION_SECRET=randomUUID()
process.env.DB_PATH=path.join(directory,'articles.db')
process.env.ADMIN_ALLOWED_ORIGINS='http://localhost:5173'
const { createApp }=await import('./server.js')
const { createFundStore }=await import('./funds.js')
const { signSession, SESSION_COOKIE }=await import('./auth.js')
const { config }=await import('./config.js')

test('管理写入沿用鉴权和来源校验，公开读取立刻反映保存与删除',async(t)=>{
  const store=createFundStore({dbPath:path.join(directory,'fund.db')})
  const server=createApp({fundStore:store}).listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();rmSync(directory,{recursive:true,force:true})})
  const base=`http://127.0.0.1:${server.address().port}/background-api`
  assert.equal((await fetch(`${base}/admin/funds`)).status,401)
  const body=JSON.stringify({code:'999999',name:'路由测试基金',market:'other',region:'日本',kind:'主动',limit_amount:100})
  const cookie=`${SESSION_COOKIE}=${signSession(config.sessionSecret).token}`
  assert.equal((await fetch(`${base}/admin/funds`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body})).status,403)
  const headers={'Content-Type':'application/json',Cookie:cookie,Origin:'http://localhost:5173'}
  assert.equal((await fetch(`${base}/admin/funds`,{method:'POST',headers,body})).status,201)
  assert.equal((await fetch(`${base}/admin/funds/999999`,{method:'PUT',headers,body:JSON.stringify({limit_amount:321})})).status,200)
  const data=await (await fetch(`${base}/funds`)).json()
  assert.equal(data.funds.find(f=>f.code==='999999').limit_amount,321)
  assert.equal((await fetch(`${base}/admin/funds/999999`,{method:'DELETE',headers})).status,200)
  assert.equal((await (await fetch(`${base}/funds`)).json()).funds.some(f=>f.code==='999999'),false)
})
