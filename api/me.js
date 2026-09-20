const { verify } = require("./_lib/session");

module.exports = (req, res) => {
  const sessionSecret = process.env.SESSION_SECRET;
  const cookies = req.cookies || {};

  res.setHeader("Cache-Control", "no-store");

  if (!sessionSecret) {
    res.status(200).json({ authenticated: false });
    return;
  }

  const ghData = verify(cookies.gh_session, sessionSecret);
  if (ghData) {
    res.status(200).json({
      authenticated: true,
      provider: "github",
      user: { login: ghData.login, name: ghData.name, avatarUrl: ghData.avatarUrl },
    });
    return;
  }

  const gData = verify(cookies.g_session, sessionSecret);
  if (gData) {
    res.status(200).json({
      authenticated: true,
      provider: "google",
      user: { login: gData.sub, name: gData.name, avatarUrl: gData.picture, email: gData.email },
    });
    return;
  }

  res.status(200).json({ authenticated: false });
};
