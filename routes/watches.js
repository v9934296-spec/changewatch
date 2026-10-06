const express = require("express");
const { getAdminClient } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const watchesService = require("../lib/watches-service");

const router = express.Router();

router.use(requireAuth);

function handleError(res, err) {
  if (err.status === 404) return res.status(404).json({ error: err.message });
  if (err.code === "PLAN_LIMIT" || err.code === "PLAN_INTERVAL") {
    return res.status(400).json({ error: err.message, code: err.code });
  }
  return res.status(400).json({ error: err.message || "Request failed." });
}

router.get("/", async (req, res) => {
  try {
    const admin = getAdminClient();
    const data = await watchesService.listWatchesAndAlerts(admin, req.user.id);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/", async (req, res) => {
  try {
    const admin = getAdminClient();
    const result = await watchesService.createWatch(admin, req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/:id/check", async (req, res) => {
  try {
    const admin = getAdminClient();
    const result = await watchesService.runCheckForUser(admin, req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/:id/pause", async (req, res) => {
  try {
    const admin = getAdminClient();
    const result = await watchesService.togglePause(admin, req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const admin = getAdminClient();
    const result = await watchesService.deleteWatch(admin, req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/:id/diff", async (req, res) => {
  try {
    const admin = getAdminClient();
    const result = await watchesService.listAlertsForWatch(admin, req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
