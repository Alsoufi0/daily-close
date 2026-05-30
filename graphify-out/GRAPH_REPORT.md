# Graph Report - daily-close  (2026-05-26)

## Corpus Check
- 159 files · ~120,527 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1016 nodes · 1822 edges · 63 communities (55 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9b930efc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `RequestUser` - 89 edges
2. `PrismaService` - 28 edges
3. `apiFetch()` - 27 edges
4. `NotificationsService` - 26 edges
5. `DashboardService` - 23 edges
6. `ReportsService` - 20 edges
7. `useLanguage()` - 18 edges
8. `DailyCloseService` - 17 edges
9. `ParsedPOSReport` - 16 edges
10. `WhatsAppService` - 15 edges

## Surprising Connections (you probably didn't know these)
- `OwnerScreen()` --calls--> `formatMoney()`  [INFERRED]
  apps/mobile/src/screens/OwnerScreen.tsx → shared/utils/money.ts
- `EmployeeClose()` --calls--> `formatMoney()`  [INFERRED]
  apps/web/components/employee-close.tsx → shared/utils/money.ts
- `OwnerDashboard()` --calls--> `formatMoney()`  [INFERRED]
  apps/web/components/owner-dashboard.tsx → shared/utils/money.ts
- `StoreForm()` --calls--> `getBrowserTimeZone()`  [INFERRED]
  apps/web/app/admin/stores/page.tsx → shared/timezones.ts
- `EmployeeScreen()` --calls--> `formatMoney()`  [INFERRED]
  apps/mobile/src/screens/EmployeeScreen.tsx → shared/utils/money.ts

## Communities (63 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (48): Screen, styles, initialReport, s, Step, STEP_TITLES, STEPS, FEATURES (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (16): MissedCloseService, NotificationsService, missingTable, prisma, service, user, escape(), money() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (18): DailyCloseController, DailyCloseService, baseInput, employeeUser, owner, ownerUser, { service }, { service, prisma } (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (19): CloverParser, GenericParser, NRSParser, confidenceFrom(), escapeRegExp(), parseMoneyToken(), pickBestMoney(), readMoney() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (37): dependencies, bcryptjs, class-transformer, class-validator, date-fns, i18next, @nestjs/common, @nestjs/config (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (33): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, versionCode, projectId, expo (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (16): HealthController, HealthModule, GoogleVisionOCRService, OcrModule, pickProvider(), resolveMode(), bufferToBlob(), makeOcrImageVariants() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (21): apiFetch(), bootstrapOwner(), deleteEmployee(), deleteNotification(), downloadReport(), downloadTodayCsv(), EmployeeRecord, extractApiErrorMessage() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (16): AuthModule, DailyCloseModule, DashboardModule, EmployeesModule, NotificationsModule, PosParsersModule, PrismaModule, ReportsModule (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (30): Build, code:bash (npm install), code:bash (npm run dev:mobile), code:bash (npm run typecheck), code:bash (npm run build), code:bash (npx vercel), code:bash (npx vercel --prod), code:text (docs/production-runbook.md) (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (10): ReportQueryDto, ReportsController, labels, ReportLang, ReportRow, ReportsService, close, owner (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (28): dependencies, clsx, date-fns, i18next, lucide-react, next, pdf-lib, react (+20 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (27): buildType, serviceAccountKeyPath, track, build, development, preview, production, cli (+19 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (10): CreateDailyCloseRecord, DailyCloseRepository, [deleted], employeeUser, idx, InMemoryPrisma, owner, row (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (23): dependencies, expo, expo-camera, expo-image-picker, expo-secure-store, expo-status-bar, react, react-native (+15 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (15): metadata, viewport, AuthBootstrap(), Footer(), dynamicPhraseRules, LanguageContext, LanguageContextValue, LanguageProvider() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (9): DashboardService, closeDate, employeeNoOwner, fixedNow, now, owner, prisma, service (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (4): CreateStoreDto, UpdateStoreDto, StoresController, StoresService

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (5): RequestUser, CachedUser, EmployeesController, NotificationsController, UserRole

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (7): items, demoSub, OwnerDashboard(), RequireAuth(), getSubscription(), startSubscriptionCheckout(), SubscriptionView

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (9): ApiError, createStore(), CreateStoreInput, deleteStore(), updateStore(), useSession(), Step, StoreRowWithMeta (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (16): description, devDependencies, prisma, typescript, name, private, scripts, build (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (5): FEATURES, ProductionLogin(), createBrowserSupabase(), UploadedReport, uploadPosReportFile()

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (10): EditCloseModal(), HistoryPanel(), Range, ranges, deleteDailyClose(), editDailyClose(), getOwnerHistory(), HistoryRow (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (15): App Store Readiness — Launch Checklist, code:bash (npx eas secret:create --name EXPO_PUBLIC_API_URL --value htt), code:bash (npx eas build --platform ios --profile preview), code:bash (npx eas build --platform ios --profile production), Costs to expect (year 1), Out of scope for v1 (do not block launch), Phase 0 — What's already done 🤖, Phase 1 — Production data layer (≈ 1 hour) ✋ (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (10): translatePhrase(), Dictionary, Language, languages, productionTranslations, supplementalTranslations, translate(), translations (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (4): service, SubscriptionsService, SubscriptionStatus, SubscriptionView

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (13): getProfile(), StoreRecord, dailyCloses, demoEmployees, demoOwner, missedCloseAlert, scannedReport, stores (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (3): AuthController, SupabaseAuthService, SessionProfile

### Community 29 - "Community 29"
Cohesion: 0.26
Nodes (3): InviteEmployeeDto, EmployeesService, SubscriptionGuard

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, paths (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (13): 1. Supabase, 2. API (NestJS) — Render, 3. Web — Vercel, 4. Mobile (Expo / EAS), 5. Missed-close cron, 6. Subscriptions / Stripe, 7. Pilot QA Acceptance, 8. Rollback (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.19
Nodes (7): ExportReportModal(), Quick, MetricCard(), MetricCardProps, listStores(), markNotificationRead(), ReportExportFilters

### Community 33 - "Community 33"
Cohesion: 0.28
Nodes (12): adaptive_fit(), main(), Generate app icon, adaptive-icon, and splash from source.jpg., Average the four corner pixels to infer the source's background color., Scale img to fit inside size x size, center on bg (or sampled corner)., Adaptive icon foreground: keep brand inside center 66% safe area, transparent bg, Center logo on brand-color splash., sample_bg() (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, strictPropertyInitialization (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (8): EmployeeClose(), Step, stepIndex(), StepProgress(), STEPS, finishDailyClose(), uploadReport(), preprocessReceipt()

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (10): compilerOptions, allowJs, incremental, isolatedModules, jsx, noEmit, plugins, exclude (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (6): DashboardController, controller, employee, ownerOne, ownerTwo, service

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, moduleResolution, noEmit, types, extends, include

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (5): employee, { NotFoundException }, owner, { service }, { service, prisma }

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (5): employee, { NotFoundException }, owner, prisma, service

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (5): authService, c, demoUser, fakeUser, guard

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): bytes, { createClient }, fs, sb, t0

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (4): { Client }, files, fs, path

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (5): buildCommand, devCommand, framework, installCommand, outputDirectory

### Community 47 - "Community 47"
Cohesion: 0.40
Nodes (3): commonTimeZones, getBrowserTimeZone(), StoreForm()

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (4): Generation tips, Mobile App Assets, Required files, Store screenshots (separate — don't commit, upload to App Store Connect / Play Console)

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (3): { Client }, { createClient }, USERS

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (3): collection, $schema, sourceRoot

## Knowledge Gaps
- **366 isolated node(s):** `installCommand`, `buildCommand`, `devCommand`, `framework`, `outputDirectory` (+361 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequestUser` connect `Community 18` to `Community 1`, `Community 2`, `Community 37`, `Community 38`, `Community 40`, `Community 41`, `Community 10`, `Community 13`, `Community 16`, `Community 17`, `Community 49`, `Community 28`, `Community 29`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `formatMoney()` connect `Community 23` to `Community 0`, `Community 19`, `Community 35`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `EmployeeScreen()` connect `Community 23` to `Community 0`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `installCommand`, `buildCommand`, `devCommand` to the rest of the system?**
  _371 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07062146892655367 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07188778492109878 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._