import { useState } from 'react'

interface ConvertPanelProps {
    markdown: string
}

type OutputFormat = 'docx' | 'html' | 'epub' | 'latex' | 'rst'

const formatOptions: { value: OutputFormat; label: string; icon: string }[] = [
    { value: 'docx', label: 'Word 文档', icon: '📘' },
    { value: 'html', label: 'HTML 网页', icon: '🌐' },
    { value: 'epub', label: 'EPUB 电子书', icon: '📚' },
    { value: 'latex', label: 'LaTeX 源码', icon: '📐' },
    { value: 'rst', label: 'reStructuredText', icon: '📄' },
]

function ConvertPanel({ markdown }: ConvertPanelProps) {
    const [format, setFormat] = useState<OutputFormat>('docx')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConvert = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    markdown,
                    format,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `转换失败: ${response.statusText}`)
            }

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = `document.${format}`
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/)
                if (match) {
                    filename = match[1]
                }
            }

            // Download the file
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            setError(err instanceof Error ? err.message : '发生未知错误')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="convert-panel">
            <div className="convert-controls">
                <label htmlFor="format-select">输出格式：</label>
                <select
                    id="format-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutputFormat)}
                    disabled={loading}
                >
                    {formatOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.icon} {opt.label}
                        </option>
                    ))}
                </select>
                <button
                    className="convert-button"
                    onClick={handleConvert}
                    disabled={loading || !markdown.trim()}
                >
                    {loading ? (
                        <>
                            <span className="spinner"></span>
                            转换中...
                        </>
                    ) : (
                        <>
                            🔄 转换并下载
                        </>
                    )}
                </button>
            </div>
            {error && (
                <div className="error-message">
                    ⚠️ {error}
                </div>
            )}
        </div>
    )
}

export default ConvertPanel
