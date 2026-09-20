const crypto = require("crypto");

module.exports = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("Google login is not configured (missing GOOGLE_CLIENT_ID).");
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  const cookieAttrs = [
    `g_oauth_state=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
  ];
  if (proto === "https") cookieAttrs.push("Secure");
  res.setHeader("Set-Cookie", cookieAttrs.join("; "));

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  res.redirect(authorizeUrl.toString());
};
