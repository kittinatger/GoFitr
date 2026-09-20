const { sign } = require("../../_lib/session");

module.exports = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !sessionSecret) {
    res.status(500).send("Google login is not configured. Missing environment variables.");
    return;
  }

  const { code, state } = req.query;
  const cookies = req.cookies || {};

  if (!code || !state || state !== cookies.g_oauth_state) {
    res.status(400).send("Invalid or expired login attempt. Please try logging in again.");
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  let tokenData;
  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    tokenData = await tokenResp.json();
  } catch (e) {
    res.status(502).send("Could not reach Google to exchange the login code.");
    return;
  }

  if (!tokenData || !tokenData.access_token) {
    const reason = (tokenData && (tokenData.error_description || tokenData.error)) || "unknown error";
    res.status(400).send("Google did not return an access token: " + reason);
    return;
  }

  let profile;
  try {
    const profileResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    profile = await profileResp.json();
  } catch (e) {
    res.status(502).send("Could not reach Google to fetch your profile.");
    return;
  }

  if (!profile || !profile.sub) {
    res.status(400).send("Could not read your Google profile.");
    return;
  }

  const sessionToken = sign(
    {
      sub: profile.sub,
      name: profile.name || profile.email || profile.sub,
      email: profile.email || "",
      picture: profile.picture || "",
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
    },
    sessionSecret
  );

  const sessionCookieAttrs = [
    `g_session=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (proto === "https") sessionCookieAttrs.push("Secure");

  res.setHeader("Set-Cookie", [
    "g_oauth_state=; Path=/; HttpOnly; Max-Age=0",
    sessionCookieAttrs.join("; "),
  ]);
  res.redirect("/");
};
