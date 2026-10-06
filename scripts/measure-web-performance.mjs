// Read-only synthetic measurements. Use a production build, never next dev.
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const origin = new URL(process.env.GRIDEX_PERF_ORIGIN ?? 'http://127.0.0.1:3100')
const paths = (process.env.GRIDEX_PERF_PATHS ?? '/,/guider').split(',')
const samples = Number(process.env.GRIDEX_PERF_SAMPLES ?? 3)
if (!Number.isInteger(samples) || samples < 1 || samples > 10) throw new Error('Use 1–10 samples')
if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('HTTP origin required')
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const path of paths) {
    const url = new URL(path, origin)
    if (url.origin !== origin.origin || url.search) throw new Error('Same-origin paths without query strings required')
    for (let sample = 0; sample < samples; sample += 1) {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
      const page = await context.newPage()
      const prefetches = []
      await page.addInitScript(() => {
        window.__gridexPerf = { lcpMs: null, cls: 0, longTasks: 0 }
        for (const [type, record] of [
          ['largest-contentful-paint', entry => { window.__gridexPerf.lcpMs = entry.startTime }],
          ['layout-shift', entry => { if (!entry.hadRecentInput) window.__gridexPerf.cls += entry.value }],
          ['longtask', () => { window.__gridexPerf.longTasks += 1 }],
        ]) {
          try { new PerformanceObserver(list => list.getEntries().forEach(record)).observe({ type, buffered: true }) } catch {}
        }
      })
      page.on('request', request => {
        const requestUrl = new URL(request.url())
        if (requestUrl.origin === origin.origin && requestUrl.searchParams.has('_rsc')) prefetches.push(requestUrl.pathname)
      })
      // Do not trigger advertising, writes or external requests during a measurement.
      await page.route('**/*', route => {
        const request = route.request()
        if (new URL(request.url()).origin !== origin.origin || !['GET', 'HEAD'].includes(request.method())) return route.abort()
        return route.continue()
      })
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      if (!response?.ok()) throw new Error(`Page ${path} returned ${response?.status()}`)
      await page.waitForTimeout(3_000)
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0]
        const resources = performance.getEntriesByType('resource')
        const scripts = resources.filter(entry => new URL(entry.name).pathname.endsWith('.js'))
        return {
          ttfbMs: navigation.responseStart,
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          ...window.__gridexPerf,
          scriptRequests: scripts.length,
          scriptDecodedBytes: scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
          resourceDecodedBytes: resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
          resourceRequests: resources.length,
        }
      })
      results.push({ path, sample: sample + 1, ...metrics, prefetchRequests: prefetches.length, prefetchPaths: prefetches })
      await context.close()
    }
  }
} finally { await browser.close() }
const report = { measuredAt: new Date().toISOString(), origin: origin.origin, viewport: '1365x900', observationMs: 3_000, samples, results }
if (process.env.GRIDEX_PERF_OUTPUT) await writeFile(process.env.GRIDEX_PERF_OUTPUT, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
