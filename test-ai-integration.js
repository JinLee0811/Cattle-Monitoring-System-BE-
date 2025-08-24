const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

class AIIntegrationTest {
  constructor() {
    this.backendUrl = "http://localhost:5001";
    this.aiUrl = `http://localhost:${process.env.AI_SERVICE_PORT || 5002}`;
  }

  async testAIServiceHealth() {
    console.log("🔍 AI 서비스 상태 확인...");
    try {
      const response = await axios.get(`${this.aiUrl}/health`);
      console.log("✅ AI 서비스 정상:", response.data);
      return true;
    } catch (error) {
      console.log("❌ AI 서비스 연결 실패:", error.message);
      return false;
    }
  }

  async testBackendAIServiceStatus() {
    console.log("🔍 Backend AI 서비스 상태 확인...");
    try {
      const response = await axios.get(`${this.backendUrl}/api/analysis/ai-status`);
      console.log("✅ Backend AI 서비스 상태:", response.data);
      return true;
    } catch (error) {
      console.log("❌ Backend AI 서비스 상태 확인 실패:", error.message);
      return false;
    }
  }

  async testImageAnalysis() {
    console.log("🔍 이미지 분석 테스트...");

    // 테스트용 이미지가 있는지 확인
    const testImagePath = "./test-image.jpg";
    if (!fs.existsSync(testImagePath)) {
      console.log("⚠️ 테스트 이미지가 없습니다. 샘플 이미지를 생성합니다...");
      // 간단한 테스트 이미지 생성 (실제로는 샘플 이미지 필요)
      console.log("📝 실제 테스트를 위해서는 test-image.jpg 파일을 준비해주세요.");
      return false;
    }

    try {
      const formData = new FormData();
      formData.append("file", fs.createReadStream(testImagePath));

      const response = await axios.post(`${this.aiUrl}/analyze/file`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      console.log("✅ 이미지 분석 성공:");
      console.log(`  - 감지된 소: ${response.data.cattle_count}마리`);
      console.log(`  - 처리 시간: ${response.data.performance?.total_processing_time}초`);
      console.log(`  - 알람 수: ${response.data.alerts?.length || 0}개`);

      return true;
    } catch (error) {
      console.log("❌ 이미지 분석 실패:", error.message);
      return false;
    }
  }

  async testBackendHealth() {
    console.log("🔍 Backend 서비스 상태 확인...");
    try {
      const response = await axios.get(`${this.backendUrl}/api/health`);
      console.log("✅ Backend 서비스 정상:", response.data);
      return true;
    } catch (error) {
      console.log("❌ Backend 서비스 연결 실패:", error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log("🚀 AI 서비스 통합 테스트 시작");
    console.log("=" * 50);

    const results = {
      aiServiceHealth: await this.testAIServiceHealth(),
      backendHealth: await this.testBackendHealth(),
      backendAIServiceStatus: await this.testBackendAIServiceStatus(),
      imageAnalysis: await this.testImageAnalysis(),
    };

    console.log("\n📊 테스트 결과 요약:");
    console.log("=" * 50);
    console.log(`AI 서비스 상태: ${results.aiServiceHealth ? "✅ 정상" : "❌ 실패"}`);
    console.log(`Backend 서비스 상태: ${results.backendHealth ? "✅ 정상" : "❌ 실패"}`);
    console.log(
      `Backend AI 서비스 연동: ${results.backendAIServiceStatus ? "✅ 정상" : "❌ 실패"}`
    );
    console.log(`이미지 분석 테스트: ${results.imageAnalysis ? "✅ 정상" : "❌ 실패"}`);

    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    console.log(
      `\n🎯 전체 성공률: ${successCount}/${totalCount} (${Math.round((successCount / totalCount) * 100)}%)`
    );

    if (successCount === totalCount) {
      console.log("🎉 모든 테스트 통과! AI 서비스 통합이 완료되었습니다.");
    } else {
      console.log("⚠️ 일부 테스트 실패. 문제를 해결한 후 다시 시도해주세요.");
    }

    return results;
  }
}

// 테스트 실행
if (require.main === module) {
  const test = new AIIntegrationTest();
  test.runAllTests().catch(console.error);
}

module.exports = AIIntegrationTest;
