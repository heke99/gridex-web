# Gridex SEO: backlinks, local SEO and measurement

This document is part of the public website SEO foundation. It keeps the link-building and measurement work explicit so the website does not rely on unsafe backlink shortcuts.

## Backlink principles

- Build links to useful assets first: `/elpriser/elpris-idag`, `/elpriser/spotpris-el`, `/elpriser/historiska-elpriser`, `/guider/vad-paverkar-elpriset`, `/guider/jamfor-elavtal-utan-att-bli-lurad`.
- Do not buy spam links, PBN links, automated directory links or irrelevant foreign links.
- Prefer links from Swedish energy, housing, villa, economy, local media, partner and business profile sources.
- Every outreach target should have a natural reason to link: data, guide value, local relevance or consumer education.

## Linkable assets to promote first

1. Elpris idag per SE1-SE4: `/elpriser/elpris-idag`
2. Spotpris explainer: `/elpriser/spotpris-el`
3. Elområden guide: `/guider/elomraden-se1-se2-se3-se4`
4. Compare electricity contracts guide: `/guider/jamfor-elavtal-utan-att-bli-lurad`
5. Local SE4/Skåne/Landskrona pages: `/elpriser/skane`, `/elpriser/landskrona`

## Local SEO checklist

- Create/verify Google Business Profile for Gridex AB.
- Keep company name, org number, website, email and address details consistent across official profiles.
- Build local pages only where the page has unique value: elområde, local area context, grid owner note, relevant FAQ and clear CTA.
- Start with Skåne and Landskrona before expanding to more cities.

## Search Console measurement

Track weekly:

- Indexed pages and sitemap coverage.
- Queries: `elpris idag`, `elpris nu`, `billigt elavtal`, `jämför elavtal`, `rörligt elpris`, `spotpris el`, `elpris se4`.
- CTR for money pages and guide pages.
- Pages with impressions but low CTR: improve title and description.
- Pages with good impressions but low conversion: improve CTA and internal links.
- 404s and redirects from old URLs: `/aktuella-elpriser`, `/elpris-se1`, `/elpris-se2`, `/elpris-se3`, `/elpris-se4`.
- Core Web Vitals for mobile.

## Verification

Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in production when Google Search Console provides the verification token. The public layout will emit the verification meta tag automatically.
