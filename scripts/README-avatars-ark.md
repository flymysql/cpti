# 使用火山方舟（豆包 Seedream）批量生成 CPTI 头像

本仓库里的 **`docs/avatar-prompts-pixel-full.md`** 已写好每条提示词。  
**我无法替你代调用 API**（需要你的密钥，且密钥不应发到聊天里），但你可以在本地运行脚本完成批量出图。

## 1. 准备密钥与模型

1. 登录 [火山引擎](https://www.volcengine.com/)，开通 **方舟** 与 **图片生成（Seedream）** 等所需产品（以控制台说明为准）。  
2. 在方舟控制台创建 **API Key**，形如 `sk-...`。  
3. 确认你要用的 **模型 ID**（例如 `doubao-seedream-4-0-250828`，以官方文档为准）。

官方文档入口（若链接变更请以控制台为准）：

- [方舟大模型服务平台](https://www.volcengine.com/docs/82379)

常见请求形态为 OpenAI 兼容的：

`POST https://ark.cn-beijing.volces.com/api/v3/images/generations`  
Header：`Authorization: Bearer <ARK_API_KEY>`

## 2. 安装要求

- **Node.js 18+**（内置 `fetch`）

无需安装 npm 依赖。

## 3. 试运行（只解析 Markdown，不调 API）

```bash
node scripts/generate-avatars-ark.mjs --dry-run
```

应列出约 **47** 条任务（5 个单套 + 21×2 套）。

若显示 **Parsed 0 generation job(s)**，多半是 Markdown 使用了 **Windows CRLF 换行**：旧版脚本按 `\n## ` 切分会失败。当前脚本会在解析前把 `\r\n` 规范成 `\n`；若仍为 0，请确认 `--md` 指向的是本仓库的 `docs/avatar-prompts-pixel-full.md`，且二级标题形如 `## badboy — …`。

## 4. 正式生成（会扣费）

```bash
export ARK_API_KEY='你的密钥'
# 可选：
# export ARK_IMAGE_MODEL='doubao-seedream-4-0-250828'
# export ARK_IMAGE_SIZE='1024x1024'
# export ARK_API_BASE='https://ark.cn-beijing.volces.com/api/v3'

node scripts/generate-avatars-ark.mjs
```

- 默认输出目录：**`generated-avatars/`**（已加入 `.gitignore` 建议自行忽略大文件；若未忽略可自行添加）。  
- 文件名：`badboy.png`、`boundary-male.png`、`boundary-female.png` 等。  
- 默认每条请求间隔 **2.5s**，可用 `--delay-ms` 调整。  
- 先小规模试跑：`node scripts/generate-avatars-ark.mjs --limit 2`

## 5. 若接口与脚本不一致

火山若更新路径、字段名或鉴权方式，请以 **官方最新文档** 为准，并修改 `scripts/generate-avatars-ark.mjs` 中的 `generateOne` 函数（请求 URL 与 JSON body）。

## 6. 合规与内容

- 遵守平台用户协议与内容安全策略；部分人格名称在审核中可能被误判，可适当改写提示词再试。  
- 生成图版权与商用范围以火山 / 豆包服务条款为准。
