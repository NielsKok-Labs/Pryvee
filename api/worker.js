// Pryvee API Worker — product-gescheiden licenties + HMAC session tokens
// Producten: snapshot, redact, essentials
// KV keys: "snapshot:email", "redact:email", "essentials:email"
// Secrets: TOKEN_SECRET (HMAC signing), STRIPE_WEBHOOK_SECRET (webhook validatie)

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

      // Stripe webhook signature validatie
      // Vereist STRIPE_WEBHOOK_SECRET in Cloudflare Worker secrets
      if (env.STRIPE_WEBHOOK_SECRET) {
        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 401, headers: cors });
        }
        const body = await request.text();
        const valid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
        if (!valid) {
          return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 401, headers: cors });
        }
        try { event = JSON.parse(body); }
        catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors }); }
      } else {
        console.warn('STRIPE_WEBHOOK_SECRET niet ingesteld — webhook validatie overgeslagen');
        try { event = await request.json(); }
        catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors }); }
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_email || session.customer_details?.email;
        const plan = session.metadata?.plan || 'snapshot';

        if (!email) {
          return new Response(JSON.stringify({ error: 'No email in session' }), { status: 400, headers: cors });
        }

        const durationMs = 30 * 24 * 60 * 60 * 1000;
        const validUntil = Date.now() + durationMs;
        const ttl = Math.ceil(durationMs / 1000) + 3600;

        const license = { email: email.toLowerCase(), plan, validUntil, createdAt: Date.now() };

        if (plan === 'essentials') {
          await env.LICENSES.put('snapshot:' + email.toLowerCase(), JSON.stringify({ ...license, product: 'snapshot' }), { expirationTtl: ttl });
          await env.LICENSES.put('redact:' + email.toLowerCase(), JSON.stringify({ ...license, product: 'redact' }), { expirationTtl: ttl });
        } else if (plan === 'snapshot' || plan === 'een') {
          await env.LICENSES.put('snapshot:' + email.toLowerCase(), JSON.stringify({ ...license, product: 'snapshot' }), { expirationTtl: ttl });
        } else if (plan === 'redact') {
          await env.LICENSES.put('redact:' + email.toLowerCase(), JSON.stringify({ ...license, product: 'redact' }), { expirationTtl: ttl });
        }
      }

      return new Response(JSON.stringify({ received: true }), { headers: cors });
    }

    // ── GET /check-email?email=...&product=... ────────────────
    // Valideert licentie en geeft een kortlevend HMAC-signed token terug
    if (request.method === 'GET' && url.pathname === '/check-email') {
      const email = url.searchParams.get('email');
      const product = url.searchParams.get('product') || 'snapshot';

      if (!email) {
        return new Response(JSON.stringify({ valid: false, reason: 'no_email' }), { headers: cors });
      }

      const key = product + ':' + email.toLowerCase();
      const raw = await env.LICENSES.get(key);

      if (!raw) {
        return new Response(JSON.stringify({ valid: false, reason: 'not_found' }), { headers: cors });
      }

      const license = JSON.parse(raw);

      if (Date.now() > license.validUntil) {
        await env.LICENSES.delete(key);
        return new Response(JSON.stringify({ valid: false, reason: 'expired' }), { headers: cors });
      }

      // Genereer HMAC-signed session token (geldig 60 minuten)
      const token = await generateToken(email.toLowerCase(), product, env.TOKEN_SECRET);

      return new Response(JSON.stringify({
        valid: true,
        plan: license.plan,
        product: license.product || product,
        validUntil: license.validUntil,
        token
      }), { headers: cors });
    }

    // ── POST /verify-token — valideer session token ───────────
    // Browser stuurt token mee bij elke scan — zonder geldig token geen scan
    if (request.method === 'POST' && url.pathname === '/verify-token') {
      let body;
      try { body = await request.json(); }
      catch { return new Response(JSON.stringify({ valid: false, reason: 'invalid_json' }), { status: 400, headers: cors }); }

      const { token, product } = body;

      if (!token || !product) {
        return new Response(JSON.stringify({ valid: false, reason: 'missing_fields' }), { status: 400, headers: cors });
      }

      const result = await verifyToken(token, product, env.TOKEN_SECRET);

      if (!result.valid) {
        return new Response(JSON.stringify({ valid: false, reason: result.reason }), { status: 401, headers: cors });
      }

      return new Response(JSON.stringify({ valid: true, email: result.email, product: result.product }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });
  }
};

// ── HMAC TOKEN HELPERS ────────────────────────────────────────

async function generateToken(email, product, secret) {
  const expiry = Date.now() + 60 * 60 * 1000; // 60 minuten
  const payload = `${email}|${product}|${expiry}`;
  const hmac = await sign(payload, secret);
  return btoa(`${payload}|${hmac}`);
}

async function verifyToken(token, expectedProduct, secret) {
  try {
    const decoded = atob(token);
    const parts = decoded.split('|');
    if (parts.length !== 4) return { valid: false, reason: 'malformed' };

    const [email, product, expiry, hmac] = parts;

    if (product !== expectedProduct) return { valid: false, reason: 'product_mismatch' };
    if (Date.now() > parseInt(expiry)) return { valid: false, reason: 'token_expired' };

    const payload = `${email}|${product}|${expiry}`;
    const expectedHmac = await sign(payload, secret);
    if (hmac !== expectedHmac) return { valid: false, reason: 'invalid_signature' };

    return { valid: true, email, product };
  } catch {
    return { valid: false, reason: 'token_error' };
  }
}

async function sign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── STRIPE WEBHOOK SIGNATURE VALIDATIE ───────────────────────
async function verifyStripeSignature(body, header, secret) {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    // Max 5 minuten oud
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const payload = `${timestamp}.${body}`;
    const expected = await sign(payload, secret);

    // Constant-time vergelijking (voorkomt timing attacks)
    return constantTimeEqual(signature, expected);
  } catch {
    return false;
  }
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
