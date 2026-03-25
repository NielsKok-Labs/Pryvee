// Pryvee API Worker
// Endpoints:
//   POST /webhook  — ontvangt Stripe checkout.session.completed
//   GET  /check    — checkt of sessie geldig is (?session_id=...)
//   GET  /health   — status check

export default {
  async fetch(request, env) {

    // CORS headers zodat de tool (andere origin) de Worker mag aanroepen
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    // ── GET /health ──────────────────────────────────────────
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), { headers: cors });
    }

    // ── POST /webhook — Stripe stuurt dit na betaling ────────
    if (request.method === 'POST' && url.pathname === '/webhook') {
      let event;
      try {
        event = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const sessionId = session.id;
        const plan = session.metadata?.plan || 'doc';

        // Bepaal hoe lang de licentie geldig is
        const durationMs = plan === 'mnd'
          ? 30 * 24 * 60 * 60 * 1000   // 30 dagen
          : 24 * 60 * 60 * 1000;        // 24 uur (per doc)

        const license = {
          plan,
          sessionId,
          validUntil: Date.now() + durationMs,
          createdAt: Date.now()
        };

        // Sla op in KV onder de Stripe session ID
        // Zorg dat je een KV namespace LICENSES hebt aangemaakt en gekoppeld!
        await env.LICENSES.put(sessionId, JSON.stringify(license), {
          expirationTtl: Math.ceil(durationMs / 1000) + 3600 // iets ruimer dan validUntil
        });
      }

      return new Response(JSON.stringify({ received: true }), { headers: cors });
    }

    // ── GET /check?session_id=... — tool vraagt licentie op ──
    if (request.method === 'GET' && url.pathname === '/check') {
      const sessionId = url.searchParams.get('session_id');

      if (!sessionId) {
        return new Response(JSON.stringify({ valid: false, reason: 'no_session_id' }), { headers: cors });
      }

      const raw = await env.LICENSES.get(sessionId);

      if (!raw) {
        return new Response(JSON.stringify({ valid: false, reason: 'not_found' }), { headers: cors });
      }

      const license = JSON.parse(raw);
      const valid = Date.now() < license.validUntil;

      return new Response(JSON.stringify({
        valid,
        plan: license.plan,
        validUntil: license.validUntil,
        reason: valid ? 'ok' : 'expired'
      }), { headers: cors });
    }

    // 404 voor alles anders
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });
  }
};
