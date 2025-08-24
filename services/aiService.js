const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

class AIService {
  constructor() {
    const aiPort = process.env.AI_SERVICE_PORT || 5002;
    this.aiApiUrl = process.env.AI_API_URL || `http://localhost:${aiPort}`;
    this.timeout = parseInt(process.env.AI_API_TIMEOUT) || 60000; // 60초
    this.maxRetries = parseInt(process.env.AI_API_MAX_RETRIES) || 3;
  }

  // AI API 상태 확인
  async checkAIHealth() {
    try {
      const response = await axios.get(`${this.aiApiUrl}/health`, {
        timeout: 5000,
      });
      return {
        status: "healthy",
        service: response.data.service,
        version: response.data.version,
        features: response.data.features,
      };
    } catch (error) {
      console.error("❌ AI API health check failed:", error.message);
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  // 이미지 분석 (Base64)
  async analyzeImageBase64(imageBase64, analysisId = null) {
    try {
      console.log("🤖 AI API 이미지 분석 시작 (Base64)");

      const payload = {
        image: imageBase64,
      };

      if (analysisId) {
        payload.analysis_id = analysisId;
      }

      const response = await axios.post(`${this.aiApiUrl}/analyze/image`, payload, {
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("✅ AI API 이미지 분석 완료");
      return this.transformAIResponse(response.data);
    } catch (error) {
      console.error("❌ AI API 이미지 분석 실패:", error.message);
      throw new Error(`AI 분석 실패: ${error.message}`);
    }
  }

  // 파일 업로드 분석
  async analyzeImageFile(filePath, analysisId = null) {
    try {
      console.log("🤖 AI API 이미지 분석 시작 (파일)");

      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath));

      if (analysisId) {
        formData.append("analysis_id", analysisId);
      }

      const response = await axios.post(`${this.aiApiUrl}/analyze/file`, formData, {
        timeout: this.timeout,
        headers: {
          ...formData.getHeaders(),
        },
      });

      console.log("✅ AI API 이미지 분석 완료");
      return this.transformAIResponse(response.data);
    } catch (error) {
      console.error("❌ AI API 이미지 분석 실패:", error.message);
      throw new Error(`AI 분석 실패: ${error.message}`);
    }
  }

  // AI API 응답을 Backend 형식으로 변환
  transformAIResponse(aiResponse) {
    if (aiResponse.status === "error") {
      throw new Error(aiResponse.error || "AI 분석 중 오류 발생");
    }

    // AI API의 cattle 데이터를 Backend 형식으로 변환
    const predictions = aiResponse.cattle.map((cow, index) => ({
      confidence: cow.confidence,
      class: "cow", // AI API는 소만 감지
      bbox: {
        x: cow.position.center_x,
        y: cow.position.center_y,
        width: cow.position.width,
        height: cow.position.height,
      },
      bounding_box: cow.bounding_box,
      behavior: cow.behavior,
      health_indicators: cow.health_indicators,
      detection_info: cow.detection_info,
      timestamp: cow.timestamp,
    }));

    return {
      predictions: predictions,
      model: "enhanced-cattle-analysis",
      confidence: aiResponse.behavior_summary?.average_confidence || 0,
      processing_time: aiResponse.performance?.total_processing_time || 0,
      timestamp: aiResponse.timestamp,

      // 새로운 고급 기능들
      behavior_analysis: {
        hasAbnormalBehavior: aiResponse.alerts && aiResponse.alerts.length > 0,
        behaviors: aiResponse.cattle.map((cow) => ({
          type: cow.behavior.primary,
          confidence: cow.behavior.confidence,
          message: `${cow.behavior.primary} 상태 - ${cow.behavior.activity_level} 활동성`,
          details: cow.behavior.details,
        })),
        summary: aiResponse.behavior_summary,
      },

      health_analysis: {
        total_cattle: aiResponse.cattle_count,
        healthy_count: aiResponse.behavior_summary?.health_distribution?.healthy || 0,
        concern_count: aiResponse.behavior_summary?.concern_count || 0,
        average_health_score: aiResponse.behavior_summary?.average_health_score || 0,
      },

      alerts: aiResponse.alerts || [],
      environment: aiResponse.environment || {},
      performance: aiResponse.performance || {},

      // 메타데이터
      analysis_id: aiResponse.analysis_id,
      image_info: aiResponse.image_info,
    };
  }

  // 재시도 로직이 포함된 분석
  async analyzeWithRetry(analyzeFunction, ...args) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 AI 분석 시도 ${attempt}/${this.maxRetries}`);
        return await analyzeFunction.apply(this, args);
      } catch (error) {
        lastError = error;
        console.error(`❌ AI 분석 시도 ${attempt} 실패:`, error.message);

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 지수 백오프
          console.log(`⏳ ${delay}ms 후 재시도...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // 비디오 프레임 분석 (여러 프레임)
  async analyzeVideoFrames(framePaths, analysisId = null) {
    try {
      console.log(`🤖 AI API 비디오 프레임 분석 시작 (${framePaths.length}개 프레임)`);

      const frameResults = [];
      const batchSize = 3; // 동시 처리할 프레임 수

      for (let i = 0; i < framePaths.length; i += batchSize) {
        const batch = framePaths.slice(i, i + batchSize);
        const batchPromises = batch.map((framePath, batchIndex) =>
          this.analyzeWithRetry(
            this.analyzeImageFile,
            framePath,
            `${analysisId}_frame_${i + batchIndex}`
          )
        );

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, batchIndex) => {
          if (result.status === "fulfilled") {
            frameResults.push({
              frameIndex: i + batchIndex,
              result: result.value,
            });
          } else {
            console.error(`❌ 프레임 ${i + batchIndex} 분석 실패:`, result.reason);
          }
        });

        // 배치 간 간격
        if (i + batchSize < framePaths.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(
        `✅ AI API 비디오 프레임 분석 완료 (${frameResults.length}/${framePaths.length} 성공)`
      );
      return this.aggregateVideoResults(frameResults);
    } catch (error) {
      console.error("❌ AI API 비디오 프레임 분석 실패:", error.message);
      throw new Error(`비디오 분석 실패: ${error.message}`);
    }
  }

  // 비디오 결과 집계
  aggregateVideoResults(frameResults) {
    if (frameResults.length === 0) {
      throw new Error("분석된 프레임이 없습니다");
    }

    // 모든 프레임의 예측을 집계
    const allPredictions = [];
    const behaviorSummary = {
      total_frames: frameResults.length,
      total_detections: 0,
      behavior_distribution: {},
      health_distribution: {},
      alerts: [],
    };

    frameResults.forEach((frameResult, frameIndex) => {
      const predictions = frameResult.result.predictions || [];
      behaviorSummary.total_detections += predictions.length;

      predictions.forEach((pred) => {
        pred.frame_index = frameIndex;
        allPredictions.push(pred);
      });

      // 행동 분포 집계
      const behaviors = frameResult.result.behavior_analysis?.behaviors || [];
      behaviors.forEach((behavior) => {
        const type = behavior.type;
        behaviorSummary.behavior_distribution[type] =
          (behaviorSummary.behavior_distribution[type] || 0) + 1;
      });

      // 알림 집계
      const alerts = frameResult.result.alerts || [];
      behaviorSummary.alerts.push(
        ...alerts.map((alert) => ({
          ...alert,
          frame_index: frameIndex,
        }))
      );
    });

    // 평균 신뢰도 계산
    const avgConfidence =
      allPredictions.length > 0
        ? allPredictions.reduce((sum, pred) => sum + pred.confidence, 0) / allPredictions.length
        : 0;

    return {
      predictions: allPredictions,
      model: "enhanced-cattle-analysis-video",
      confidence: avgConfidence,
      processing_time: frameResults.reduce(
        (sum, frame) => sum + (frame.result.processing_time || 0),
        0
      ),
      timestamp: new Date().toISOString(),

      behavior_analysis: {
        hasAbnormalBehavior: behaviorSummary.alerts.length > 0,
        behaviors: allPredictions.map((pred) => ({
          type: pred.behavior?.primary || "unknown",
          confidence: pred.behavior?.confidence || 0,
          message: `${pred.behavior?.primary || "unknown"} 상태`,
          frame_index: pred.frame_index,
        })),
        summary: behaviorSummary,
      },

      video_analysis: {
        total_frames: frameResults.length,
        analyzed_frames: frameResults.length,
        average_cattle_per_frame: behaviorSummary.total_detections / frameResults.length,
        frame_results: frameResults.map((frame) => ({
          frame_index: frame.frameIndex,
          cattle_count: frame.result.predictions?.length || 0,
          processing_time: frame.result.processing_time || 0,
        })),
      },
    };
  }
}

module.exports = new AIService();
