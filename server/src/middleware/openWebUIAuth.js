/**
 * JWT → Open WebUI 认证桥接中间件
 *
 * 流程：
 * 1. 从请求中提取 blog 的 JWT token
 * 2. 验证 token 有效性
 * 3. 调用 Open WebUI API 获取/创建对应用户并获取其 token
 * 4. 将 Open WebUI token 注入请求，供后续代理使用
 */
const jwt = require("jsonwebtoken");
const http = require("http");

const OPEN_WEBUI_PORT = parseInt(process.env.OPEN_WEBUI_PORT, 10) || 8080;
const OPEN_WEBUI_HOST = process.env.OPEN_WEBUI_HOST || "127.0.0.1";
const JWT_SECRET = process.env.JWT_SECRET;

// 内存缓存：blog_user_id -> { openWebUIToken, expiresAt }
const tokenCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

function getBlogToken(req) {
  // 优先从 Authorization header 提取
  const header = req.headers["authorization"] || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];

  // 其次从 cookie 提取（适配 iframe 场景）
  const cookie = req.headers["cookie"] || "";
  const cm = cookie.match(/accessToken=([^;]+)/);
  if (cm) return decodeURIComponent(cm[1]);

  return null;
}

function verifyBlogToken(token) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "admin") return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function makeOpenWebUIRequest(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: OPEN_WEBUI_HOST,
      port: OPEN_WEBUI_PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        ...headers,
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Open WebUI request timeout"));
    });

    if (data) req.write(data);
    req.end();
  });
}

async function getOrCreateOpenWebUIUser(blogUser) {
  const cacheKey = String(blogUser.userId);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.openWebUIToken;
  }

  // Open WebUI 关闭自带认证时，使用其内部 API 创建/获取用户
  // 实际实现可能需要根据 Open WebUI 的 API 调整
  try {
    // 尝试登录（如果用户已存在）
    const loginRes = await makeOpenWebUIRequest("/api/v1/auths/signin", "POST", {
      email: blogUser.email || `${blogUser.username}@blog.local`,
      password: blogUser.userId, // 使用 userId 作为密码（内部使用，不对外暴露）
    });

    if (loginRes.status === 200 && loginRes.data?.token) {
      tokenCache.set(cacheKey, {
        openWebUIToken: loginRes.data.token,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return loginRes.data.token;
    }

    // 用户不存在，创建新用户
    const signupRes = await makeOpenWebUIRequest("/api/v1/auths/signup", "POST", {
      name: blogUser.username,
      email: blogUser.email || `${blogUser.username}@blog.local`,
      password: blogUser.userId,
      password_confirm: blogUser.userId,
    });

    if (signupRes.status === 200 && signupRes.data?.token) {
      tokenCache.set(cacheKey, {
        openWebUIToken: signupRes.data.token,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return signupRes.data.token;
    }

    console.error("[OpenWebUIAuth] Failed to get/create user:", signupRes.data);
    return null;
  } catch (err) {
    console.error("[OpenWebUIAuth] Open WebUI API error:", err.message);
    return null;
  }
}

async function openWebUIAuth(req, res, next) {
  const blogToken = getBlogToken(req);
  if (!blogToken) {
    return res.status(401).json({ code: 401, message: "Authentication required" });
  }

  const blogUser = verifyBlogToken(blogToken);
  if (!blogUser) {
    return res.status(401).json({ code: 401, message: "Invalid or expired token" });
  }

  // 获取 Open WebUI token
  const openWebUIToken = await getOrCreateOpenWebUIUser(blogUser);
  if (!openWebUIToken) {
    // Open WebUI 未就绪，返回维护页面或 503
    return res.status(503).json({
      code: 503,
      message: "Workbench service unavailable. Please try again later.",
    });
  }

  // 将 Open WebUI token 附加到请求，供代理中间件使用
  req.openWebUIAuth = {
    token: openWebUIToken,
    blogUser,
  };

  next();
}

module.exports = openWebUIAuth;
