# Pryvee — M365 Governance & Privacy Platform

> AVG-compliant tooling voor IT-teams, MSPs en compliance-verantwoordelijken.

**Live:** https://jouwdomein.com  
**Status:** Beta — Redact live, Snapshot in ontwikkeling

---

## Modules

| Module | Status | Prijs | Beschrijving |
|--------|--------|-------|--------------|
| **Redact** | ✅ Live | €2,50/doc of €29/mnd | PII redactie uit PDF/DOCX, volledig in-browser |
| **Snapshot** | 🔨 In ontwikkeling | €149 eenmalig of €99/mnd | CIS M365 L1 audit, 79 checks, PDF rapport |
| **Guard** | 📅 Binnenkort | €49/mnd | Gastaccounts monitoring |
| **Clean** | 📅 Binnenkort | €49/mnd | Tenant lifecycle management |
| **Pryvee AI** | 📅 2026 | €99/mnd | Copilot blootstellingsscanner |

---

## Architectuur

```
GitHub Pages                    Cloudflare Workers
────────────────────────        ──────────────────────────────
index.html                      pryvee-api.pryveegovernance.workers.dev
redact.html                     ├── GET  /health
redact-tool.html                ├── POST /webhook  (Stripe events)
snapshot.html                   └── GET  /check    (licentiecheck)
setup-guide.html
                                Cloudflare KV
Stripe                          ──────────────────────────────
────────────────────────        Pryvee_LICENSES
Payment Links                   └── {session_id} → {plan, validUntil}
├── Per doc: €2,50
└── Maandelijks: €29/mnd
```

---

## Bestandsstructuur

```
/
├── index.html              # Landingspagina
├── redact.html             # Redact productpagina
├── redact-tool.html        # Werkende Redact tool
├── snapshot.html           # Snapshot productpagina
├── setup-guide.html        # Interne setup documentatie
└── README.md               # Dit bestand
```

---

## Redact Tool — Hoe werkt het

1. Gebruiker opent `redact-tool.html`
2. Paywall toont twee opties: €2,50 per doc of €29/mnd
3. Na klikken → redirect naar Stripe Payment Link
4. Na betaling → Stripe stuurt `checkout.session.completed` naar Worker
5. Worker slaat licentie op in KV (`session_id → {plan, validUntil}`)
6. Stripe redirect terug naar `redact-tool.html?session_id=xxx`
7. Tool checkt licentie bij Worker → unlock bij `valid: true`
8. Gebruiker uploadt PDF/DOCX → NER analyse → download geredacteerd document

### NER Engine
Regex-gebaseerde NER voor Nederlandse PII:
- **BSN** — elfproef validatie
- **IBAN** — NL format
- **E-mail** — standaard regex
- **Telefoon** — NL mobiel/vast/internationaal
- **Geboortedatum** — alleen met context (geboortedatum:/geboren op:)
- **KvK** — alleen met KvK-context
- **Adres** — postcode vereist in match
- **Kenteken** — koppelteken vereist
- **BIG/Paspoort** — context vereist
- **Namen** — alleen bij expliciete naam-triggers (werknemer:, dhr., mevr., etc.)

> **TODO productie:** Vervang regex NER door WASM-model (bijv. flair of spaCy via Pyodide) voor hogere nauwkeurigheid.

---

## Cloudflare Worker — pryvee-api

**URL:** `https://pryvee-api.pryveegovernance.workers.dev`

### Endpoints

| Method | Path | Beschrijving |
|--------|------|--------------|
| GET | `/health` | Status check |
| POST | `/webhook` | Stripe webhook ontvanger |
| GET | `/check?session_id=` | Licentie validatie |

### KV Binding
- Namespace: `Pryvee_LICENSES`
- ID: `e4c2a4bb5bd24006ab65d92ef176ae8f`
- Binding name in code: `LICENSES`

### Stripe Webhook
- Event: `checkout.session.completed`
- Endpoint: `https://pryvee-api.pryveegovernance.workers.dev/webhook`

---

## Stripe Configuratie

