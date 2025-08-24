const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: process.env.EXPRESS_BODY_LIMIT || "100mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.EXPRESS_BODY_LIMIT || "100mb" }));

// 요청 제한 설정
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 각 IP당 100개 요청으로 제한
});
app.use(limiter);

// MongoDB 연결
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Atlas connection successful"))
  .catch((err) => console.error("❌ MongoDB Atlas connection failed:", err));

// 라우터 설정 (인증 제거, 간소화)
app.use("/api/upload", require("./routes/upload"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/weather", require("./routes/weather"));
app.use("/api/analysis", require("./routes/analysis"));

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

// 404 핸들러
app.use("*", (req, res) => {
  res.status(404).json({ error: "Requested endpoint not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
});
