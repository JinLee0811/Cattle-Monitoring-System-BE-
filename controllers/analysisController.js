const Video = require("../models/Video");
const Alert = require("../models/Alert");
const roboflowService = require("../services/roboflowService");

class AnalysisController {
  // 특정 비디오의 분석 결과 조회
  async getAnalysisResult(req, res) {
    try {
      const { videoId } = req.params;

      const video = await Video.findById(videoId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      if (video.processingStatus === "pending" || video.processingStatus === "processing") {
        return res.json({
          videoId: video._id,
          status: video.processingStatus,
          message: "Analysis in progress. Please check again later.",
        });
      }

      if (video.processingStatus === "failed") {
        return res.status(500).json({
          error: "Analysis failed",
          message: video.errorMessage || "Error occurred during analysis",
        });
      }

      // 관련 알림 조회
      const alerts = await Alert.find({ videoId: video._id }).sort({ createdAt: -1 });

      res.json({
        videoId: video._id,
        filename: video.filename,
        uploadDate: video.uploadDate,
        analysisResult: video.analysisResult,
        weatherAtUpload: video.weatherAtUpload,
        audioAlert: video.audioAlert,
        alerts: alerts,
        status: video.processingStatus,
      });
    } catch (error) {
      console.error("❌ Analysis result retrieval failed:", error);
      res.status(500).json({ error: "Error occurred while retrieving analysis result" });
    }
  }

  // 모든 분석 결과 요약 조회
  async getAnalysisSummary(req, res) {
    try {
      const { days = 7 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // 최근 분석 결과 통계
      const stats = await Video.aggregate([
        {
          $match: {
            uploadDate: { $gte: startDate },
            processingStatus: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalVideos: { $sum: 1 },
            totalCows: {
              $sum: {
                $size: {
                  $filter: {
                    input: { $ifNull: ["$analysisResult.predictions", []] },
                    cond: { $eq: ["$$this.class", "cow"] },
                  },
                },
              },
            },
            totalCalves: {
              $sum: {
                $size: {
                  $filter: {
                    input: { $ifNull: ["$analysisResult.predictions", []] },
                    cond: { $eq: ["$$this.class", "calf"] },
                  },
                },
              },
            },
            averageConfidence: {
              $avg: "$analysisResult.confidence",
            },
          },
        },
      ]);

      // 최근 알림 조회
      const recentAlerts = await Alert.find({
        createdAt: { $gte: startDate },
      })
        .sort({ createdAt: -1 })
        .limit(parseInt(process.env.RECENT_ALERTS_LIMIT) || 10);

      // 날씨별 분석 결과
      const weatherStats = await Video.aggregate([
        {
          $match: {
            uploadDate: { $gte: startDate },
            processingStatus: "completed",
            weatherAtUpload: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$weatherAtUpload.current.description",
            count: { $sum: 1 },
            avgTemperature: { $avg: "$weatherAtUpload.current.temperature" },
          },
        },
      ]);

      res.json({
        period: `${days} days`,
        stats: stats[0] || {
          totalVideos: 0,
          totalCows: 0,
          totalCalves: 0,
          averageConfidence: 0,
        },
        recentAlerts,
        weatherStats,
      });
    } catch (error) {
      console.error("❌ Analysis summary retrieval failed:", error);
      res.status(500).json({ error: "Error occurred while retrieving analysis summary" });
    }
  }

  // 이상 행동 패턴 분석
  async getAbnormalBehaviorPatterns(req, res) {
    try {
      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const videos = await Video.find({
        uploadDate: { $gte: startDate },
        processingStatus: "completed",
        "analysisResult.behaviorAnalysis.hasAbnormalBehavior": true,
      }).select("analysisResult uploadDate");

      const behaviorPatterns = {};

      videos.forEach((video) => {
        const behaviors = video.analysisResult.behaviorAnalysis.behaviors || [];
        behaviors.forEach((behavior) => {
          if (!behaviorPatterns[behavior.type]) {
            behaviorPatterns[behavior.type] = {
              count: 0,
              dates: [],
              messages: [],
            };
          }
          behaviorPatterns[behavior.type].count++;
          behaviorPatterns[behavior.type].dates.push(video.uploadDate);
          behaviorPatterns[behavior.type].messages.push(behavior.message);
        });
      });

      // 시간대별 패턴 분석
      const hourlyPatterns = {};
      videos.forEach((video) => {
        const hour = video.uploadDate.getHours();
        if (!hourlyPatterns[hour]) {
          hourlyPatterns[hour] = 0;
        }
        hourlyPatterns[hour]++;
      });

      res.json({
        period: `${days} days`,
        behaviorPatterns,
        hourlyPatterns,
        totalAbnormalVideos: videos.length,
      });
    } catch (error) {
      console.error("❌ Abnormal behavior pattern analysis failed:", error);
      res.status(500).json({ error: "Error occurred during abnormal behavior pattern analysis" });
    }
  }

  // 소 개체 수 추적
  async getCattleTracking(req, res) {
    try {
      const { days = 7 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const videos = await Video.find({
        uploadDate: { $gte: startDate },
        processingStatus: "completed",
      }).select("analysisResult uploadDate");

      const dailyStats = {};

      videos.forEach((video) => {
        const date = video.uploadDate.toISOString().split("T")[0];
        const predictions = video.analysisResult.predictions || [];

        if (!dailyStats[date]) {
          dailyStats[date] = { cows: 0, calves: 0, videos: 0 };
        }

        dailyStats[date].cows += predictions.filter((p) => p.class === "cow").length;
        dailyStats[date].calves += predictions.filter((p) => p.class === "calf").length;
        dailyStats[date].videos += 1;
      });

      // 평균 계산
      const dates = Object.keys(dailyStats).sort();
      const avgCows =
        dates.length > 0
          ? dates.reduce((sum, date) => sum + dailyStats[date].cows, 0) / dates.length
          : 0;
      const avgCalves =
        dates.length > 0
          ? dates.reduce((sum, date) => sum + dailyStats[date].calves, 0) / dates.length
          : 0;

      res.json({
        period: `${days} days`,
        dailyStats,
        averages: {
          cows: Math.round(avgCows * 100) / 100,
          calves: Math.round(avgCalves * 100) / 100,
        },
        totalVideos: videos.length,
      });
    } catch (error) {
      console.error("❌ Cattle tracking failed:", error);
      res.status(500).json({ error: "Error occurred during cattle tracking" });
    }
  }

  // AI 서비스 상태 확인
  async getAIServiceStatus(req, res) {
    try {
      const aiStatus = await roboflowService.checkAIServiceStatus();

      res.json({
        ai_service: aiStatus,
        timestamp: new Date().toISOString(),
        backend_status: "running",
      });
    } catch (error) {
      console.error("❌ AI service status check failed:", error);
      res.status(500).json({
        error: "Error occurred while checking AI service status",
        ai_service: { status: "error", message: error.message },
      });
    }
  }
}

module.exports = new AnalysisController();
