/**
 * Open WebUI 启动器
 * 支持两种模式：
 * 1. 内嵌模式：启动本地 Python 进程（开发环境）
 * 2. 外部模式：连接到独立容器（Docker 生产环境）
 */
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const OPEN_WEBUI_PORT = parseInt(process.env.OPEN_WEBUI_PORT, 10) || 8080;
const OPEN_WEBUI_HOST = process.env.OPEN_WEBUI_HOST || "127.0.0.1";
const OPEN_WEBUI_URL = process.env.OPEN_WEBUI_URL || `http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}`;
const OPEN_WEBUI_DIR = path.join(__dirname, "..", "..", "open-webui");
const BACKEND_DIR = path.join(OPEN_WEBUI_DIR, "backend");

let childProcess = null;
let isReady = false;
let useExternal = false;

function getOpenWebUIEnv() {
  const dataDir = path.join(BACKEND_DIR, "data");
  return {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(OPEN_WEBUI_PORT),
    HOST: OPEN_WEBUI_HOST,
    // 禁用 Open WebUI 的默认认证，由 blog JWT 桥接接管
    WEBUI_AUTH: "false",
    // 使用与 blog 相同的 JWT secret，便于 token 互认
    JWT_SECRET: process.env.JWT_SECRET || "",
    // 向量库配置
    VECTOR_DB: process.env.VECTOR_DB || "chroma",
    CHROMA_DATA_PATH: path.join(dataDir, "vector_db"),
    // 禁用遥测
    SCARF_NO_ANALYTICS: "true",
    DO_NOT_TRACK: "true",
    ANONYMIZED_TELEMETRY: "false",
  };
}

function checkHealth(retries = 60, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryConnect = () => {
      attempts++;
      const req = http.get(
        `http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}/health`,
        (res) => {
          if (res.statusCode === 200) {
            isReady = true;
            resolve(true);
          } else if (attempts < retries) {
            setTimeout(tryConnect, interval);
          } else {
            reject(new Error(`Health check failed after ${retries} attempts`));
          }
        }
      );
      req.on("error", () => {
        if (attempts < retries) {
          setTimeout(tryConnect, interval);
        } else {
          reject(new Error(`Health check failed after ${retries} attempts`));
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < retries) {
          setTimeout(tryConnect, interval);
        } else {
          reject(new Error(`Health check timeout after ${retries} attempts`));
        }
      });
    };
    tryConnect();
  });
}

async function start() {
  if (childProcess) {
    console.log("[OpenWebUI] Already running");
    return { port: OPEN_WEBUI_PORT, host: OPEN_WEBUI_HOST };
  }

  // 检查是否使用外部 Open WebUI（Docker 模式）
  if (process.env.OPEN_WEBUI_URL) {
    console.log(`[OpenWebUI] Using external instance at ${OPEN_WEBUI_URL}`);
    useExternal = true;
    isReady = true;
    return { port: OPEN_WEBUI_PORT, host: OPEN_WEBUI_HOST, external: true };
  }

  // Windows 上尝试多个 Python 路径
  const pythonCmd = process.platform === "win32"
    ? (process.env.PYTHON_PATH || "python")
    : "python3";

  // 使用 start.sh 或直接启动 main.py
  const args = [path.join(BACKEND_DIR, "open_webui", "main.py")];
  const env = getOpenWebUIEnv();
  // 确保 Python 能找到 open_webui 模块
  const pythonPath = [
    BACKEND_DIR,
    env.PYTHONPATH || "",
  ].join(process.platform === "win32" ? ";" : ":");

  console.log(
    `[OpenWebUI] Starting on http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}`
  );

  childProcess = spawn(pythonCmd, args, {
    cwd: BACKEND_DIR,
    env: { ...env, PYTHONPATH: pythonPath },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  childProcess.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.trim()) console.log(`[OpenWebUI] ${line}`);
    }
  });

  childProcess.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.trim()) console.error(`[OpenWebUI] ${line}`);
    }
  });

  childProcess.on("exit", (code, signal) => {
    console.log(
      `[OpenWebUI] Process exited (code=${code}, signal=${signal})`
    );
    childProcess = null;
    isReady = false;
  });

  childProcess.on("error", (err) => {
    console.error(`[OpenWebUI] Failed to start: ${err.message}`);
    childProcess = null;
    isReady = false;
  });

  // 等待健康检查（首次启动可能需要更长时间下载模型）
  try {
    await checkHealth(120, 2000); // 120次尝试，每次2秒 = 4分钟超时
    console.log(`[OpenWebUI] Ready at http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}`);
  } catch (err) {
    console.error(`[OpenWebUI] Health check failed: ${err.message}`);
    console.log(`[OpenWebUI] Process may still be starting in background`);
    // 不抛出错误，让 Express 继续启动，/workbench 会显示维护页面
  }

  return { port: OPEN_WEBUI_PORT, host: OPEN_WEBUI_HOST };
}

function stop() {
  if (useExternal) {
    console.log("[OpenWebUI] External instance, not stopping");
    return;
  }
  if (!childProcess) return;
  console.log("[OpenWebUI] Stopping...");
  childProcess.kill("SIGTERM");
  setTimeout(() => {
    if (childProcess && !childProcess.killed) {
      childProcess.kill("SIGKILL");
    }
  }, 5000);
}

function getStatus() {
  return {
    running: useExternal || !!childProcess,
    ready: isReady,
    external: useExternal,
    pid: childProcess?.pid || null,
    port: OPEN_WEBUI_PORT,
    host: OPEN_WEBUI_HOST,
    url: OPEN_WEBUI_URL,
  };
}

// 优雅关闭
process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

module.exports = { start, stop, getStatus };
