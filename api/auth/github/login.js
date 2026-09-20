const crypto = require("crypto");

module.exports = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("GitHub login is not configured (missing GITHUB_CLIENT_ID).");
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/github/callback`;

  const cookieAttrs = [
    `gh_oauth_state=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
  ];
  if (proto === "https") cookieAttrs.push("Secure");
  res.setHeader("Set-Cookie", cookieAttrs.join("; "));

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "read:user");
  authorizeUrl.searchParams.set("state", state);

  res.redirect(authorizeUrl.toString());
};