### Payment Links
| Plan | Link | Metadata |
|------|------|----------|
| Per document | `https://buy.stripe.com/test_4gM28t3QYaG06zW7SC8g001` | `plan=doc` |
| Maandelijks | `https://buy.stripe.com/test_aFa6oJcnubK40by5Ku8g000` | `plan=mnd` |

> ⚠️ Dit zijn **test** links. Vervang door live links voor productie.

### Success Redirect
Na betaling redirect Stripe naar:
```
https://jouwdomein.com/redact-tool.html?session_id={CHECKOUT_SESSION_ID}
```
Stripe vult `{CHECKOUT_SESSION_ID}` automatisch in.

---

## Productie Checklist

### Voor lancering
- [ ] Eigen domein koppelen (pryvee.io of pryvee.nl)
- [ ] Stripe test links vervangen door live links
- [ ] Stripe webhook signing secret valideren in Worker
- [ ] Google Analytics of Plausible toevoegen
- [ ] Cookie banner (vereist door AVG)
- [ ] Privacy policy pagina
- [ ] Algemene voorwaarden pagina
- [ ] KvK registratie

### Technische verbeteringen
- [ ] PDF-lib voor native PDF redactie (nu: .txt export)
- [ ] Mammoth.js DOCX reconstructie (nu: .txt export)
- [ ] WASM NER model voor betere naam/entiteit herkenning
- [ ] Batch upload voor maandabonnement
- [ ] E-mailbevestiging na betaling (Stripe + Resend.com)

### Snapshot module
- [ ] Azure App Registration aanmaken (multitenant SPA)
- [ ] MSAL.js integreren
- [ ] 79 CIS M365 L1 checks implementeren
- [ ] jsPDF rapport generatie
- [ ] Stripe product aanmaken

---

## Lokaal ontwikkelen

Geen build stap nodig — pure HTML/CSS/JS.

```bash
# Clone repo
git clone https://github.com/NielsKok-Labs/Pryvee.git
cd Pryvee

# Open in browser (of gebruik Live Server in VS Code)
open index.html
```

### Worker lokaal testen
```bash
npm install -g wrangler
wrangler login
cd api
wrangler dev
```
Worker draait dan op `http://localhost:8787`

---

## Productie aanbevelingen

### Nu (gratis tier volstaat)
- **Hosting:** GitHub Pages (gratis)
- **Worker:** Cloudflare Workers (gratis tot 100k requests/dag)
- **KV:** Cloudflare KV (gratis tot 1k schrijf-ops/dag)
- **Betalingen:** Stripe (2,9% + €0,25 per transactie)

### Bij groei (>100 klanten)
- **Analytics:** Plausible.io (€9/mnd, privacy-first, past bij Pryvee)
- **E-mail:** Resend.com (gratis tot 3k/mnd) voor betaalbevestigingen
- **Monitoring:** Cloudflare Workers Observability (gratis)
- **Uptime:** Better Uptime (gratis tier)

### Bij serieuze groei (>500 klanten)
- **Auth:** Upgrade naar echte auth (Clerk.com of Auth.js)
- **Database:** Cloudflare D1 (SQLite op de edge, gratis)
- **NER:** Hosted spaCy model of AWS Comprehend voor betere PII detectie
- **Support:** Crisp.chat of Intercom voor klantondersteuning
- **Boekhouding:** Moneybird koppelen aan Stripe webhooks

### Beveiliging productie
- Stripe webhook signing secret valideren:
  ```javascript
  // In worker.js toevoegen:
  const signature = request.headers.get('stripe-signature');
  // Valideer met je webhook secret uit Stripe Dashboard
  ```
- Content Security Policy header toevoegen
- Rate limiting op /check endpoint (max 10 req/min per IP)

---

## Contacten & Accounts

| Service | Account | Notitie |
|---------|---------|---------|
| GitHub | NielsKok-Labs/Pryvee | Broncode |
| Cloudflare | pryveegovernance | Workers + KV |
| Stripe | — | Betalingen (test mode) |

---

## Volgende stappen

1. **Deze week:** Domein koppelen + Stripe live zetten
2. **Volgende week:** Eerste betalende klanten testen
3. **Maand 2:** Snapshot module bouwen
4. **Maand 3:** Guard + Clean modules
5. **2026:** Pryvee AI (Copilot scanner)
