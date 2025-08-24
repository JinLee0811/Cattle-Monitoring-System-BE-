const fs = require("fs");
const path = require("path");

class Logger {
  constructor() {
    this.logDir = process.env.LOG_DIR || "./logs";
    this.logLevel = process.env.LOG_LEVEL || "info";
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      logMessage += ` | Data: ${JSON.stringify(data)}`;
    }

    return logMessage;
  }

  writeToFile(level, message, data = null) {
    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(this.logDir, `${date}.log`);
    const logMessage = this.formatMessage(level, message, data) + "\n";

    fs.appendFileSync(logFile, logMessage);
  }

  info(message, data = null) {
    const logMessage = this.formatMessage("info", message, data);
    console.log(`ℹ️  ${logMessage}`);
    this.writeToFile("info", message, data);
  }

  warn(message, data = null) {
    const logMessage = this.formatMessage("warn", message, data);
    console.warn(`⚠️  ${logMessage}`);
    this.writeToFile("warn", message, data);
  }

  error(message, data = null) {
    const logMessage = this.formatMessage("error", message, data);
    console.error(`❌ ${logMessage}`);
    this.writeToFile("error", message, data);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === "development" || this.logLevel === "debug") {
      const logMessage = this.formatMessage("debug", message, data);
      console.debug(`🐛 ${logMessage}`);
      this.writeToFile("debug", message, data);
    }
  }

  // API 요청 로깅
  logRequest(req, res, next) {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
      };

      if (res.statusCode >= 400) {
        this.warn("API Request", logData);
      } else {
        this.info("API Request", logData);
      }
    });

    next();
  }

  // 파일 업로드 로깅
  logFileUpload(file, userId = null) {
    this.info("File Upload", {
      filename: file.originalname,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      mimetype: file.mimetype,
      userId,
    });
  }

  // 분석 결과 로깅
  logAnalysisResult(videoId, result, duration) {
    this.info("Analysis Complete", {
      videoId,
      duration: `${duration}ms`,
      predictions: result.predictions?.length || 0,
      confidence: result.confidence,
      isMock: result.is_mock || false,
    });
  }
}

module.exports = new Logger();
