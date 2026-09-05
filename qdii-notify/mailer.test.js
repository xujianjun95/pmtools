import test from 'node:test'
import assert from 'node:assert/strict'

process.env.ALIYUN_DM_READ_TIMEOUT = '15000'
process.env.ALIYUN_DM_CONNECT_TIMEOUT = '5000'

test('阿里云客户端使用可配置的连接和读取超时', async () => {
  const { createAliyunClientConfig } = await import('./mailer.js')
  const clientConfig = createAliyunClientConfig()

  assert.equal(clientConfig.readTimeout, 15000)
  assert.equal(clientConfig.connectTimeout, 5000)
})
