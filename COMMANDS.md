# Gridex Web – säker lokal synk

Antagen projektmapp:

```text
/Users/hekmath/Desktop/Projects/gridex-web
```

Antagen zip i Downloads:

```text
gridex-web-customer-portal-api-2026-07-27.1.zip
```

## 1. Packa upp

```bash
rm -rf /tmp/gridex-web-20260727
mkdir -p /tmp/gridex-web-20260727
unzip -q ~/Downloads/gridex-web-customer-portal-api-2026-07-27.1.zip \
  -d /tmp/gridex-web-20260727
```

## 2. Dry-run utan radering

```bash
rsync -avhn --checksum --itemize-changes \
  --exclude='.env*' --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  /tmp/gridex-web-20260727/gridex-web-main/ \
  /Users/hekmath/Desktop/Projects/gridex-web/
```

Granska utskriften. Kommandot använder inte `--delete`.

## 3. Synkronisera

```bash
rsync -avh --checksum --itemize-changes \
  --exclude='.env*' --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  /tmp/gridex-web-20260727/gridex-web-main/ \
  /Users/hekmath/Desktop/Projects/gridex-web/
```

De tidigare versionsbundna filerna ersätts av stabila namn. Ta bort dem efter dry-run:

```bash
cd /Users/hekmath/Desktop/Projects/gridex-web
rm -f COMMANDS_2026-07-25.1.md \
      IMPLEMENTATION_2026-07-25.1.md \
      VERIFICATION_2026-07-25.1.md \
      docs/website-integration-2026-07-25.1.md \
      tests/website-api-2026-07-25-1.contract.test.mjs
```

## 4. Installera och verifiera

```bash
cd /Users/hekmath/Desktop/Projects/gridex-web
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci
npm run api:sync
npm run api:check
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
```

## 5. Staging

```bash
mkdir -p .local
cp tests/fixtures/staging-ops-flow.example.json .local/gridex-staging-e2e.json
# Fyll endast med godkända testidentiteter.

GRIDEX_API_KEY='gridex_test_xxxxxxxxx' \
GRIDEX_API_BASE_URL='https://godkand-staging.example/api/v1' \
GRIDEX_STAGING_E2E_FIXTURE="$PWD/.local/gridex-staging-e2e.json" \
npm run test:staging:ops
```

Ingen migration ingår i leveransen.
