const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["video", "image"],
      default: "video",
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    analysisResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    weatherAtUpload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    audioAlert: {
      type: Boolean,
      default: false,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// 인덱스 추가
videoSchema.index({ uploadDate: -1 });
videoSchema.index({ processingStatus: 1 });
videoSchema.index({ audioAlert: 1 });

module.exports = mongoose.model("Video", videoSchema);
