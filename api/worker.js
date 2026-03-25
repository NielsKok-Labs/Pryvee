// Pryvee API Worker — met Clerk email-gebaseerde licenties
export default {
  async fetch(request, env) {

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    // ── GET /health ──────────────────────────────────────────
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), { headers: cors });
    }

    // ── POST /webhook — Stripe betaling geslaagd ─────────────
    if (request.method === 'POST' && url.pathname === '/webhook') {
      let event;
      try { event = await request.json(); }
      catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors }); }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_email || session.customer_details?.email;
        const plan = session.metadata?.plan || 'doc';

        if (!email) {
          return new Response(JSON.stringify({ error: 'No email in session' }), { status: 400, headers: cors });
        }

        const durationMs = plan === 'mnd'
          ? 30 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

        const license = {
          email,
          plan,
          validUntil: Date.now() + durationMs,
          createdAt: Date.now()
        };

        // Sla op onder email als key (genormaliseerd naar lowercase)
        await env.LICENSES.put(
          'email:' + email.toLowerCase(),
          JSON.stringify(license),
          { expirationTtl: Math.ceil(durationMs / 1000) + 3600 }
        );
      }

      return new Response(JSON.stringify({ received: true }), { headers: cors });
    }

    // ── GET /check-email?email=... ────────────────────────────
    if (request.method === 'GET' && url.pathname === '/check-email') {
      const email = url.searchParams.get('email');
      if (!email) {
        return new Response(JSON.stringify({ valid: false, reason: 'no_email' }), { headers: cors });
      }

      const raw = await env.LICENSES.get('email:' + email.toLowerCase());
      if (!raw) {
        return new Response(JSON.stringify({ valid: false, reason: 'not_found' }), { headers: cors });
      }

      const license = JSON.parse(raw);

      if (Date.now() > license.validUntil) {
        await env.LICENSES.delete('email:' + email.toLowerCase());
        return new Response(JSON.stringify({ valid: false, reason: 'expired' }), { headers: cors });
      }

      return new Response(JSON.stringify({
        valid: true,
        plan: license.plan,
        validUntil: license.validUntil
      }), { headers: cors });
    }

    // ── GET /check (legacy session_id check) ─────────────────
    if (request.method === 'GET' && url.pathname === '/check') {
      const sessionId = url.searchParams.get('session_id');
      if (!sessionId) {
        return new Response(JSON.stringify({ valid: false }), { headers: cors });
      }
      const raw = await env.LICENSES.get(sessionId);
      if (!raw) return new Response(JSON.stringify({ valid: false, reason: 'not_found' }), { headers: cors });
      const license = JSON.parse(raw);
      const valid = Date.now() < license.validUntil;
      return new Response(JSON.stringify({ valid, plan: license.plan }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });
  }
};
