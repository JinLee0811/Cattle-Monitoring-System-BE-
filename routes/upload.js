const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const uploadController = require("../controllers/uploadController");

// 환경 변수 설정
const uploadDir = process.env.UPLOAD_PATH || "./uploads";
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024;

// 업로드 디렉토리 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 파일명 중복 방지
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// 파일 필터링
const fileFilter = (req, file, cb) => {
  // 비디오 및 이미지 파일 형식 허용
  const allowedMimes = [
    // 비디오 파일
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    // 이미지 파일
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format. Only video and image files are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 1, // 한 번에 하나의 파일만
  },
});

// POST /api/upload - 비디오/이미지 업로드
router.post("/", upload.single("file"), uploadController.uploadFile);

// POST /api/upload/video - 비디오 업로드 별칭 (하위 호환)
router.post("/video", upload.single("file"), uploadController.uploadFile);

// GET /api/upload - 업로드된 비디오 목록 조회
router.get("/", uploadController.getVideos);

// DELETE /api/upload/:videoId - 비디오 삭제
router.delete("/:videoId", uploadController.deleteVideo);

// 에러 핸들링 미들웨어
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File size exceeded",
        message: "Uploaded file is too large",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Invalid file",
        message: "Unexpected file was uploaded",
      });
    }
  }

  if (error.message.includes("Unsupported file format")) {
    return res.status(400).json({
      error: "Unsupported file format",
      message: error.message,
    });
  }

  next(error);
});

module.exports = router;
