import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getGridexApiBaseUrl, getGridexConfigurationStatus } from '../lib/ops/config.ts'

test('Elklart demo accepts only the paired demo origins and fails closed', () => {
  process.env.ELKLART_DEMO_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://mina-sidor-demo.gridex.se'
  delete process.env.GRIDEX_OPS_API_URL
  assert.throws(getGridexApiBaseUrl, /Elklart/)
  assert.equal(getGridexConfigurationStatus().apiBaseUrlValid, false)

  process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
  assert.throws(getGridexApiBaseUrl, /Elklart/)

  process.env.GRIDEX_OPS_API_URL = 'https://demo.gridex.se/api/v1'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://gridex.se'
  assert.throws(getGridexApiBaseUrl, /Elklart/)

  process.env.NEXT_PUBLIC_SITE_URL = 'https://mina-sidor-demo.gridex.se/'
  assert.equal(getGridexApiBaseUrl(), 'https://demo.gridex.se/api/v1')
  assert.equal(getGridexConfigurationStatus().apiBaseUrlValid, true)

  delete process.env.ELKLART_DEMO_ENABLED
  process.env.VERCEL_ENV = 'production'
  assert.throws(getGridexApiBaseUrl, /canonical OPS-origin/)
  delete process.env.GRIDEX_OPS_API_URL
  assert.equal(getGridexApiBaseUrl(), 'https://app.gridex.se/api/v1')
})
