// netlify/functions/github-exchange.js
// Exchanges the OAuth "code" for an access token securely on the server side.
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
function respond(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders() };
  if (event.httpMethod !== "POST") return respond(405, { error: "Method Not Allowed" });

  try {
    const { code, redirect_uri } = JSON.parse(event.body || "{}");
    if (!code) return respond(400, { error: "missing code" });

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri
      })
    });
    const json = await res.json();
    if (!res.ok || json.error) return respond(400, json);

    return respond(200, {
      access_token: json.access_token,
      token_type: json.token_type,
      scope: json.scope
    });
  } catch (e) {
    return respond(500, { error: "server error" });
  }
};
