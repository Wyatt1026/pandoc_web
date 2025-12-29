# Pandoc Web

[中文文档](./README_CN.md)

A web-based Markdown editor with live preview and document conversion powered by Pandoc.

![Light Theme](https://img.shields.io/badge/theme-light-brightgreen) ![Dark Theme](https://img.shields.io/badge/theme-dark-blue)

## Features

- ✨ **Real-time Preview** - See your Markdown rendered instantly
- � **Syntax Highlighting** - CodeMirror-powered editor
- �🔄 **Multi-format Export** - Convert to Word, HTML, EPUB, LaTeX, and more
- � **Theme Toggle** - Switch between light and dark modes
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
git clone https://github.com/YOUR_USERNAME/pandoc-web.git
cd pandoc-web

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

**Response:**
```json
{"status": "ok"}
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

**Response:** Binary file download

## Project Structure

```
pandoc-web/
├── frontend/               # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Editor.tsx
│   │   │   ├── Preview.tsx
│   │   │   └── ConvertPanel.tsx
│   │   ├── App.tsx
│   │   └── App.css
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                # Go API Server
│   ├── handlers/
│   │   └── convert.go
│   ├── main.go
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend server port |

### Docker Compose Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Web UI (Nginx) |
| Backend | 8080 | API Server (internal) |

## License

MIT
