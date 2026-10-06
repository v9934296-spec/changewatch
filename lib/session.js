const { getAuthClient } = require("./supabase");

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "changewatch_session";
const ACCESS_SUFFIX = "_access";
const REFRESH_SUFFIX = "_refresh";

function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  };
}

function accessCookieName() {
  return `${SESSION_COOKIE_NAME}${ACCESS_SUFFIX}`;
}

function refreshCookieName() {
  return `${SESSION_COOKIE_NAME}${REFRESH_SUFFIX}`;
}

function setSessionCookies(res, session) {
  if (!session?.access_token || !session?.refresh_token) return;

  const base = cookieBaseOptions();
  const accessMaxAge = Math.max(60, (session.expires_in || 3600)) * 1000;
  res.cookie(accessCookieName(), session.access_token, { ...base, maxAge: accessMaxAge });
  res.cookie(refreshCookieName(), session.refresh_token, {
    ...base,
    maxAge: 60 * 60 * 24 * 30 * 1000
  });
}

function clearSessionCookies(res) {
  const base = cookieBaseOptions();
  res.clearCookie(accessCookieName(), base);
  res.clearCookie(refreshCookieName(), base);
}

async function resolveSessionUser(req, res) {
  const access = req.cookies?.[accessCookieName()];
  const refresh = req.cookies?.[refreshCookieName()];
  if (!access && !refresh) return null;

  const authClient = getAuthClient();

  if (access) {
    const { data, error } = await authClient.auth.getUser(access);
    if (!error && data.user) {
      return { user: data.user, accessToken: access, refreshToken: refresh };
    }
  }

  if (refresh) {
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session?.user) {
      setSessionCookies(res, data.session);
      return {
        user: data.session.user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      };
    }
  }

  return null;
}

module.exports = {
  SESSION_COOKIE_NAME,
  accessCookieName,
  refreshCookieName,
  setSessionCookies,
  clearSessionCookies,
  resolveSessionUser
};
