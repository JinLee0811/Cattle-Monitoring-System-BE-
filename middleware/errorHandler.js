// 에러 핸들링 미들웨어
const errorHandler = (err, req, res, next) => {
  console.error("❌ Error occurred:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // MongoDB 에러 처리
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Data validation failed",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid data format",
      message: "Requested ID is not valid",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: "Duplicate data",
      message: "Data already exists",
    });
  }

  // 파일 업로드 에러 처리
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File size exceeded",
      message: "Uploaded file is too large",
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      error: "Invalid file",
      message: "Unexpected file was uploaded",
    });
  }

  // 기본 에러 응답
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error occurred";

  res.status(statusCode).json({
    error: "Server error",
    message: process.env.NODE_ENV === "development" ? message : "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// 404 에러 핸들러
const notFound = (req, res, next) => {
  const error = new Error(`Requested path not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound,
};
