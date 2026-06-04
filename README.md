# AI 小说 Agent 管理平台

本项目是一个本地优先的中文网文创作 Agent 管理平台，面向多小说、多 Agent、多记忆域的长期创作工作流。

当前阶段只初始化工程目录、产品文档、技术文档和 AI 协作基础文件，不包含业务代码实现。

## 本地开发

安装依赖后，在项目根目录运行：

```bash
pnpm dev
```

该命令会同时启动前端和后端服务。后端默认监听 `API_PORT=4100`，前端 Vite 开发服务器会把 `/api` 请求代理到同一个后端端口。

## 本地模型配置

项目根目录提供 `.env.example` 作为环境变量模板，真实密钥写入本地 `.env`。`.env` 已被 `.gitignore` 排除，不应提交到仓库。

当前 DeepSeek V4 基础接入读取以下变量：

```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

`DEEPSEEK_MODEL` 可按需要改为 `deepseek-v4-pro`。后端或 Agent 进程启动前需要加载这些环境变量。
