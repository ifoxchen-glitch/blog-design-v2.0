# 设计规范一页（交付摘要）

面向开发与 Figma 对齐的 **语义令牌** 说明；实现见 [`css/tokens.css`](../css/tokens.css)。

## 字体

| 用途 | 令牌 / 类 | 建议 Figma 样式名 |
|------|------------|-------------------|
| 展示 / 文章标题 | `--font-display` | Text/Display |
| 正文 UI | `--font-body` | Text/Body |
| 代码 | `--font-mono` | Text/Code |

中文优先系统栈：`PingFang SC`、`Microsoft YaHei` 等；标题可选用衬线栈（Georgia / 宋体）以增强编辑感。

## 字号阶梯（rem，根 16px）

| 令牌 | 用途 |
|------|------|
| `--text-display` | 首页 Hero 主标题（clamp 响应） |
| `--text-h1` | 页面主标题、文章标题 |
| `--text-h2` | 文章二级标题、区块标题 |
| `--text-h3` | 卡片标题、三级标题 |
| `--text-body` | 默认 body |
| `--text-body-lg` | **长文正文**（`.prose`） |
| `--text-caption` | 日期、标签、页脚、图注 |
| `--text-code` | 行内/块代码相对正文字号 |

行高：`--leading-tight`（标题）、`--leading-body`、`--leading-relaxed`（长文）。

## 颜色（语义）

| 令牌 | 语义 |
|------|------|
| `--color-bg` | 页面背景 |
| `--color-surface` | 卡片/浮层面 |
| `--color-text` | 主正文 |
| `--color-text-muted` | 次要说明 |
| `--color-border` | 分割线、边框 |
| `--color-accent` / `--color-accent-hover` | 链接与强调交互 |
| `--color-code-bg` | 代码与浅底块 |
| `--color-quote-border` | 引用条 |

**深色模式**：同一套语义名，在 `prefers-color-scheme: dark` 下重写数值；Figma 中建议用 **Mode** 维护两套。

**对比度**：正文与背景建议满足 WCAG AA；链接悬停仍需可辨识。

## 间距（8px 栅格）

`--space-1`（4px）… `--space-7`（64px）。卡片间隙用 `--space-5`，prose 段间距 `--space-4`，H2 上间距 `--space-6`。

页面水平内边距：`--layout-padding`（clamp，窄屏更紧）。

## 版心与阅读宽度

| 令牌 | 值 | 说明 |
|------|-----|------|
| `--prose-max` | `42rem` | 中文长文约 35～45 全角视觉；英文可改为 `65ch` |
| 顶栏内容最大宽 | `72rem`（在 CSS 中写于 `.site-header__inner` 等） | 与列表网格对齐 |

## 圆角与阴影

- `--radius-sm` / `--radius-md` / `--radius-lg`：标签、输入、卡片、封面。
- `--shadow-card`：文章卡片轻阴影（深色模式加深）。

## 组件 ↔ 样式文件

| 组件 | 主要选择器 |
|------|------------|
| 顶栏 | `.site-header`, `.site-logo`, `.nav-desktop` |
| 移动端菜单 | `.nav-mobile`, `.nav-mobile__panel` |
| 页脚 | `.site-footer` |
| Hero | `.hero` |
| 文章卡片 | `.post-card`, 变体 `.post-card--text-only` |
| 元信息 | `.meta-row`, `.pill` |
| 长文 | `.prose`, `.article-layout`, `.toc` |
| 相关阅读 / 订阅条 | `.related`, `.newsletter` |

## 页面原型路径

- [index.html](../index.html) 首页  
- [archive.html](../archive.html) 归档  
- [post.html](../post.html) 单篇压版  
- [about.html](../about.html) 关于  
- [components.html](../components.html) 组件索引  

本地预览：用浏览器直接打开 `index.html`，或使用任意静态服务器。
