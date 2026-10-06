const PLANS = {
  free: {
    maxWatches: 5,
    minIntervalMinutes: 360
  },

  pro: {
    maxWatches: 25,
    minIntervalMinutes: 15
  },

  power: {
    maxWatches: 100,
    minIntervalMinutes: 5
  }
};

module.exports = { PLANS };
