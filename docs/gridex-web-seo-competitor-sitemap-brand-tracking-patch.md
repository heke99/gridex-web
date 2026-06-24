# gridex_web_seo_competitor_sitemap_brand_tracking_patch

## Built

- Replaced the placeholder `G` mark in public/auth headers with real Gridex brand assets.
- Added brand assets under `public/brand/`:
  - `gridex-logo.svg`
  - `gridex-logo-inverted.svg`
  - `gridex-mark.svg`
  - `gridex-logo.png`
  - `gridex-og.png`
- Added `app/icon.svg` for app/favicon metadata.
- Added Organization/WebSite logo metadata and Open Graph image.
- Added Google Ads/GA4 tag loading with cookie consent gating.
- Added conversion event on `/teckna-avtal/tack?status=application_received`.
- Added environment variables for Google Ads and GA4.
- Added canonical host hardening:
  - `www.gridex.se` redirects to `gridex.se` with 308.
  - Vercel preview hosts receive `X-Robots-Tag: noindex, nofollow, noarchive`.
- Converted old SEO redirects to permanent redirects.
- Added `/elpriser/dagens-elpris` as a permanent redirect to `/elpriser/elpris-idag` to avoid duplicate canonical pages.
- Added missing guide page `/guider/spotpris-vs-rorligt-elpris` to remove broken internal link risk.
- Expanded SEO route content and XML sitemap coverage with competitor-inspired page clusters.
- Added HTML sitemap at `/sitemap`.
- Added ordlista hub and dynamic ordlista pages.
- Added elbolag/elhandlare/nätägare pages.

## New SEO clusters

### Elavtal

- `/elavtal/privat`
- `/elavtal/foretag`
- `/elavtal/brf`
- `/elavtal/villa`
- `/elavtal/hus`
- `/elavtal/lagenhet`
- `/elavtal/bostadsratt`
- `/elavtal/hyresratt`
- `/elavtal/radhus`
- `/elavtal/fritidshus`
- `/elavtal/sommarstuga`
- `/elavtal/avtalsformer`
- `/elavtal/mixpris`
- `/elavtal/portfoljpris`
- `/elavtal/anvisningspris`
- `/elavtal/tillsvidarepris`
- `/elavtal/vintersakrat-elpris`
- `/elavtal/el-till-inkopspris`
- `/elavtal/byta-elleverantor`
- `/elavtal/flytta-elavtal`
- `/elavtal/teckna-elavtal-vid-flytt`
- `/elavtal/uppsagningstid-elavtal`
- `/elavtal/bindningstid-elavtal`

### Elpriser

- `/elpriser/morgondagens-elpris`
- `/elpriser/negativt-elpris`
- `/elpriser/nord-pool`
- `/elpriser/elborsen`
- `/elpriser/elpris-per-kwh`
- `/elpriser/elpris-med-moms`
- `/elpriser/elpris-utan-moms`
- `/elpriser/elpris-vinter`
- `/elpriser/elpris-sommar`
- `/elpriser/helsingborg`
- `/elpriser/lund`
- `/elpriser/trelleborg`
- `/elpriser/kristianstad`
- `/elpriser/uppsala`
- `/elpriser/vasteras`
- `/elpriser/orebro`
- `/elpriser/linkoping`
- `/elpriser/jonkoping`
- `/elpriser/umea`
- `/elpriser/lulea`

### Guider

- `/guider/spotpris-vs-rorligt-elpris`
- `/guider/innan-du-tecknar-elavtal`
- `/guider/kontrollera-elavtal`
- `/guider/rabatter-pa-elavtal`
- `/guider/bindningstid-och-uppsagningstid`
- `/guider/anvisat-elavtal`
- `/guider/undvik-dolda-avgifter`
- `/guider/energieffektivisera-hemmet`
- `/guider/anvanda-mindre-el`
- `/guider/styr-din-elanvandning`
- `/guider/ladda-elbil-billigare`
- `/guider/varmepump-elforbrukning`
- `/guider/vad-drar-mest-el-i-hemmet`
- `/guider/sanka-elkostnaden`

### Ordlista

- `/ordlista`
- `/ordlista/kwh`
- `/ordlista/spotpris`
- `/ordlista/paslag`
- `/ordlista/elnatsavgift`
- `/ordlista/elhandelspris`
- `/ordlista/elomrade`
- `/ordlista/forbrukning`
- `/ordlista/anlaggnings-id`
- `/ordlista/matpunkt`
- `/ordlista/nord-pool`
- `/ordlista/bindningstid`
- `/ordlista/uppsagningstid`

### Elbolag / nätägare

- `/elbolag`
- `/elhandlare`
- `/natagare`
- `/natagare/elnatsavgift`
- `/elbolag/gridex-el-ab`
- `/elbolag/byta-fran-annat-elbolag`

## Still missing after this patch

- Deeper, non-thin original content for each new SEO page before aggressive backlink work.
- Real historical price tables/graphs per SE1-SE4 and city pages.
- Dataset JSON-LD for historical electricity price data.
- Full Google Search Console and Google Ads setup in production accounts.
- DNS/Vercel dashboard verification that `gridex.se` is the primary domain.
- Google Business Profile completion with correct `https://gridex.se/teckna-avtal` or homepage URL.
- Backlink assets: press page, data reports, shareable charts and outreach list.

## Validation run in patch workspace

- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed with existing warnings only.
- `npm run test:launch` passed.
- `npm run build` did not complete inside the sandbox before timeout. No TypeScript or lint errors were reported before timeout; run build locally after syncing the patch.
