# 项目脚手架脚本

## GitHub 仓库一键初始化

一次性创建：16 个标签 + 5 个里程碑 + 95 个 Issue + 1 个 Project Board。

提供两个等价版本，按你的操作系统选一个：

| 文件 | 适用平台 | 说明 |
|------|----------|------|
| `setup-github.ps1` | Windows（**推荐**） | PowerShell 原生，无需 WSL/bash |
| `setup-github.sh` | macOS / Linux / Git Bash | Bash 版本 |

### 前置条件

1. **安装 GitHub CLI**

   - **Windows（推荐 MSI 安装）**：访问 https://cli.github.com → 点击「Download for Windows」→ 运行 `gh_*_windows_amd64.msi` 一路 Next
   - **Windows（winget 命令行）**：`winget install --id GitHub.cli`（需要 Windows 11 或带 App Installer 的 Windows 10）
   - **macOS**：`brew install gh`
   - **Linux**：见 https://cli.github.com

   安装后**重新打开** PowerShell / 终端，确保 `gh` 在 PATH 中：

   ```
   gh --version
   ```

2. **登录并授予项目权限**

   ```
   gh auth login --scopes "repo,project,write:org"
   ```

   依次选择：GitHub.com → HTTPS → Yes（Authenticate Git）→ Login with a web browser，复制一次性代码到浏览器授权。

3. **验证认证**

   ```
   gh auth status
   ```

   应显示 `Logged in to github.com as <你的账号>`，并包含 `repo`、`project` scope。

### 执行（Windows / PowerShell — 推荐）

在项目根目录的 PowerShell 中：

```powershell
# 临时放行执行策略并运行（最稳）
powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1
```

或永久放行当前用户后再执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   # 仅需运行一次
.\scripts\setup-github.ps1
```

覆盖默认仓库 / 看板名：

```powershell
$env:REPO = "your-org/your-repo"
$env:PROJECT_TITLE = "自定义看板名"
.\scripts\setup-github.ps1
```

### 执行（macOS / Linux / Git Bash）

```bash
bash scripts/setup-github.sh
```

或在其他仓库使用时覆盖默认变量：

```bash
REPO="your-org/your-repo" PROJECT_TITLE="自定义看板名" bash scripts/setup-github.sh
```

### 执行流程

```
前置检查 → 16 个标签 → 5 个里程碑 → 95 个 Issue → Project Board
```

预计耗时：1-3 分钟（取决于网络）。

### 重要说明

- **标签 / 里程碑** 已存在时会跳过或更新，可重复运行。
- **Issue 不去重**！每次运行都会新建 95 个 Issue。如果不小心运行多次，请手动删除多余 Issue。
- **Project Board** 创建需要 `project` scope 权限。如果失败，脚本会输出手动创建步骤。

### 失败排查

| 错误 | 解决 |
|------|------|
| `gh: command not found` / `gh : 无法将"gh"项识别为 cmdlet` | 未安装 gh CLI 或没重启终端，见前置条件 1 |
| `winget` 不可用 | Windows 10 较旧或缺 App Installer，改用 MSI 安装包 |
| `无法加载文件 ...setup-github.ps1，因为在此系统上禁止运行脚本` | 用 `powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1`，或 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `bash: /bin/bash: No such file or directory` / WSL 报错 | 用 `setup-github.ps1`（PowerShell 原生），不依赖 WSL |
| 输出中文乱码 | PowerShell 5.1 默认 GBK，脚本已内置 UTF-8 切换；如仍乱码请改用 PowerShell 7 或 Windows Terminal |
| `❌ 未登录 GitHub` | 执行 `gh auth login --scopes "repo,project,write:org"` |
| `❌ 无法访问仓库` | 检查仓库是否存在、是否有写权限 |
| Project 创建失败 | 重新登录加 `project` scope，或手动在 GitHub 网页创建（脚本会输出步骤） |
| Issue 创建到一半中断 | 已创建的 Issue 不会丢失。继续可手动用 `gh issue create` 单条补建 |

### 验证

执行完成后访问：

- Issues: `https://github.com/<repo>/issues`（应有 95 个 Open Issue）
- Milestones: `https://github.com/<repo>/milestones`（应有 5 个）
- Labels: `https://github.com/<repo>/labels`（应有 16 个新增标签）
- Projects: `https://github.com/users/<owner>/projects`

### 后续手动配置（推荐）

#### Project Board 自定义字段

1. 打开你的 Project
2. 点击右上角 `⋯` → `Settings`
3. 添加以下自定义字段：

   | 字段名 | 类型 | 选项 |
   |--------|------|------|
   | Phase | Single select | phase-1 / phase-2 / phase-3 / phase-4 / phase-5 |
   | Type | Single select | backend / frontend / devops / docs / verify |
   | Priority | Single select | high / normal / low |
   | Estimate | Number | (估时小时数) |
   | Actual | Number | (实际花时) |

#### 视图设置

| 视图名 | 类型 | 用途 |
|--------|------|------|
| All Tasks | Table | 全部任务总览 |
| Phase Board | Board by Phase | 按 Phase 分组的看板 |
| Active Sprint | Board by Status | 按状态（Backlog / In Progress / Done）跟踪 |
| Roadmap | Roadmap | 按 Estimate 时间线 |

#### 把 Issue 加到 Project

```bash
# 一次性把所有标签为 phase-* 的 Issue 加入 Project
for n in 1 2 3 4 5; do
  gh issue list --repo "$REPO" --label "phase-$n" --json number --limit 100 | \
    jq -r '.[].number' | \
    while read num; do
      gh project item-add <PROJECT_NUMBER> --owner "$OWNER" --url "https://github.com/$REPO/issues/$num"
    done
done
```

或者在 Project Web UI 中：`+ Add item` → 输入 Issue 编号或 URL → 批量添加。

---

## 后续可能添加的脚本

- `weekly-report.sh` — 自动生成本周完成 / 进行中 / 待办的周报
- `sync-from-issues.sh` — 把 Issue 状态同步到 docs/CHANGELOG.md
- `seed-test-data.sh` — 在本地填充测试用户/角色/文章
