const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const http = require("http");

// 로그 데이터를 메모리에 저장 (실제 프로덕션에서는 DB 사용)
let logs = [];
// 최근 로그 전송 시간 (비디오/카메라별) 추적하여 빈도 제한
const lastLogEmittedAtByVideoId = new Map();
const LOG_MIN_INTERVAL_MS = parseInt(process.env.LOG_MIN_INTERVAL_MS || "30000", 10); // 기본 30초

// 로그 생성 함수
const createLog = (alertData, analysisResult, category = "behavior") => {
  const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const cameraId = alertData.videoId ? alertData.videoId.split("_")[1] || "1" : "1";

  // 영어 메시지 생성
  const getEnglishMessage = (alertData, analysisResult, category) => {
    if (alertData.message) {
      return alertData.message;
    }

    const cattleCount = analysisResult.cattle_count || 0;
    const abnormalCount = analysisResult.behavior_summary?.abnormal_count || 0;

    switch (category) {
      case "weather":
        return "Weather condition alert detected in the monitoring area";
      case "sound":
        return "Unusual sound pattern detected in the monitoring area";
      case "camera":
        return "Camera system issue detected";
      case "behavior":
      default:
        if (abnormalCount > 0) {
          return `Detected abnormal behavior in ${abnormalCount} out of ${cattleCount} cattle`;
        } else if (cattleCount > 0) {
          return `Normal behavior detected in ${cattleCount} cattle`;
        } else {
          return "No cattle detected in current frame";
        }
    }
  };

  const newLog = {
    id: logId,
    ts: new Date().toISOString(),
    category: category,
    severity: alertData.severity || "medium",
    camera: `Camera ${cameraId}`,
    location: alertData.location || "Farm Area",
    title: alertData.title || `${category.charAt(0).toUpperCase() + category.slice(1)} Alert`,
    message: getEnglishMessage(alertData, analysisResult, category),
    videoTime: alertData.videoTime || 0,
    cattleCount: analysisResult.cattle_count || 0,
    confidence: alertData.confidence || null,
    isRealtime: true,
    createdAt: new Date().toISOString(),
  };

  logs.unshift(newLog); // 최신 로그를 맨 앞에 추가
  logs = logs.slice(0, 100); // 최대 100개 로그 유지

  console.log("📝 New log created:", newLog);
  return newLog;
};

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5050; // 백엔드 포트
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5002"; // AI 서비스 포트

// 미들웨어 설정
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: process.env.EXPRESS_BODY_LIMIT || "100mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.EXPRESS_BODY_LIMIT || "100mb" }));

// 요청 제한 설정 (개발 환경에서는 비활성화)
if (process.env.NODE_ENV === "production") {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 각 IP당 100개 요청으로 제한
  });
  app.use(limiter);
} else {
  console.log("🚫 Rate limiting disabled for development");
}

// MongoDB 연결 (선택적 - 연결 실패해도 서버 계속 작동)
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("✅ MongoDB Atlas connection successful"))
    .catch((err) => {
      console.error("❌ MongoDB Atlas connection failed:", err);
      console.log("⚠️ Server will continue without database connection");
    });
} else {
  console.log("⚠️ No MongoDB URI provided - running without database");
}

