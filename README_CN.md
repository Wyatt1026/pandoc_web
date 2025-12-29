# Pandoc Web

[English](./README.md)

基于 Pandoc 的 Web 端 Markdown 编辑器，支持实时预览和文档格式转换。

![构建状态](https://github.com/Wyatt1026/pandoc_web/actions/workflows/docker-build.yml/badge.svg)
![开源协议](https://img.shields.io/badge/license-GPL--3.0-blue)

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

**无需本地安装 Pandoc！** 所有依赖已包含在 Docker 镜像中。

```bash
# 克隆仓库
git clone https://github.com/Wyatt1026/pandoc_web.git
cd pandoc_web

# 启动服务
docker compose up -d

# 访问 http://localhost:3000
```

### 本地开发（不使用 Docker）

**前置要求：**
- Node.js 20+ 用于前端
- Go 1.22+ 和 **本地安装 Pandoc** 用于后端

**前端：**
```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

**后端：**
```bash
# 先安装 Pandoc：
# macOS: brew install pandoc
# Ubuntu: apt-get install pandoc
# Windows: choco install pandoc

cd backend
go run .
# API 运行在 http://localhost:8080
```

## 服务器部署

### 使用预构建镜像（推荐）

代码推送到 GitHub 后，GitHub Actions 会自动构建镜像并推送到 GitHub Container Registry (GHCR)。

**1. 创建环境变量文件：**

```bash
# 在服务器上创建 .env 文件
cat > .env << EOF
GITHUB_REPO=wyatt1026/pandoc_web
TAG=main
FRONTEND_PORT=6364
EOF
```

**2. 下载并运行：**

```bash
# 下载生产环境 compose 文件
curl -O https://raw.githubusercontent.com/Wyatt1026/pandoc_web/main/docker-compose.prod.yml

# 启动服务
docker compose -f docker-compose.prod.yml up -d
```

**3. 访问应用：**

- 默认地址：http://你的服务器IP:6364
- 自定义端口：`FRONTEND_PORT=8080 docker compose -f docker-compose.prod.yml up -d`

### 在服务器上构建

如果你更喜欢在服务器上构建镜像：

```bash
git clone https://github.com/Wyatt1026/pandoc_web.git
cd pandoc_web
docker compose up -d --build
```

### 反向代理（Nginx）

Nginx HTTPS 配置示例：

```nginx
server {
    listen 443 ssl http2;
    server_name pandoc.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## CI/CD 自动化

本项目使用 GitHub Actions 进行自动构建：

- **触发条件**：推送到 `main` 分支或版本标签（`v*`）
- **镜像仓库**：GitHub Container Registry (ghcr.io)
- **镜像地址**：
  - `ghcr.io/Wyatt1026/pandoc_web/frontend:main`
  - `ghcr.io/Wyatt1026/pandoc_web/backend:main`

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

### 转换文档

```http
POST /api/convert
Content-Type: application/json

{
  "markdown": "# Hello World",
  "format": "html"
}
```

## 项目结构

```
pandoc-web/
├── .github/
│   └── workflows/
│       └── docker-build.yml    # CI/CD 流水线
├── frontend/                   # React + TypeScript 前端
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                    # Go API 服务
│   ├── handlers/
│   ├── main.go
│   └── Dockerfile
├── docker-compose.yml          # 开发环境
├── docker-compose.prod.yml     # 生产环境
└── README.md
```

## 开源协议

GPL-3.0
