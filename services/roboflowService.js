const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const AIService = require("./aiService");

class RoboflowService {
  constructor() {
    this.apiKey = process.env.ROBOFLOW_API_KEY;
    this.apiUrl = process.env.ROBOFLOW_API_URL || "https://api.roboflow.com/detect";
    this.modelName = process.env.ROBOFLOW_MODEL_NAME || "cattle-detection";
    this.version = process.env.ROBOFLOW_MODEL_VERSION || "1";
    this.timeout = parseInt(process.env.ROBOFLOW_TIMEOUT) || 30000;

    // AI 서비스 사용 여부 결정
    this.useAIService = process.env.USE_AI_SERVICE === "true";
    this.aiService = AIService; // 이미 인스턴스화된 객체를 사용
  }

  // 실제 Roboflow API 호출 (AI 서비스 우선 사용)
  async analyzeVideo(videoPath) {
    try {
      console.log("🤖 분석 시작:", videoPath);

      // AI 서비스 사용 설정이 되어 있으면 AI 서비스 사용
      if (this.useAIService) {
        console.log("🚀 AI 서비스 사용");
        try {
          // AI 서비스 상태 확인
          const aiHealth = await this.aiService.checkAIHealth();
          if (aiHealth.status === "healthy") {
            console.log("✅ AI 서비스 정상 작동 중");
            return await this.aiService.analyzeImageFile(videoPath);
          } else {
            console.log("⚠️ AI 서비스 비정상, Roboflow API 사용");
          }
        } catch (aiError) {
          console.log("⚠️ AI 서비스 연결 실패, Roboflow API 사용:", aiError.message);
        }
      }

      // AI 서비스가 없거나 실패한 경우 기존 Roboflow API 사용
      console.log("🔄 Roboflow API 사용");

      if (!this.apiKey) {
        console.log("⚠️ No Roboflow API key, returning mock data");
        return this.getMockAnalysisResult();
      }

      // 실제 API 호출 로직
      const formData = new FormData();
      formData.append("file", fs.createReadStream(videoPath));

      const response = await axios.post(
        `${this.apiUrl}/${this.modelName}/${this.version}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      console.error("❌ Roboflow API call failed:", error.message);

      // API 호출 실패 시 모킹 데이터 반환
      console.log("🔄 Using mock data as fallback");
      return this.getMockAnalysisResult();
    }
  }

  // 모킹 분석 결과 (개발용)
  getMockAnalysisResult() {
    const mockResults = [
      {
        confidence: 0.95,
        class: "cow",
        bbox: { x: 100, y: 150, width: 200, height: 300 },
        timestamp: Date.now(),
      },
      {
        confidence: 0.87,
        class: "calf",
        bbox: { x: 350, y: 200, width: 150, height: 200 },
        timestamp: Date.now(),
      },
    ];

    return {
      predictions: mockResults,
      model: "cattle-detection-v1",
      confidence: 0.91,
      processing_time: Math.random() * 2 + 1, // 1-3초
      timestamp: new Date().toISOString(),
      is_mock: true,
    };
  }

  // 소 이상 행동 감지 (AI 서비스 우선 사용)
  async detectAbnormalBehavior(analysisResult) {
    // AI 서비스에서 이미 행동 분석을 제공한 경우 그대로 사용
    if (analysisResult.behavior_analysis) {
      return analysisResult.behavior_analysis;
    }

    // 기존 로직 (AI 서비스가 없는 경우)
    const predictions = analysisResult.predictions || [];

    // 이상 행동 감지 로직
    const abnormalBehaviors = [];

    predictions.forEach((prediction) => {
      // 소가 너무 오랫동안 같은 위치에 있는 경우
      if (prediction.confidence > 0.9 && prediction.class === "cow") {
        abnormalBehaviors.push({
          type: "stationary_cow",
          confidence: prediction.confidence,
          message: "Cow has been stationary for too long",
        });
      }

      // 새끼소가 어미와 떨어져 있는 경우
      if (prediction.class === "calf") {
        const hasNearbyCow = predictions.some(
          (p) =>
            p.class === "cow" &&
            Math.abs(p.bbox.x - prediction.bbox.x) < 100 &&
            Math.abs(p.bbox.y - prediction.bbox.y) < 100
        );

        if (!hasNearbyCow) {
          abnormalBehaviors.push({
            type: "separated_calf",
            confidence: prediction.confidence,
            message: "Calf is separated from mother",
          });
        }
      }
    });

    return {
      hasAbnormalBehavior: abnormalBehaviors.length > 0,
      behaviors: abnormalBehaviors,
      totalDetections: predictions.length,
    };
  }

  // AI 서비스 상태 확인
  async checkAIServiceStatus() {
    if (!this.useAIService) {
      return { status: "disabled", message: "AI 서비스가 비활성화되어 있습니다" };
    }

    try {
      return await this.aiService.checkAIHealth();
    } catch (error) {
      return { status: "error", message: error.message };
    }
  }
}

module.exports = new RoboflowService();
