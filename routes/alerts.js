const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");

// GET /api/alerts - 알림 목록 조회
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, type, severity, isRead, videoId } = req.query;

    const query = {};
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (videoId) query.videoId = videoId;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("videoId", "filename originalName");

    const total = await Alert.countDocuments(query);

    // 알림 통계
    const stats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: ["$isRead", 0, 1] } },
          highSeverity: { $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] } },
        },
      },
    ]);

    res.json({
      alerts,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      stats: stats[0] || { total: 0, unread: 0, highSeverity: 0 },
    });
  } catch (error) {
    console.error("❌ Alerts retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving alerts" });
  }
});

// GET /api/alerts/recent - 최근 알림 조회 (대시보드용)
router.get("/recent", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const alerts = await Alert.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("videoId", "filename originalName");

    res.json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error("❌ Recent alerts retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving recent alerts" });
  }
});

// PATCH /api/alerts/:id/read - 알림 읽음 처리
router.patch("/:id/read", async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json({ message: "Alert marked as read", alert });
  } catch (error) {
    console.error("❌ Alert read status update failed:", error);
    res.status(500).json({ error: "Error occurred while updating alert status" });
  }
});

// PATCH /api/alerts/read-all - 모든 알림 읽음 처리
router.patch("/read-all", async (req, res) => {
  try {
    const result = await Alert.updateMany({ isRead: false }, { isRead: true });

    res.json({
      message: "All alerts marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Bulk alert read status update failed:", error);
    res.status(500).json({ error: "Error occurred while updating alert status" });
  }
});

// DELETE /api/alerts/:id - 알림 삭제
router.delete("/:id", async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json({ message: "Alert deleted successfully" });
  } catch (error) {
    console.error("❌ Alert deletion failed:", error);
    res.status(500).json({ error: "Error occurred while deleting alert" });
  }
});

module.exports = router;
