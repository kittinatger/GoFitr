const { sign } = require("../../_lib/session");

module.exports = async (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !sessionSecret) {
    res.status(500).send("GitHub login is not configured. Missing environment variables.");
    return;
  }

  const { code, state } = req.query;
  const cookies = req.cookies || {};

  if (!code || !state || state !== cookies.gh_oauth_state) {
    res.status(400).send("Invalid or expired login attempt. Please try logging in again.");
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/github/callback`;

  let tokenData;
  try {
    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenData = await tokenResp.json();
  } catch (e) {
    res.status(502).send("Could not reach GitHub to exchange the login code.");
    return;
  }

  if (!tokenData || !tokenData.access_token) {
    const reason = (tokenData && (tokenData.error_description || tokenData.error)) || "unknown error";
    res.status(400).send("GitHub did not return an access token: " + reason);
    return;
  }

  let profile;
  try {
    const profileResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "GoFitr-App",
        Accept: "application/vnd.github+json",
      },
    });
    profile = await profileResp.json();
  } catch (e) {
    res.status(502).send("Could not reach GitHub to fetch your profile.");
    return;
  }

  if (!profile || !profile.login) {
    res.status(400).send("Could not read your GitHub profile.");
    return;
  }

  const sessionToken = sign(
    {
      login: profile.login,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url || "",
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
    },
    sessionSecret
  );

  const sessionCookieAttrs = [
    `gh_session=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (proto === "https") sessionCookieAttrs.push("Secure");

  res.setHeader("Set-Cookie", [
    "gh_oauth_state=; Path=/; HttpOnly; Max-Age=0",
    sessionCookieAttrs.join("; "),
  ]);
  res.redirect("/");
};
