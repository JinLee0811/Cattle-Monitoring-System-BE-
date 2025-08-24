# 🐄 Cattle Monitoring System - Frontend API Guide

## Overview

This guide provides essential API endpoints for frontend developers to integrate with the Cattle Monitoring System backend.

**Base URL**: `http://localhost:5000/api`

---

## 📹 Video Management

### Upload CCTV Video

**POST** `/api/upload`

```javascript
const formData = new FormData();
formData.append("file", videoFile);
formData.append("lat", "37.5665"); // optional
formData.append("lon", "126.9780"); // optional

const response = await fetch("/api/upload", {
  method: "POST",
  body: formData,
});
```

### Get Video List

**GET** `/api/videos`

```javascript
// All videos
const response = await fetch('/api/videos');

// Videos with abnormal behavior only
const abnormalResponse = await fetch('/api/videos?hasAbnormal=true');

// Response:
{
  "videos": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "filename": "cctv_cattle_001.mp4",
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "processingStatus": "completed",
      "analysisResult": {
        "behaviorAnalysis": {
          "hasAbnormalBehavior": true,
          "behaviors": [
            {
              "type": "lying",
              "message": "1 cattle detected lying down",
              "count": 1,
              "confidence": 0.85
            }
          ]
        }
      }
    }
  ]
}
```

### Get Video Details

**GET** `/api/videos/:id`

```javascript
const response = await fetch(`/api/videos/${videoId}`);
// Returns video details with detection results and bounding boxes
```

### Stream Video

**GET** `/api/videos/:id/stream`

```html
<video controls>
  <source src="/api/videos/507f1f77bcf86cd799439011/stream" type="video/mp4" />
</video>
```

---

## 🚨 Alerts & Logs

### Get Recent Alerts

**GET** `/api/alerts/recent`

```javascript
const response = await fetch("/api/alerts/recent?limit=10");
// Returns recent alerts for dashboard
```

### Get Video Logs

**GET** `/api/logs/video/:videoId`

```javascript
const response = await fetch(`/api/logs/video/${videoId}`);
// Returns all logs for specific video
```

### Get Timeline Logs

**GET** `/api/logs/timeline`

```javascript
const response = await fetch("/api/logs/timeline?days=7");
// Returns logs grouped by date
```

---

## 🌤️ Weather

### Get Current Weather

**GET** `/api/weather/current`

```javascript
const response = await fetch("/api/weather/current?lat=37.5665&lon=126.9780");
```

---

## 📊 Data Structures

### Video Analysis Result

```javascript
{
  "predictions": [
    {
      "class": "cow|calf",
      "confidence": 0.95,
      "bbox": [x1, y1, x2, y2]  // Bounding box coordinates
    }
  ],
  "behaviorAnalysis": {
    "hasAbnormalBehavior": true,
    "behaviors": [
      {
        "type": "lying|fighting",
        "message": "1 cattle detected lying down",
        "count": 1,
        "confidence": 0.85
      }
    ]
  }
}
```

### Alert Structure

```javascript
{
  "_id": "507f1f77bcf86cd799439012",
  "type": "behavior|weather|detection",
  "severity": "low|medium|high|critical",
  "title": "Abnormal behavior detected: Cattle lying down",
  "message": "1 cattle detected lying down",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 🎯 Frontend Implementation Guide

### 1. Video Player with Bounding Boxes

```javascript
// Get video details for bounding boxes
const videoDetails = await fetch(`/api/videos/${videoId}`).then((r) => r.json());

// Draw bounding boxes on canvas overlay
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

videoDetails.analysisResult.predictions.forEach((prediction) => {
  const [x1, y1, x2, y2] = prediction.bbox;
  ctx.strokeStyle = prediction.class === "cow" ? "red" : "blue";
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
});
```

### 2. Time-based Log Display

```javascript
// Get video logs
const videoLogs = await fetch(`/api/logs/video/${videoId}`).then((r) => r.json());

// Create timeline mapping (frontend implementation)
const logTimeline = {
  "00:05": "3 cattle detected",
  "00:12": "1 cattle lying down detected",
  "00:18": "Abnormal behavior alert",
};

// Display logs based on video time
video.addEventListener("timeupdate", () => {
  const currentTime = formatTime(video.currentTime);
  const currentLog = logTimeline[currentTime];
  if (currentLog) {
    displayLog(currentLog);
  }
});
```

### 3. Real-time Alert Display

```javascript
// Get recent alerts
const alerts = await fetch("/api/alerts/recent").then((r) => r.json());

// Display alerts in real-time
alerts.alerts.forEach((alert) => {
  if (!alert.isRead) {
    showNotification(alert.title, alert.message, alert.severity);
  }
});
```

---

## 🔧 Key Features

- **Video Streaming**: HTTP Range requests supported
- **Bounding Box Data**: Available in video details
- **Time-based Logs**: Frontend maps logs to video timeline
- **Real-time Alerts**: Recent alerts for dashboard
- **Weather Integration**: Current weather data
- **Abnormal Behavior Detection**: Lying down and fighting detection

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- Bounding boxes are in [x1, y1, x2, y2] format
- Video processing status: `pending`, `processing`, `completed`, `failed`
- Alert severity: `low`, `medium`, `high`, `critical`