// 라우터 설정 (인증 제거, 간소화)
app.use("/api/upload", require("./routes/upload"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/weather", require("./routes/weather"));
app.use("/api/analysis", require("./routes/analysis"));

// 로그 API 엔드포인트
app.get("/api/logs/all", (req, res) => {
  try {
    const { category, severity, camera } = req.query;

    let filteredLogs = [...logs];

    // 필터링
    if (category && category !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.category === category);
    }

    if (severity) {
      filteredLogs = filteredLogs.filter((log) => log.severity === severity);
    }

    if (camera) {
      filteredLogs = filteredLogs.filter((log) => log.camera.includes(camera));
    }

    res.json({
      success: true,
      logs: filteredLogs,
      total: filteredLogs.length,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 로그 삭제 API
app.delete("/api/logs/:logId", (req, res) => {
  try {
    const { logId } = req.params;

    const logIndex = logs.findIndex((log) => log.id === logId);
    if (logIndex === -1) {
      return res.status(404).json({ success: false, error: "Log not found" });
    }

    const deletedLog = logs.splice(logIndex, 1)[0];
    console.log("🗑️ Log deleted:", deletedLog.id);

    res.json({
      success: true,
      message: "Log deleted successfully",
      deletedLog: deletedLog,
    });
  } catch (error) {
    console.error("Error deleting log:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 모든 로그 삭제 API
app.delete("/api/logs", (req, res) => {
  try {
    const deletedCount = logs.length;
    logs = [];

    console.log(`🗑️ All logs deleted: ${deletedCount} logs removed`);

    res.json({
      success: true,
      message: "All logs deleted successfully",
      deletedCount: deletedCount,
    });
  } catch (error) {
    console.error("Error deleting all logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 헬스 체크 엔드포인트
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Cattle Monitoring System Backend is running",
    timestamp: new Date().toISOString(),
  });
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.stack);
  res.status(500).json({
    error: "Internal server error occurred",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// WebSocket 연결 관리
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // 실시간 프레임 분석 요청
  socket.on("analyze_frame", async (frameData) => {
    try {
      console.log(`🔍 Analyzing frame for video ${frameData.videoId} at ${frameData.videoTime}s`);
      console.log(`📤 Sending frame to AI service...`);

      // AI 서비스로 실시간 분석 요청
      const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze/realtime`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frame: frameData.frameBase64,
          video_id: frameData.videoId,
          video_time: frameData.videoTime,
        }),
      });

      if (!aiResponse.ok) {
        console.error(`❌ AI analysis failed: ${aiResponse.status}`);
        throw new Error(`AI analysis failed: ${aiResponse.status}`);
      }

      console.log(`✅ AI response received: ${aiResponse.status}`);
      const analysisResult = await aiResponse.json();
      console.log("🤖 AI Analysis Result:", {
        videoId: frameData.videoId,
        videoTime: frameData.videoTime,
        cattleCount: analysisResult.cattle_count,
        hasAbnormal: analysisResult.has_abnormal_behavior,
        cattle: analysisResult.cattle,
        behaviorSummary: analysisResult.behavior_summary,
        processingTime: analysisResult.processing_time,
      });

      // 다양한 카테고리의 알림 생성 - 빈도 조절
      const randomValue = Math.random();
      let shouldCreateAlert = false;
      let alertCategory = "behavior";
      let alertType = "behavior_analysis";
      let alertSeverity = "medium";
      let alertTitle = "Abnormal Behavior Detected";
      let alertMessage = "";

      if (randomValue < 0.15) {
        // 15% 확률로 behavior (기존보다 줄임)
        shouldCreateAlert = analysisResult.has_abnormal_behavior || analysisResult.cattle_count > 0;
        alertCategory = "behavior";
        alertType = "behavior_analysis";
        alertSeverity = analysisResult.behavior_summary?.abnormal_count > 0 ? "high" : "medium";
        alertTitle = "Abnormal Behavior Detected";
        alertMessage = `Detected abnormal behavior in ${analysisResult.behavior_summary?.abnormal_count || 0} out of ${analysisResult.cattle_count} cattle`;
      } else if (randomValue < 0.35) {
        // 20% 확률로 weather
        shouldCreateAlert = true;
        alertCategory = "weather";
        alertType = "weather_alert";
        const weatherTypes = [
          "Heavy Rain Warning",
          "Temperature Alert",
          "Wind Speed Alert",
          "Humidity Alert",
        ];
        const weatherSeverities = ["high", "medium", "low"];
        alertSeverity = weatherSeverities[Math.floor(Math.random() * weatherSeverities.length)];
        alertTitle = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
        alertMessage = `Weather condition detected: ${alertTitle.toLowerCase()} in the farm area`;
      } else if (randomValue < 0.55) {
        // 20% 확률로 sound
        shouldCreateAlert = true;
        alertCategory = "sound";
        alertType = "sound_alert";
        const soundTypes = [
          "Abnormal Noise Detected",
          "Animal Distress Call",
          "Equipment Malfunction",
          "Environmental Noise",
        ];
        const soundSeverities = ["high", "medium", "low"];
        alertSeverity = soundSeverities[Math.floor(Math.random() * soundSeverities.length)];
        alertTitle = soundTypes[Math.floor(Math.random() * soundTypes.length)];
        alertMessage = `Unusual sound pattern detected in the monitoring area`;
      } else if (randomValue < 0.75) {
        // 20% 확률로 camera
        shouldCreateAlert = true;
        alertCategory = "camera";
        alertType = "camera_alert";
        const cameraTypes = [
          "Camera Connection Lost",
          "Video Quality Issue",
          "Camera Maintenance Required",
          "Motion Detection Alert",
        ];
        const cameraSeverities = ["high", "medium", "low"];
        alertSeverity = cameraSeverities[Math.floor(Math.random() * cameraSeverities.length)];
        alertTitle = cameraTypes[Math.floor(Math.random() * cameraTypes.length)];
        alertMessage = `Camera system issue detected: ${alertTitle.toLowerCase()}`;
      }

      // 30초 빈도 제한 체크 (비디오별)
      const videoKey = frameData.videoId || socket.id;
      const now = Date.now();
      const lastAt = lastLogEmittedAtByVideoId.get(videoKey) || 0;

      if (now - lastAt >= LOG_MIN_INTERVAL_MS) {
        // 알림 또는 정상 로그 생성
        let alertData;

        if (shouldCreateAlert) {
          alertData = {
            id: `alert_${Date.now()}_${socket.id}`,
            type: alertType,
            severity: alertSeverity,
            title: alertTitle,
            message: alertMessage,
            videoId: frameData.videoId,
            videoTime: frameData.videoTime,
            cattleData: analysisResult.cattle,
            timestamp: new Date().toISOString(),
            createdAt: new Date(),
            confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
            location: `Camera ${Math.floor(Math.random() * 4) + 1}`,
          };
        } else {
          // 정상 운영 로그 (종류를 다양화)
          const normalVariants = [
            {
              category: "behavior",
              title: "Normal Activity",
              message: "Cattle behavior within normal range",
            },
            {
              category: "camera",
              title: "Routine Check Passed",
              message: "Camera system operating normally",
            },
            {
              category: "weather",
              title: "Stable Weather",
              message: "Weather conditions are stable in the farm area",
            },
            {
              category: "sound",
              title: "Ambient Sound Normal",
              message: "No unusual sound detected",
            },
          ];
          const pick = normalVariants[Math.floor(Math.random() * normalVariants.length)];
          alertCategory = pick.category;
          alertType = `${pick.category}_status`;
          alertSeverity = "low";
          alertTitle = pick.title;
          alertMessage = pick.message;

          alertData = {
            id: `normal_${Date.now()}_${socket.id}`,
            type: alertType,
            severity: alertSeverity,
            title: alertTitle,
            message: alertMessage,
            videoId: frameData.videoId,
            videoTime: frameData.videoTime,
            cattleData: analysisResult.cattle,
            timestamp: new Date().toISOString(),
            createdAt: new Date(),
            confidence: Math.random() * 0.2 + 0.7,
            location: `Camera ${Math.floor(Math.random() * 4) + 1}`,
          };
        }

        const finalAlertData = alertData;

        console.log("🚨 Alert generated:", {
          type: finalAlertData.type,
          severity: finalAlertData.severity,
          message: finalAlertData.message,
          videoId: finalAlertData.videoId,
          videoTime: finalAlertData.videoTime,
          cattleCount: analysisResult.cattle_count,
        });

        // 1. 로그 생성
        const newLog = createLog(finalAlertData, analysisResult, alertCategory);
        console.log("📝 Log created and added to backend memory, total logs:", logs.length);

        // 2. 실시간 알림 전송 (정상 로그는 알림 생략 가능)
        if (shouldCreateAlert) {
          socket.emit("abnormal_behavior_alert", finalAlertData);
          console.log("📡 Sent abnormal_behavior_alert to client:", socket.id);
        }

        // 3. 로그 업데이트 전송
        socket.emit("log_update", newLog);
        console.log("📡 Sent log_update to client:", socket.id, "logId:", newLog.id);

        // 2. 데이터베이스에 저장
        try {
          const Alert = require("./models/Alert");
          const alert = new Alert({
            type: alertData.type,
            severity: alertData.severity,
            title: alertData.title,
            message: alertData.message,
            videoId: alertData.videoId,
            videoTime: alertData.videoTime,
            cattleData: alertData.cattleData,
            isRead: false,
            isActive: true,
            createdAt: alertData.createdAt,
          });
          await alert.save();
          console.log("✅ Alert saved to database:", alert._id);
        } catch (dbError) {
          console.error("❌ Failed to save alert to database:", dbError);
        }

        // 3. 빈도 제한 기록 업데이트 (중복 방지)
        lastLogEmittedAtByVideoId.set(videoKey, now);
      }

      // 일반 분석 결과 전송
      console.log(
        `📤 Sending analysis result to client: ${analysisResult.cattle_count} cattle detected`
      );
      socket.emit("analysis_result", {
        timestamp: frameData.timestamp,
        videoTime: frameData.videoTime,
        result: analysisResult,
      });
    } catch (error) {
      console.error("❌ Real-time analysis error:", error);
      socket.emit("analysis_error", {
        error: error.message,
        videoId: frameData.videoId,
        videoTime: frameData.videoTime,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// 404 핸들러
app.use("*", (req, res) => {
  res.status(404).json({ error: "Requested endpoint not found" });
});

// 서버 시작 시 더미 데이터 초기화
const initializeDummyLogs = () => {
  const dummyLogs = [
    {
      id: "LOG-1",
      ts: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5분 전
      category: "behavior",
      severity: "high",
      camera: "Camera 1",
      location: "North Field",
      title: "Abnormal Behavior Detected",
      message: "Detected unusual movement patterns in cattle group",
      isRealtime: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "LOG-2",
      ts: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10분 전
      category: "weather",
      severity: "medium",
      camera: "Camera 2",
      location: "South Field",
      title: "Weather Alert",
      message: "Temperature rising above normal range",
      isRealtime: false,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: "LOG-3",
      ts: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15분 전
      category: "sound",
      severity: "low",
      camera: "Camera 3",
      location: "East Field",
      title: "Abnormal Sound Detected",
      message: "Unusual noise patterns detected",
      isRealtime: false,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ];

  logs = [...dummyLogs];
  console.log(`📝 Initialized ${logs.length} dummy logs`);
};

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔌 Socket.IO server ready for real-time connections`);

  // 더미 데이터 초기화
  initializeDummyLogs();
});

// Socket.IO 인스턴스를 내보내기 (다른 모듈에서 사용 가능)
module.exports = { app, server, io };
