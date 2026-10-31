// Relais Entretien Coach -> Mistral (Cloudflare Worker)
// Garde la clé Mistral côté serveur et autorise uniquement ton appli.
// Variables à créer dans Cloudflare (Settings > Variables and Secrets) :
//   MISTRAL_API_KEY  (Secret)  : ta clé Mistral
//   RELAY_CODE       (Secret)  : un code d'accès inventé (ex. 20 caractères au hasard)
//   ALLOWED_ORIGIN   (Text)    : l'adresse de ton appli, SANS chemin ni / final
//                                ex. https://ton-pseudo.github.io

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").replace(/\/+$/, "");
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-relay-code",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const json = (obj, status) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ message: "Méthode non autorisée" }, 405);
    if (origin !== allowed) return json({ message: "Origine non autorisée" }, 403);
    if (!env.RELAY_CODE || request.headers.get("x-relay-code") !== env.RELAY_CODE)
      return json({ message: "Code d'accès du relais incorrect" }, 403);

    let body;
    try { body = await request.json(); } catch { return json({ message: "Requête invalide" }, 400); }
    // On ne transmet que les champs utiles, et on plafonne la longueur des réponses.
    const payload = {
      model: String(body.model || "mistral-large-latest"),
      messages: Array.isArray(body.messages) ? body.messages : [],
      max_tokens: Math.min(Number(body.max_tokens) || 1500, 4000),
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
    };
    if (body.response_format) payload.response_format = body.response_format;

    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + env.MISTRAL_API_KEY },
      body: JSON.stringify(payload),
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, "content-type": "application/json" } });
  },
};
