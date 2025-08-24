const jwt = require("jsonwebtoken");

// 환경 변수 설정
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const jwtSecret = process.env.JWT_SECRET || "fallback-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "24h";

// 간단한 패스워드 인증 미들웨어
const authenticatePassword = (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return res.status(401).json({ error: "Password is required" });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // 간단한 세션 토큰 생성
  const token = jwt.sign({ role: "admin", timestamp: Date.now() }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });

  req.user = { role: "admin" };
  req.token = token;
  next();
};

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Authentication token is required" });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// 관리자 권한 확인 미들웨어
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin privileges required" });
  }
  next();
};

module.exports = {
  authenticatePassword,
  authenticateToken,
  requireAdmin,
};
