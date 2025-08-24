const express = require("express");
const router = express.Router();
const Video = require("../models/Video");
const Alert = require("../models/Alert");

// GET /api/logs - 로그 목록 조회 (시간/영상별)
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, videoId, type, severity } = req.query;

    const query = {};

    // 날짜 범위 필터
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (videoId) query.videoId = videoId;
    if (type) query.type = type;
    if (severity) query.severity = severity;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("videoId", "filename originalName uploadDate");

    const total = await Alert.countDocuments(query);

    // 시간대별 통계
    const hourlyStats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
          highSeverity: { $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 타입별 통계
    const typeStats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          avgSeverity: {
            $avg: { $indexOfArray: [["low", "medium", "high", "critical"], "$severity"] },
          },
        },
      },
    ]);

    res.json({
      logs: alerts,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      hourlyStats,
      typeStats,
    });
  } catch (error) {
    console.error("❌ Logs retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving logs" });
  }
});

// GET /api/logs/video/:videoId - 특정 비디오의 로그 조회
router.get("/video/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    const { limit = 100 } = req.query;

    const alerts = await Alert.find({ videoId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("videoId", "filename originalName uploadDate");

    // 비디오 정보
    const video = await Video.findById(videoId).select(
      "filename originalName uploadDate analysisResult"
    );

    res.json({
      video,
      logs: alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error("❌ Video logs retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving video logs" });
  }
});

// GET /api/logs/timeline - 타임라인 로그 조회
router.get("/timeline", async (req, res) => {
  try {
    const { days = 7, type } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = { createdAt: { $gte: startDate } };
    if (type) query.type = type;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .populate("videoId", "filename originalName");

    // 날짜별 그룹화
    const timeline = {};
    alerts.forEach((alert) => {
      const date = alert.createdAt.toISOString().split("T")[0];
      if (!timeline[date]) {
        timeline[date] = [];
      }
      timeline[date].push(alert);
    });

    res.json({
      timeline,
      period: `${days} days`,
      totalEvents: alerts.length,
    });
  } catch (error) {
    console.error("❌ Timeline logs retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving timeline logs" });
  }
});

// GET /api/logs/statistics - 로그 통계
router.get("/statistics", async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = { createdAt: { $gte: startDate } };

    // 전체 통계
    const totalStats = await Alert.aggregate([
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

    // 타입별 통계
    const typeStats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          highSeverity: { $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] } },
        },
      },
    ]);

    // 일별 통계
    const dailyStats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          highSeverity: { $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      period: `${days} days`,
      totalStats: totalStats[0] || { total: 0, unread: 0, highSeverity: 0 },
      typeStats,
      dailyStats,
    });
  } catch (error) {
    console.error("❌ Log statistics retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving log statistics" });
  }
});

module.exports = router;
