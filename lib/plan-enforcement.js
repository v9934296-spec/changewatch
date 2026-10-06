const { PLANS } = require("./plans");

function planLabel(plan) {
  return PLANS[plan] ? plan : "free";
}

function validateWatchCreation({ plan, watchCount, intervalMinutes }) {
  const tier = PLANS[planLabel(plan)] || PLANS.free;

  if (watchCount >= tier.maxWatches) {
    const name = planLabel(plan);
    const cap = tier.maxWatches;
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      ok: false,
      code: "PLAN_LIMIT",
      error: `${label} accounts support up to ${cap} watches.`
    };
  }

  const interval = Number(intervalMinutes);
  if (interval < tier.minIntervalMinutes) {
    const name = planLabel(plan);
    const min = tier.minIntervalMinutes;
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      ok: false,
      code: "PLAN_INTERVAL",
      error: `${label} accounts require checks at least every ${min} minutes.`
    };
  }

  return { ok: true };
}

module.exports = {
  planLabel,
  validateWatchCreation
};
