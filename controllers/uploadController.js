const Video = require("../models/Video");
const Alert = require("../models/Alert");
const roboflowService = require("../services/roboflowService");
const weatherService = require("../services/weatherService");
const fs = require("fs");
const path = require("path");

class UploadController {
  // 파일 업로드 및 분석 처리 (소 CCTV 영상)
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("📹 CCTV video upload started:", req.file.originalname);

      // 파일 정보 저장
      const video = new Video({
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileType: req.file.mimetype.startsWith("video/") ? "video" : "image",
        processingStatus: "processing",
      });

      await video.save();

      // 비동기로 분석 처리 시작
      this.processFileAnalysis(video._id, req.file.path, req.body.lat, req.body.lon);

      res.status(201).json({
        message: "CCTV video upload successful",
        videoId: video._id,
        filename: video.filename,
        status: "processing",
      });
    } catch (error) {
      console.error("❌ CCTV video upload failed:", error);
      res.status(500).json({ error: "Error occurred during video upload" });
    }
  }

  // 파일 분석 처리 (비동기) - 소 CCTV 영상 분석
  async processFileAnalysis(videoId, filePath, lat, lon) {
    try {
      console.log("🔍 CCTV video analysis started:", videoId);

      // 1. Roboflow AI 분석 (소 디텍팅)
      const analysisResult = await roboflowService.analyzeVideo(filePath);

      // 2. 이상 행동 감지 (소가 누워있거나 싸우는 경우)
      const behaviorAnalysis = await this.detectAbnormalBehavior(analysisResult);

      // 3. 날씨 정보 가져오기 (선택사항)
      let weatherData = null;
      let weatherAlert = null;
      if (lat && lon) {
        weatherData = await weatherService.getCurrentWeather(lat, lon);
        weatherAlert = await this.checkWeatherAlert(weatherData);
      }

      // 4. 비디오 정보 업데이트
      const updateData = {
        analysisResult: {
          ...analysisResult,
          behaviorAnalysis,
          weatherAlert,
        },
        weatherAtUpload: weatherData,
        processingStatus: "completed",
      };

      const video = await Video.findByIdAndUpdate(videoId, updateData, { new: true });

      // 5. 알림 생성
      await this.createAlerts(video, analysisResult, behaviorAnalysis, weatherAlert);

      console.log("✅ CCTV video analysis completed:", videoId);
    } catch (error) {
      console.error("❌ CCTV video analysis failed:", error);

      // 에러 상태로 업데이트
      await Video.findByIdAndUpdate(videoId, {
        processingStatus: "failed",
        errorMessage: error.message,
      });
    }
  }

  // 이상 행동 감지 (소가 누워있거나 싸우는 경우)
  async detectAbnormalBehavior(analysisResult) {
    const behaviors = [];
    let hasAbnormalBehavior = false;

    const predictions = analysisResult.predictions || [];

    // 소 개체 감지
    const cows = predictions.filter((p) => p.class === "cow");
    const calves = predictions.filter((p) => p.class === "calf");

    // 1. 소가 누워있는 경우 감지
    if (cows.length > 0) {
      // 간단한 휴리스틱: 바운딩 박스의 높이가 너비보다 작으면 누워있을 가능성
      const lyingCows = cows.filter((cow) => {
        const bbox = cow.bbox;
        const width = bbox[2] - bbox[0];
        const height = bbox[3] - bbox[1];
        return height < width * 0.7; // 높이가 너비의 70% 미만이면 누워있음
      });

      if (lyingCows.length > 0) {
        hasAbnormalBehavior = true;
        behaviors.push({
          type: "lying",
          message: `${lyingCows.length} cattle detected lying down`,
          count: lyingCows.length,
          confidence: lyingCows.reduce((sum, cow) => sum + cow.confidence, 0) / lyingCows.length,
        });
      }
    }

    // 2. 소가 싸우는 경우 감지 (간단한 휴리스틱)
    if (cows.length >= 2) {
      // 소들이 서로 가까이 있고 겹치는 영역이 있으면 싸우는 가능성
      const fightingPairs = [];

      for (let i = 0; i < cows.length; i++) {
        for (let j = i + 1; j < cows.length; j++) {
          const cow1 = cows[i];
          const cow2 = cows[j];

          // 두 소의 바운딩 박스가 겹치는지 확인
          const overlap = this.calculateOverlap(cow1.bbox, cow2.bbox);
          const distance = this.calculateDistance(cow1.bbox, cow2.bbox);

          if (overlap > 0.1 || distance < 50) {
            // 10% 이상 겹치거나 50픽셀 이내
            fightingPairs.push([cow1, cow2]);
          }
        }
      }

      if (fightingPairs.length > 0) {
        hasAbnormalBehavior = true;
        behaviors.push({
          type: "fighting",
          message: `${fightingPairs.length} pairs of cattle detected fighting`,
          count: fightingPairs.length,
          confidence: 0.8, // 높은 신뢰도
        });
      }
    }

    return {
      hasAbnormalBehavior,
      behaviors,
      totalCows: cows.length,
      totalCalves: calves.length,
    };
  }

  // 날씨 알림 확인 (단순 날씨 정보)
  async checkWeatherAlert(weatherData) {
    if (!weatherData || !weatherData.current) return null;

    const { temperature, humidity, description } = weatherData.current;
    const alerts = [];

    // 소에게 안좋은 날씨 조건
    if (temperature > 30) {
      alerts.push({
        type: "high_temperature",
        severity: "high",
        message: `Temperature is ${temperature}°C, which is high for cattle`,
        temperature,
      });
    } else if (temperature < 5) {
      alerts.push({
        type: "low_temperature",
        severity: "high",
        message: `Temperature is ${temperature}°C, which is low for cattle`,
        temperature,
      });
    }

    if (humidity > 80) {
      alerts.push({
        type: "high_humidity",
        severity: "medium",
        message: `Humidity is ${humidity}%, which is high`,
        humidity,
      });
    }

    // 강우/강설 등
    const badWeatherKeywords = ["rain", "snow", "storm", "thunder", "비", "눈", "폭풍"];
    if (badWeatherKeywords.some((keyword) => description.toLowerCase().includes(keyword))) {
      alerts.push({
        type: "bad_weather",
        severity: "medium",
        message: `Bad weather detected: ${description}`,
        description,
      });
    }

    return alerts.length > 0 ? alerts : null;
  }

  // 바운딩 박스 겹침 계산
  calculateOverlap(bbox1, bbox2) {
    const [x1_1, y1_1, x2_1, y2_1] = bbox1;
    const [x1_2, y1_2, x2_2, y2_2] = bbox2;

    const x_overlap = Math.max(0, Math.min(x2_1, x2_2) - Math.max(x1_1, x1_2));
    const y_overlap = Math.max(0, Math.min(y2_1, y2_2) - Math.max(y1_1, y1_2));

    const overlap_area = x_overlap * y_overlap;
    const area1 = (x2_1 - x1_1) * (y2_1 - y1_1);
    const area2 = (x2_2 - x1_2) * (y2_2 - y1_2);

    return overlap_area / Math.min(area1, area2);
  }

  // 바운딩 박스 간 거리 계산
  calculateDistance(bbox1, bbox2) {
    const [x1_1, y1_1, x2_1, y2_1] = bbox1;
    const [x1_2, y1_2, x2_2, y2_2] = bbox2;

    const center1_x = (x1_1 + x2_1) / 2;
    const center1_y = (y1_1 + y2_1) / 2;
    const center2_x = (x1_2 + x2_2) / 2;
    const center2_y = (y1_2 + y2_2) / 2;

    return Math.sqrt(Math.pow(center2_x - center1_x, 2) + Math.pow(center2_y - center1_y, 2));
  }

  // 알림 생성
  async createAlerts(video, analysisResult, behaviorAnalysis, weatherAlert) {
    const alerts = [];

    // 이상 행동 알림
    if (behaviorAnalysis.hasAbnormalBehavior) {
      behaviorAnalysis.behaviors.forEach((behavior) => {
        alerts.push({
          type: "behavior",
          severity: behavior.type === "fighting" ? "high" : "medium",
          title: `Abnormal behavior detected: ${behavior.type === "lying" ? "Cattle lying down" : "Cattle fighting"}`,
          message: behavior.message,
          videoId: video._id,
          behaviorData: behavior,
        });
      });
    }

    // 날씨 알림
    if (weatherAlert) {
      weatherAlert.forEach((alert) => {
        alerts.push({
          type: "weather",
          severity: alert.severity,
          title: "Weather information",
          message: alert.message,
          weatherData: alert,
        });
      });
    }

    // 소 감지 결과 알림
    const predictions = analysisResult.predictions || [];
    const cowCount = predictions.filter((p) => p.class === "cow").length;
    const calfCount = predictions.filter((p) => p.class === "calf").length;

    if (cowCount === 0) {
      alerts.push({
        type: "detection",
        severity: "medium",
        title: "Cattle detection failed",
        message: "No cattle detected in the video. Verification required.",
        videoId: video._id,
      });
    }

    // 알림 저장
    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
      console.log(`📢 ${alerts.length} alerts created`);
    }
  }

  // 업로드된 비디오 목록 조회
  async getVideos(req, res) {
    try {
      const { page = 1, limit = parseInt(process.env.DEFAULT_PAGE_SIZE) || 10, status } = req.query;

      const query = {};
      if (status) {
        query.processingStatus = status;
      }

      const videos = await Video.find(query)
        .sort({ uploadDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select("-analysisResult -weatherAtUpload"); // 큰 데이터는 제외

      const total = await Video.countDocuments(query);

      res.json({
        videos,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      });
    } catch (error) {
      console.error("❌ Video list retrieval failed:", error);
      res.status(500).json({ error: "Error occurred while retrieving video list" });
    }
  }

  // 비디오 삭제
  async deleteVideo(req, res) {
    try {
      const { videoId } = req.params;

      const video = await Video.findById(videoId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // 파일 삭제
      if (fs.existsSync(video.filePath)) {
        fs.unlinkSync(video.filePath);
      }

      // DB에서 삭제
      await Video.findByIdAndDelete(videoId);

      // 관련 알림도 삭제
      await Alert.deleteMany({ videoId });

      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error("❌ Video deletion failed:", error);
      res.status(500).json({ error: "Error occurred during video deletion" });
    }
  }
}

module.exports = new UploadController();
