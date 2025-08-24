const axios = require("axios");

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseUrl = process.env.OPENWEATHER_API_URL || "https://api.openweathermap.org/data/2.5";
    this.timeout = parseInt(process.env.WEATHER_TIMEOUT) || 10000;
  }

  // 현재 날씨 정보 가져오기
  async getCurrentWeather(lat, lon) {
    try {
      console.log("🌤️ Weather API call:", { lat, lon });

      if (!this.apiKey) {
        console.log("⚠️ No OpenWeather API key, returning mock data");
        return this.getMockWeatherData();
      }

      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: "metric", // 섭씨 온도
          lang: "en", // 영어
        },
        timeout: this.timeout,
      });

      return this.processWeatherData(response.data);
    } catch (error) {
      console.error("❌ Weather API call failed:", error.message);

      // API 호출 실패 시 모킹 데이터 반환
      console.log("🔄 Using mock data as fallback");
      return this.getMockWeatherData();
    }
  }

  // 날씨 경고 정보 가져오기
  async getWeatherAlerts(lat, lon) {
    try {
      if (!this.apiKey) {
        return { alerts: [] };
      }

      const response = await axios.get(`${this.baseUrl}/onecall`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          exclude: "current,minutely,hourly,daily",
          units: "metric",
        },
        timeout: this.timeout,
      });

      return {
        alerts: response.data.alerts || [],
      };
    } catch (error) {
      console.error("❌ Weather alerts API call failed:", error.message);
      return { alerts: [] };
    }
  }

  // 날씨 데이터 처리 및 소 건강 알림 생성
  processWeatherData(weatherData) {
    const alerts = [];

    // 소 건강에 영향을 주는 날씨 조건 분석
    const cattleHealthAlerts = this.analyzeCattleHealthConditions(weatherData);
    alerts.push(...cattleHealthAlerts);

    // 기존 날씨 알림들
    if (weatherData.rain && weatherData.rain["1h"] > 5) {
      alerts.push({
        type: "rain",
        severity: "medium",
        message: `Rainfall: ${weatherData.rain["1h"]}mm/h - Rain is falling`,
      });
    }

    // 천둥/번개 알림
    if (
      weatherData.weather.some(
        (w) =>
          w.main === "Thunderstorm" ||
          w.description.includes("thunder") ||
          w.description.includes("lightning")
      )
    ) {
      alerts.push({
        type: "thunderstorm",
        severity: "high",
        message: "Thunderstorm is occurring - Check cattle safety",
      });
    }

    return {
      current: {
        temperature: weatherData.main.temp,
        humidity: weatherData.main.humidity,
        pressure: weatherData.main.pressure,
        description: weatherData.weather[0].description,
        icon: weatherData.weather[0].icon,
        windSpeed: weatherData.wind.speed,
        rain: weatherData.rain ? weatherData.rain["1h"] : 0,
      },
      location: {
        name: weatherData.name,
        country: weatherData.sys.country,
        lat: weatherData.coord.lat,
        lon: weatherData.coord.lon,
      },
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  // 모킹 날씨 데이터 (개발용)
  getMockWeatherData() {
    const mockWeatherData = {
      main: {
        temp: 35, // 시드니 더위
        humidity: 80, // 고습도
        pressure: 1000, // 낮은 기압 (폭풍 전조)
      },
      wind: {
        speed: 18, // 강풍
      },
      rain: {
        "1h": 12, // 강우
      },
      weather: [
        {
          main: "Thunderstorm",
          description: "thunderstorm with heavy rain",
        },
      ],
    };

    const mockAlerts = this.analyzeCattleHealthConditions(mockWeatherData);

    // 시드니 특화 알림 추가
    const sydneyAlerts = this.analyzeSydneyWeatherForecast(mockWeatherData);

    mockAlerts.push({
      type: "rain",
      severity: "medium",
      message: "Rainfall: 8mm/h - Rain is falling",
    });

    // 모든 알림 합치기
    const allAlerts = [...mockAlerts, ...sydneyAlerts];

    return {
      current: {
        temperature: 22.5,
        humidity: 65,
        pressure: 1013,
        description: "Clear",
        icon: "01d",
        windSpeed: 3.2,
        rain: 0,
      },
      location: {
        name: "Sydney",
        country: "AU",
        lat: -33.8688,
        lon: 151.2093,
      },
      alerts: allAlerts,
      timestamp: new Date().toISOString(),
      is_mock: true,
    };
  }

  // 소 사육에 영향을 주는 날씨 조건 체크 (호주 기준)
  checkCattleWeatherConditions(weatherData) {
    const conditions = {
      isGoodForCattle: true,
      warnings: [],
      recommendations: [],
    };

    const temp = weatherData.current.temperature;
    const humidity = weatherData.current.humidity;
    const rain = weatherData.current.rain;

    // 온도 체크 (호주 기후 기준)
    if (temp > 30) {
      conditions.warnings.push("Heat stress risk due to high temperature");
      conditions.recommendations.push("Provide shade and sufficient water");
    }

    if (temp < 10) {
      conditions.warnings.push("Warmth needed due to low temperature");
      conditions.recommendations.push("Check heating facilities and increase feed");
    }

    // 습도 체크
    if (humidity > 85) {
      conditions.warnings.push("Increased disease risk due to high humidity");
      conditions.recommendations.push("Improve ventilation and strengthen hygiene management");
    }

    // 비 체크 (호주 강우 기준)
    if (rain > 15) {
      conditions.warnings.push("Pasture condition deterioration due to rainfall");
      conditions.recommendations.push("Consider indoor breeding and check drainage facilities");
    }

    if (conditions.warnings.length > 0) {
      conditions.isGoodForCattle = false;
    }

    return conditions;
  }

  // 소 건강에 영향을 주는 날씨 조건 상세 분석
  analyzeCattleHealthConditions(weatherData) {
    const alerts = [];
    const temp = weatherData.main.temp;
    const humidity = weatherData.main.humidity;
    const windSpeed = weatherData.wind.speed;
    const rain = weatherData.rain ? weatherData.rain["1h"] : 0;
    const pressure = weatherData.main.pressure;

    // 1. 열 스트레스 (Heat Stress) 분석 - 시드니 기준
    if (temp > 32) {
      alerts.push({
        type: "cattle_heat_stress",
        severity: "high",
        message: `High heat stress risk: ${temp}°C - Cattle may experience heat exhaustion`,
        recommendation: "Provide shade, increase water supply, and consider misting systems",
        affected_systems: ["respiratory", "digestive", "reproductive"],
        action_required: true,
      });
    } else if (temp > 28) {
      alerts.push({
        type: "cattle_heat_stress",
        severity: "medium",
        message: `Moderate heat stress risk: ${temp}°C - Monitor cattle behavior and feed intake`,
        recommendation: "Ensure adequate shade and water availability",
        affected_systems: ["respiratory", "digestive"],
        action_required: true,
      });
    }

    // 2. 저온 스트레스 (Cold Stress) 분석 - 시드니 기준
    if (temp < 8) {
      alerts.push({
        type: "cattle_cold_stress",
        severity: "medium",
        message: `Cold stress risk: ${temp}°C - Monitor energy intake and shelter`,
        recommendation: "Increase feed rations and provide wind protection",
        affected_systems: ["metabolic"],
        action_required: true,
      });
    } else if (temp < 12) {
      alerts.push({
        type: "cattle_cold_stress",
        severity: "low",
        message: `Cool conditions: ${temp}°C - Monitor cattle comfort`,
        recommendation: "Ensure adequate shelter and bedding",
        affected_systems: ["metabolic"],
        action_required: false,
      });
    }

    // 3. 습도 관련 질병 위험 - 시드니 기준
    if (humidity > 85) {
      alerts.push({
        type: "cattle_humidity_risk",
        severity: "high",
        message: `High humidity: ${humidity}% - Increased risk of respiratory and hoof diseases`,
        recommendation:
          "Improve ventilation, maintain dry bedding, and monitor for respiratory symptoms",
        affected_systems: ["respiratory", "hoof_health"],
        action_required: true,
      });
    } else if (humidity > 75) {
      alerts.push({
        type: "cattle_humidity_risk",
        severity: "medium",
        message: `Elevated humidity: ${humidity}% - Monitor for respiratory issues`,
        recommendation: "Ensure proper ventilation and maintain clean environment",
        affected_systems: ["respiratory"],
        action_required: false,
      });
    }

    // 4. 강우 및 습지 환경 - 시드니 기준
    if (rain > 15) {
      alerts.push({
        type: "cattle_rainfall_risk",
        severity: "high",
        message: `Heavy rainfall: ${rain}mm/h - Risk of hoof diseases and pasture damage`,
        recommendation:
          "Move cattle to higher ground, provide dry shelter, and monitor hoof health",
        affected_systems: ["hoof_health", "nutrition"],
        action_required: true,
      });
    } else if (rain > 5) {
      alerts.push({
        type: "cattle_rainfall_risk",
        severity: "medium",
        message: `Moderate rainfall: ${rain}mm/h - Monitor pasture conditions and drainage`,
        recommendation: "Check drainage systems and provide dry resting areas",
        affected_systems: ["hoof_health"],
        action_required: false,
      });
    }

    // 5. 강풍 스트레스 - 시드니 기준
    if (windSpeed > 20) {
      alerts.push({
        type: "cattle_wind_stress",
        severity: "high",
        message: `High wind speed: ${windSpeed} m/s - Cattle may experience wind chill and stress`,
        recommendation: "Provide windbreaks, shelter, and monitor for stress indicators",
        affected_systems: ["metabolic", "behavioral"],
        action_required: true,
      });
    } else if (windSpeed > 12) {
      alerts.push({
        type: "cattle_wind_stress",
        severity: "medium",
        message: `Moderate wind: ${windSpeed} m/s - Monitor cattle comfort and behavior`,
        recommendation: "Ensure adequate shelter and wind protection",
        affected_systems: ["behavioral"],
        action_required: false,
      });
    }

    // 6. 기압 변화 (폭풍 전후) - 시드니 기준
    if (pressure < 1005) {
      alerts.push({
        type: "cattle_pressure_change",
        severity: "medium",
        message: `Low atmospheric pressure: ${pressure} hPa - May indicate approaching storm`,
        recommendation: "Prepare for potential weather changes and secure facilities",
        affected_systems: ["behavioral"],
        action_required: false,
      });
    }

    // 7. 복합 스트레스 조건 - 시드니 기준
    if (temp > 28 && humidity > 75) {
      alerts.push({
        type: "cattle_combined_stress",
        severity: "high",
        message: `Combined heat and humidity stress - High risk of heat exhaustion`,
        recommendation: "Implement emergency cooling measures and reduce activity levels",
        affected_systems: ["respiratory", "metabolic", "reproductive"],
        action_required: true,
      });
    }

    if (temp < 10 && windSpeed > 12) {
      alerts.push({
        type: "cattle_combined_stress",
        severity: "high",
        message: `Combined cold and wind stress - High risk of hypothermia`,
        recommendation: "Provide immediate shelter and increase feed rations",
        affected_systems: ["metabolic", "immune"],
        action_required: true,
      });
    }

    return alerts;
  }

  // 시드니 날씨 예측 및 경고 시스템
  analyzeSydneyWeatherForecast(weatherData) {
    const alerts = [];
    const temp = weatherData.main.temp;
    const humidity = weatherData.main.humidity;
    const windSpeed = weatherData.wind.speed;
    const rain = weatherData.rain ? weatherData.rain["1h"] : 0;
    const pressure = weatherData.main.pressure;
    const weatherMain = weatherData.weather[0].main;
    const weatherDesc = weatherData.weather[0].description;

    // 1. 시드니 특화 날씨 조건 분석
    if (weatherMain === "Thunderstorm") {
      alerts.push({
        type: "sydney_storm_warning",
        severity: "high",
        message: "Thunderstorm detected - Secure cattle and equipment immediately",
        recommendation:
          "Move cattle to sheltered areas, secure loose equipment, monitor for lightning strikes",
        affected_systems: ["behavioral", "safety"],
        action_required: true,
        sydney_specific: true,
      });
    }

    if (weatherMain === "Rain" && rain > 10) {
      alerts.push({
        type: "sydney_heavy_rain",
        severity: "medium",
        message: `Heavy rain in Sydney: ${rain}mm/h - Monitor flood-prone areas`,
        recommendation: "Check drainage systems, move cattle from low-lying areas",
        affected_systems: ["hoof_health", "nutrition"],
        action_required: true,
        sydney_specific: true,
      });
    }

    // 2. 시드니 해안 지역 특화 조건
    if (windSpeed > 15 && weatherMain === "Rain") {
      alerts.push({
        type: "sydney_coastal_storm",
        severity: "high",
        message: "Coastal storm conditions - High winds with rain",
        recommendation: "Secure coastal facilities, monitor for storm surge, move cattle inland",
        affected_systems: ["safety", "behavioral"],
        action_required: true,
        sydney_specific: true,
      });
    }

    // 3. 시드니 더위 예측 (여름철)
    if (temp > 30 && humidity > 70) {
      alerts.push({
        type: "sydney_heat_wave",
        severity: "high",
        message: "Sydney heat wave conditions - Extreme heat and humidity",
        recommendation:
          "Implement emergency cooling, increase water supply, reduce activity during peak hours",
        affected_systems: ["respiratory", "metabolic", "reproductive"],
        action_required: true,
        sydney_specific: true,
      });
    }

    // 4. 시드니 서부 지역 산불 위험
    if (temp > 35 && humidity < 30 && windSpeed > 10) {
      alerts.push({
        type: "sydney_bushfire_risk",
        severity: "high",
        message: "High bushfire risk conditions - Hot, dry, and windy",
        recommendation: "Prepare evacuation plan, monitor fire warnings, ensure water supply",
        affected_systems: ["safety", "respiratory"],
        action_required: true,
        sydney_specific: true,
      });
    }

    return alerts;
  }
}

module.exports = new WeatherService();
