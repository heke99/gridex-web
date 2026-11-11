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


test('local demo pair requires explicit development runtime and cannot enable in deployed builds', () => {
  const previous = { ...process.env }
  try {
    process.env.ELKLART_DEMO_ENABLED = 'true'
    process.env.ELKLART_DEMO_LOCAL_RUNTIME = 'true'
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3001'
    process.env.GRIDEX_OPS_API_URL = 'http://localhost:3000/api/v1'
    assert.equal(getGridexApiBaseUrl(), 'http://localhost:3000/api/v1')
    process.env.NEXT_PUBLIC_SITE_URL = 'https://localhost:3001'
    process.env.GRIDEX_OPS_API_URL = 'https://localhost:3000/api/v1'
    assert.equal(getGridexApiBaseUrl(), 'https://localhost:3000/api/v1')
    process.env.GRIDEX_OPS_API_URL = 'http://localhost:3000/api/v1'
    assert.throws(getGridexApiBaseUrl, /Elklart/)
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3001'
    for (const environment of ['production', 'preview', 'development']) {
      process.env.VERCEL_ENV = environment
      assert.throws(getGridexApiBaseUrl, /Elklart/)
    }
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'production'
    assert.throws(getGridexApiBaseUrl, /Elklart/)
    process.env.NODE_ENV = 'development'
    for (const value of ['http://127.0.0.1:3000/api/v1', 'http://localhost:3000/api/v1?x=1', 'https://app.gridex.se/api/v1']) {
      process.env.GRIDEX_OPS_API_URL = value
      assert.throws(getGridexApiBaseUrl, /Elklart/)
    }
    process.env.GRIDEX_OPS_API_URL = 'http://localhost:3000/api/v1'
    delete process.env.ELKLART_DEMO_LOCAL_RUNTIME
    assert.throws(getGridexApiBaseUrl, /Elklart/)
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
