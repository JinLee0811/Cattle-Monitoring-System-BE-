const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysisController");

// AI 서비스 상태 확인
router.get("/ai-status", analysisController.getAIServiceStatus);

// GET /api/analysis/:videoId - 특정 비디오 분석 결과 조회
router.get("/:videoId", analysisController.getAnalysisResult);

// GET /api/analysis/summary - 분석 결과 요약 조회
router.get("/summary", analysisController.getAnalysisSummary);

// GET /api/analysis/patterns - 이상 행동 패턴 분석
router.get("/patterns", analysisController.getAbnormalBehaviorPatterns);

// GET /api/analysis/tracking - 소 개체 수 추적
router.get("/tracking", analysisController.getCattleTracking);

// GET /api/analysis/ai-status - AI 서비스 상태 확인
router.get("/ai-status", analysisController.getAIServiceStatus);

module.exports = router;
