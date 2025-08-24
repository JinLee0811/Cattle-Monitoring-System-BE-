const express = require("express");
const router = express.Router();
const Video = require("../models/Video");
const path = require("path");
const fs = require("fs");

// GET /api/videos - 비디오 목록 조회
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, hasAbnormal } = req.query;

    const query = {};
    if (status) {
      query.processingStatus = status;
    }

    // 이상 행동이 있는 비디오만 필터링
    if (hasAbnormal === "true") {
      query["analysisResult.behaviorAnalysis.hasAbnormalBehavior"] = true;
    } else if (hasAbnormal === "false") {
      query["analysisResult.behaviorAnalysis.hasAbnormalBehavior"] = false;
    }

    const videos = await Video.find(query)
      .sort({ uploadDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select(
        "filename originalName uploadDate processingStatus analysisResult.behaviorAnalysis analysisResult.weatherAlert"
      );

    const total = await Video.countDocuments(query);

    res.json({
      videos,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("❌ Video list retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving video list" });
  }
});

// GET /api/videos/:id - 특정 비디오 상세 정보
router.get("/:id", async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({
      video,
      analysisStatus: video.processingStatus,
      hasAbnormalBehavior: video.analysisResult?.behaviorAnalysis?.hasAbnormalBehavior || false,
      abnormalBehaviors: video.analysisResult?.behaviorAnalysis?.behaviors || [],
      weatherAlert: video.analysisResult?.weatherAlert || null,
    });
  } catch (error) {
    console.error("❌ Video detail retrieval failed:", error);
    res.status(500).json({ error: "Error occurred while retrieving video details" });
  }
});

// GET /api/videos/:id/stream - 비디오 스트리밍
router.get("/:id/stream", async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (!fs.existsSync(video.filePath)) {
      return res.status(404).json({ error: "Video file not found" });
    }

    const stat = fs.statSync(video.filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(video.filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": video.mimeType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": video.mimeType,
      };
      res.writeHead(200, head);
      fs.createReadStream(video.filePath).pipe(res);
    }
  } catch (error) {
    console.error("❌ Video streaming failed:", error);
    res.status(500).json({ error: "Error occurred during video streaming" });
  }
});

// DELETE /api/videos/:id - 비디오 삭제
router.delete("/:id", async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // 파일 삭제
    if (fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    // DB에서 삭제
    await Video.findByIdAndDelete(req.params.id);

    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("❌ Video deletion failed:", error);
    res.status(500).json({ error: "Error occurred during video deletion" });
  }
});

module.exports = router;
