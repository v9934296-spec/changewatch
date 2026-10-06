const { resolveSessionUser } = require("../lib/session");

async function requireAuth(req, res, next) {
  try {
    const session = await resolveSessionUser(req, res);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Authentication required." });
    }
    req.user = {
      id: session.user.id,
      email: session.user.email || ""
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Authentication required." });
  }
}

module.exports = { requireAuth };
