module.exports = (req, res) => {
  res.setHeader("Set-Cookie", [
    "gh_session=; Path=/; HttpOnly; Max-Age=0",
    "g_session=; Path=/; HttpOnly; Max-Age=0",
  ]);
  res.status(200).json({ ok: true });
};
