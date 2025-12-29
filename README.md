# Pandoc Web

[中文文档](./README_CN.md)

A web-based Markdown editor with live preview and document conversion powered by Pandoc.

![Build Status](https://github.com/YOUR_USERNAME/pandoc_web/actions/workflows/docker-build.yml/badge.svg)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

## Features

- ✨ **Real-time Preview** - See your Markdown rendered instantly
- 📝 **Syntax Highlighting** - CodeMirror-powered editor
- 🔄 **Multi-format Export** - Convert to Word, HTML, EPUB, LaTeX, and more
- 🌙 **Theme Toggle** - Switch between light and dark modes
- 🐳 **Docker Ready** - One-command deployment with Docker Compose

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + Vite |
| Editor | CodeMirror 6 |
| Preview | react-markdown + remark-gfm |
| Backend | Go 1.22 |
| Converter | Pandoc |
| Deployment | Docker Compose + Nginx |

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/pandoc_web.git
cd pandoc_web

# Start services
docker compose up -d

# Open http://localhost:3000
```

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:5173
```

**Backend:** (requires Pandoc installed locally)
```bash
cd backend
go run .
# API running at http://localhost:8080
```

## Server Deployment

### Using Pre-built Images (Recommended)

After pushing to GitHub, images are automatically built via GitHub Actions and pushed to GitHub Container Registry (GHCR).

**1. Create environment file:**

```bash
# Create .env file on your server
cat > .env << EOF
GITHUB_REPO=your-username/pandoc_web
TAG=main
FRONTEND_PORT=80
EOF
```

**2. Download and run:**

```bash
# Download production compose file
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/pandoc_web/main/docker-compose.prod.yml

# Start services
docker compose -f docker-compose.prod.yml up -d
```

**3. (Optional) With custom port:**

```bash
FRONTEND_PORT=8080 docker compose -f docker-compose.prod.yml up -d
```

### Building on Server

If you prefer to build images on your server:

```bash
git clone https://github.com/YOUR_USERNAME/pandoc_web.git
cd pandoc_web
docker compose up -d --build
```

### Reverse Proxy (Nginx)

Example Nginx configuration for HTTPS:

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

## CI/CD

This project uses GitHub Actions for automated builds:

- **Trigger**: Push to `main` branch or version tags (`v*`)
- **Registry**: GitHub Container Registry (ghcr.io)
- **Images**: 
  - `ghcr.io/YOUR_USERNAME/pandoc_web/frontend:main`
  - `ghcr.io/YOUR_USERNAME/pandoc_web/backend:main`

## Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| Word | .docx | Microsoft Word Document |
| HTML | .html | Standalone HTML Page |
| EPUB | .epub | eBook Format |
| LaTeX | .tex | LaTeX Source |
| RST | .rst | reStructuredText |

> **Note:** PDF export requires TeXLive. Add `texlive texlive-xetex` to the backend Dockerfile if needed.

## API Reference

### Health Check

```http
GET /api/health
```

### Convert Document

```http
POST /api/convert
Content-Type: application/json

{
  "markdown": "# Hello World",
  "format": "html"
}
```

## Project Structure

```
pandoc-web/
├── .github/
│   └── workflows/
│       └── docker-build.yml    # CI/CD pipeline
├── frontend/                   # React + TypeScript
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                    # Go API Server
│   ├── handlers/
│   ├── main.go
│   └── Dockerfile
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
└── README.md
```

## License

GPL-3.0
