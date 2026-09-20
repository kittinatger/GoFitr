const { verify } = require("./_lib/session");

module.exports = (req, res) => {
  const sessionSecret = process.env.SESSION_SECRET;
  const cookies = req.cookies || {};
  const data = sessionSecret ? verify(cookies.gh_session, sessionSecret) : null;

  res.setHeader("Cache-Control", "no-store");

  if (!data) {
    res.status(200).json({ authenticated: false });
    return;
  }

  res.status(200).json({
    authenticated: true,
    user: { login: data.login, name: data.name, avatarUrl: data.avatarUrl },
  });
};
