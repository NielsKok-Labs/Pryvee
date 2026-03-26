# Pryvee — M365 Governance & Privacy Platform

> CIS-compliant security auditing en PII-redactie voor IT-teams, MSPs en compliance-verantwoordelijken.

**Live:** [pryvee.io](https://nielskok-labs.github.io/Pryvee/) · **Status:** Beta — Redact ✅ live, Snapshot 🔨 in ontwikkeling

---

## Inhoudsopgave

- [Overzicht](#overzicht)
- [Architectuur](#architectuur)
- [Bestandsstructuur](#bestandsstructuur)
- [Modules](#modules)
- [Cloudflare Worker API](#cloudflare-worker-api)
- [Beveiliging](#beveiliging)
- [Lokaal ontwikkelen](#lokaal-ontwikkelen)
- [Productie checklist](#productie-checklist)
- [Roadmap](#roadmap)

---

## Overzicht

Pryvee is een lichtgewicht SaaS-platform gebouwd op GitHub Pages + Cloudflare Workers. Geen backend servers, geen zware infrastructuur — alles draait op de edge en in de browser van de gebruiker.

**Kernprincipes:**
- **Privacy by design** — geen tenant-data opgeslagen, alles verwerkt in de browser
- **Alleen-lezen** — Graph API scopes zijn uitsluitend read-only
- **Zero installatie** — OAuth consent flow, geen agents of scripts
- **AVG-compliant** — geen PII buiten de browser van de gebruiker

---

## Architectuur

```
┌─────────────────────────┐    ┌──────────────────────────────────────┐
│      GitHub Pages       │    │         Cloudflare Workers           │
│  ─────────────────────  │    │  ──────────────────────────────────  │
│  index.html             │◄──►│  pryvee-api.pryveegovernance         │
│  redact-tool.html       │    │  .workers.dev                        │
│  snapshot-tool.html     │    │                                      │
│  snapshot.html          │    │  GET  /health                        │
│  redact.html            │    │  POST /webhook   (Stripe events)     │
└─────────────────────────┘    │  GET  /check-email (licentie)        │
                                │  POST /verify-token (sessie)         │
         ┌──────────┐          └──────────────────────────────────────┘
         │  Stripe  │                         │
         │ Webhooks │◄────────────────────────┤
         └──────────┘                         ▼
                                ┌──────────────────────────────────────┐
                                │         Cloudflare KV                │
                                │  Pryvee_LICENSES                     │
                                │  snapshot:{email} → {plan, validUntil}│
                                │  redact:{email}   → {plan, validUntil}│
                                └──────────────────────────────────────┘

         ┌─────────────────────────────────────┐
         │        Microsoft Graph API          │
         │  (rechtstreeks vanuit de browser)   │
         │  Alleen-lezen OAuth scopes          │
         └─────────────────────────────────────┘
```

**Authenticatieflow Snapshot:**
1. Gebruiker logt in via MSAL.js (Microsoft OAuth)
2. Browser krijgt access token voor Graph API
3. Snapshot-tool roept Graph API rechtstreeks aan (geen proxy)
4. Pryvee Worker valideert licentietoken — géén tenant-data raakt Pryvee servers

---

## Bestandsstructuur

```
/
├── index.html              # Landingspagina (NL/EN)
├── redact.html             # Redact productpagina
├── redact-tool.html        # Werkende Redact tool (PII detectie + redactie)
├── snapshot.html           # Snapshot productpagina
├── snapshot-tool.html      # Snapshot scan tool (CIS M365 audit)
├── setup-guide.html        # Interne setup documentatie
├── README.md               # Dit bestand
└── api/
    └── worker.js           # Cloudflare Worker (licentie + Stripe webhooks)
```

---

## Modules

| Module | Status | Prijs | Beschrijving |
|--------|--------|-------|--------------|
| **Snapshot** | 🔨 Beta | €79/mnd of €249 eenmalig | CIS M365 L1 audit, 79 checks, management PDF |
| **Redact** | ✅ Live | €2,50/doc of €29/mnd | PII redactie uit PDF/DOCX, volledig in-browser |
| **Guard** | 📅 Q3 2025 | €49/mnd | Gastaccounts monitoring + alerting |
| **Clean** | 📅 Q4 2025 | €49/mnd | Tenant lifecycle management |
| **Pryvee AI** | 📅 2026 | €99/mnd | Copilot blootstellingsscanner |

### Bundels

| Bundel | Inhoud | Prijs |
|--------|--------|-------|
| **Essentials** | Snapshot + Redact | €99/mnd |
| **MSP Partner** | Alles + white-label + multi-tenant dashboard | Op maat |

---

## Cloudflare Worker API

**Base URL:** `https://pryvee-api.pryveegovernance.workers.dev`

### Endpoints

| Method | Path | Auth | Beschrijving |
|--------|------|------|--------------|
| `GET` | `/health` | — | Statuscheck |
| `POST` | `/webhook` | Stripe Signature | Stripe `checkout.session.completed` verwerken |
| `GET` | `/check-email?email=&product=` | — | Licentie valideren + HMAC token genereren |
| `POST` | `/verify-token` | — | HMAC token verifiëren (elke scan) |

### Licentie KV-structuur

```
snapshot:{email}  →  { email, plan, validUntil, createdAt, product }
redact:{email}    →  { email, plan, validUntil, createdAt, product }
```

TTL wordt automatisch ingesteld op `validUntil + 1 uur`.

### Stripe Plans

| `plan` in metadata | Geeft toegang tot |
|--------------------|-------------------|
| `snapshot` / `een` | snapshot |
| `redact` | redact |
| `essentials` | snapshot + redact |

### Vereiste Cloudflare Secrets

```
TOKEN_SECRET              # HMAC signing key (willekeurig, min 32 tekens)
STRIPE_WEBHOOK_SECRET     # Uit Stripe Dashboard → Webhooks
```

> ⚠️ Zonder `STRIPE_WEBHOOK_SECRET` accepteert de worker webhooks zonder validatie. **Verplicht instellen voor productie.**

---

## Beveiliging

### Wat goed is
- ✅ HMAC-signed session tokens (60 min expiry)
- ✅ Stripe webhook signature validatie (indien secret ingesteld)
- ✅ KV TTL — verlopen licenties verdwijnen automatisch
- ✅ Geen tenant-data op Pryvee servers
- ✅ Read-only Graph API scopes

### Aandachtspunten voor productie

| Prioriteit | Issue | Oplossing |
|------------|-------|-----------|
| 🔴 Hoog | `STRIPE_WEBHOOK_SECRET` optioneel | Harde fout als secret ontbreekt |
| 🔴 Hoog | `CORS: '*'` | Beperken tot eigen domein |
| 🟡 Middel | Geen rate limiting op `/check-email` | Cloudflare Rate Limiting rule toevoegen |
| 🟡 Middel | Geen CSP headers | Content-Security-Policy toevoegen in worker |
| 🟢 Laag | MSAL token in sessionStorage | Overwegen: memory-only token opslag |

### Graph API scopes (Snapshot)

```
SecurityEvents.Read.All
Policy.Read.All
User.Read.All
DeviceManagementConfiguration.Read.All
AuditLog.Read.All
Reports.Read.All
```

---

## Redact Tool

### Hoe het werkt

1. Gebruiker opent `redact-tool.html`
2. Paywall: €2,50/doc of €29/mnd
3. Na betaling → Stripe webhook → Worker slaat licentie op in KV
4. Stripe redirect → `redact-tool.html?session_id=xxx`
5. Tool valideert licentie bij Worker → unlock
6. PDF/DOCX upload → NER analyse → download geredacteerd document

### NER Engine (regex-gebaseerd)

| Type | Methode |
|------|---------|
| BSN | Elfproef validatie |
| IBAN | NL format regex |
| E-mail | RFC-5322 regex |
| Telefoon | NL mobiel/vast/internationaal |
| Geboortedatum | Alleen met context-trigger |
| KvK | Alleen met KvK-context |
| Adres | Postcode vereist in match |
| Kenteken | Koppelteken vereist |
| BIG/Paspoort | Context vereist |
| Namen | Alleen bij expliciete naam-triggers |

> **TODO productie:** Vervang regex NER door WASM-model (bijv. flair of spaCy via Pyodide) voor hogere nauwkeurigheid bij namen en adressen.

---

## Snapshot Tool

### CIS M365 L1 Checks (79 totaal)

| Categorie | Aantal checks | Licenties |
|-----------|--------------|-----------|
| Identiteit & MFA | 18 | Business Basic+ |
| Conditional Access | 12 | Business Premium / E3+ |
| Gastaccounts | 8 | Business Basic+ |
| Extern delen (SharePoint/OneDrive) | 10 | Business Basic+ |
| Exchange & E-mail beveiliging | 12 | Business Basic+ |
| Apparaatbeheer (Intune) | 8 | Business Premium / E3+ |
| Microsoft Secure Score | 5 | Business Basic+ |
| Audit & Logging | 6 | E3+ |

> Checks die niet van toepassing zijn op de licentie van de tenant worden automatisch gemarkeerd als "N/A" in het rapport.

### Ondersteunde licenties

| Licentie | Ondersteuning |
|----------|--------------|
| Microsoft 365 Business Basic | ✅ ~45 checks actief |
| Microsoft 365 Business Standard | ✅ ~50 checks actief |
| Microsoft 365 Business Premium | ✅ ~65 checks actief |
| Microsoft 365 E3 | ✅ ~70 checks actief |
| Microsoft 365 E5 | ✅ Alle 79 checks actief |

### PDF Rapport secties

1. Executive Summary (risicoscore + top bevindingen)
2. Risico-overzicht (grafiek per categorie)
3. Secure Score analyse
4. CIS compliance matrix (alle 79 checks)
5. Geprioriteerd actieplan

---

## Lokaal ontwikkelen

```bash
# Clone repo
git clone https://github.com/NielsKok-Labs/Pryvee.git
cd Pryvee

# Frontend starten (geen build stap nodig — pure HTML/CSS/JS)
open index.html
# of gebruik Live Server in VS Code
```

### Worker lokaal testen

```bash
npm install -g wrangler
wrangler login
cd api
wrangler dev
```

Worker draait dan op `http://localhost:8787`.

**KV lokaal gebruiken:**
```bash
wrangler kv:namespace create "LICENSES" --preview
# Voeg preview_id toe aan wrangler.toml
```

---

## Productie Checklist

### Vóór lancering

- [ ] Eigen domein koppelen (pryvee.io of pryvee.nl)
- [ ] `STRIPE_WEBHOOK_SECRET` instellen in Cloudflare secrets
- [ ] `TOKEN_SECRET` instellen in Cloudflare secrets
- [ ] Stripe test links vervangen door live links
- [ ] CORS beperken tot eigen domein in `worker.js`
- [ ] Rate limiting instellen op `/check-email` (max 10 req/min per IP)
- [ ] CSP headers toevoegen
- [ ] Cookie banner (AVG-vereiste)
- [ ] Privacy policy pagina
- [ ] Algemene voorwaarden pagina
- [ ] KvK registratie

### Azure App Registration (Snapshot)

- [ ] Multitenant SPA registratie aanmaken
- [ ] Redirect URI instellen: `https://jouwdomein.com/snapshot-tool.html`
- [ ] Scopes toewijzen: zie [Graph API scopes](#graph-api-scopes-snapshot)
- [ ] Client ID updaten in `snapshot-tool.html`

### Technische verbeteringen

- [ ] jsPDF rapport generatie voltooien (grafieken + managementstijl)
- [ ] Alle 79 CIS checks implementeren in `snapshot-tool.html`
- [ ] Licentiedifferentiatie per M365-licentieniveau
- [ ] PDF-lib voor native PDF redactie (nu: .txt export)
- [ ] WASM NER model voor betere naam/entiteit herkenning
- [ ] E-mailbevestiging na betaling (Stripe + Resend.com)

---

## Roadmap

| Milestone | Target | Status |
|-----------|--------|--------|
| Redact v1 | Q1 2025 | ✅ Live |
| Snapshot beta | Q2 2025 | 🔨 In ontwikkeling |
| Guard module | Q3 2025 | 📅 Gepland |
| Clean module | Q4 2025 | 📅 Gepland |
| MSP multi-tenant dashboard | Q1 2026 | 📅 Gepland |
| Pryvee AI (Copilot scanner) | Q2 2026 | 📅 Gepland |

---

## Contacten & Accounts

| Service | Account | Gebruik |
|---------|---------|---------|
| GitHub | NielsKok-Labs/Pryvee | Broncode + GitHub Pages hosting |
| Cloudflare | pryveegovernance | Workers + KV opslag |
| Stripe | — | Betalingen (test mode → live) |
| Microsoft Azure | — | App Registration voor MSAL/Graph |

---

## Licentie

© 2025 Pryvee · Alle rechten voorbehouden
