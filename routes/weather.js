const express = require("express");
const router = express.Router();
const weatherService = require("../services/weatherService");

// GET /api/weather/current - 현재 날씨 정보 조회
router.get("/current", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: "Latitude and longitude are required",
        example: "/api/weather/current?lat=37.5665&lon=126.9780",
      });
    }

    const weatherData = await weatherService.getCurrentWeather(lat, lon);
    res.json(weatherData);
  } catch (error) {
    console.error("❌ Weather data retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving weather data" });
  }
});

// GET /api/weather/alerts - 날씨 경고 정보 조회
router.get("/alerts", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: "Latitude and longitude are required",
        example: "/api/weather/alerts?lat=37.5665&lon=126.9780",
      });
    }

    const alertsData = await weatherService.getWeatherAlerts(lat, lon);
    res.json(alertsData);
  } catch (error) {
    console.error("❌ Weather alerts retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving weather alerts" });
  }
});

// GET /api/weather/cattle-health - 소 건강 날씨 조건 분석 (테스트용)
router.get("/cattle-health", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: "Latitude and longitude are required",
        example: "/api/weather/cattle-health?lat=37.5665&lon=126.9780",
      });
    }

    const weatherData = await weatherService.getCurrentWeather(lat, lon);

    // 소 건강 조건 분석
    const cattleConditions = weatherService.checkCattleWeatherConditions(weatherData);

    res.json({
      weather: weatherData,
      cattle_health_analysis: cattleConditions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Cattle health weather analysis failed:", error);
    res.status(500).json({ error: "Error occurred during cattle health weather analysis" });
  }
});

// GET /api/weather/test - 테스트용 모킹 데이터
router.get("/test", async (req, res) => {
  try {
    const mockData = weatherService.getMockWeatherData();
    res.json({
      message: "Mock weather data for testing",
      data: mockData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Weather test failed:", error);
    res.status(500).json({ error: "Error occurred during weather test" });
  }
});

// GET /api/weather/sydney-forecast - 시드니 날씨 예측
router.get("/sydney-forecast", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: "Latitude and longitude are required",
        example: "/api/weather/sydney-forecast?lat=-33.8688&lon=151.2093",
      });
    }

    const weatherData = await weatherService.getCurrentWeather(lat, lon);

    // 시드니 특화 날씨 분석
    const sydneyForecast = weatherService.analyzeSydneyWeatherForecast(weatherData);

    res.json({
      weather: weatherData,
      sydney_forecast: sydneyForecast,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Sydney forecast error:", error);
    res.status(500).json({ error: "Failed to get Sydney weather forecast" });
  }
});

module.exports = router;
