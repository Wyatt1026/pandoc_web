import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import Preview from './components/Preview'
import ConvertPanel from './components/ConvertPanel'
import './App.css'

type Theme = 'light' | 'dark'

function App() {
  const [markdown, setMarkdown] = useState<string>(`# 欢迎使用 Pandoc Web

这是一个支持实时预览的 **Markdown** 编辑器。

## 功能特性

- ✨ 实时预览
- 📝 语法高亮
- 🔄 多格式转换
- 📥 一键下载

## 支持的格式

| 格式 | 扩展名 |
|------|--------|
| Word | .docx  |
| HTML | .html  |
| EPUB | .epub  |
| LaTeX | .tex  |

## 代码示例

\`\`\`javascript
function hello() {
  console.log("Hello, Pandoc!");
}
\`\`\`

> 在左侧编辑区域开始编写你的文档吧！
`)

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    return saved || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <h1>📄 Pandoc Web</h1>
            <p>Markdown 编辑器 & 文档转换工具</p>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={`切换到${theme === 'light' ? '深色' : '浅色'}模式`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>
      <ConvertPanel markdown={markdown} />
      <main className="main">
        <div className="panel editor-panel">
          <div className="panel-header">
            <span>📝 编辑器</span>
          </div>
          <Editor value={markdown} onChange={setMarkdown} theme={theme} />
        </div>
        <div className="panel preview-panel">
          <div className="panel-header">
            <span>👁️ 预览</span>
          </div>
          <Preview markdown={markdown} />
        </div>
      </main>
    </div>
  )
}

export default App
