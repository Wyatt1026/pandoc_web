# Pandoc Web

[English](./README.md)

基于 Pandoc 的 Web 端 Markdown 编辑器，支持实时预览和文档格式转换。

![浅色主题](https://img.shields.io/badge/主题-浅色-brightgreen) ![深色主题](https://img.shields.io/badge/主题-深色-blue)

## 功能特性

- ✨ **实时预览** - 即时渲染 Markdown 内容
- 📝 **语法高亮** - 基于 CodeMirror 的编辑器
- 🔄 **多格式导出** - 转换为 Word、HTML、EPUB、LaTeX 等格式
- 🌙 **主题切换** - 支持浅色和深色模式
- 🐳 **Docker 部署** - 一键启动 Docker Compose

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite |
| 编辑器 | CodeMirror 6 |
| 预览 | react-markdown + remark-gfm |
| 后端 | Go 1.22 |
| 转换器 | Pandoc |
| 部署 | Docker Compose + Nginx |

## 快速开始

### Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/pandoc-web.git
cd pandoc-web

# 启动服务
docker compose up -d

# 访问 http://localhost:3000
```

### 本地开发

**前端：**
```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

**后端：**（需要本地安装 Pandoc）
```bash
cd backend
go run .
# API 运行在 http://localhost:8080
```

## 支持的格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| Word | .docx | Microsoft Word 文档 |
| HTML | .html | 独立 HTML 页面 |
| EPUB | .epub | 电子书格式 |
| LaTeX | .tex | LaTeX 源码 |
| RST | .rst | reStructuredText |

> **注意：** PDF 导出需要 TeXLive。如需支持 PDF，请在后端 Dockerfile 中添加 `texlive texlive-xetex`。

## API 接口

### 健康检查

```http
GET /api/health
```

**响应：**
```json
{"status": "ok"}
```

### 转换文档

```http
POST /api/convert
Content-Type: application/json

{
  "markdown": "# Hello World",
  "format": "html"
}
```

**响应：** 二进制文件下载

## 项目结构

```
pandoc-web/
├── frontend/               # React + TypeScript 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Editor.tsx
│   │   │   ├── Preview.tsx
│   │   │   └── ConvertPanel.tsx
│   │   ├── App.tsx
│   │   └── App.css
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                # Go API 服务
│   ├── handlers/
│   │   └── convert.go
│   ├── main.go
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 后端服务端口 |

### Docker Compose 端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3000 | Web 界面（Nginx） |
| 后端 | 8080 | API 服务（内部） |

## 开源协议

MIT
