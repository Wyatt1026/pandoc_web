import { useState, useRef } from 'react'

interface ConvertPanelProps {
    markdown: string
    onMarkdownChange: (markdown: string) => void
}

type OutputFormat = 'docx' | 'html' | 'epub' | 'latex' | 'rst'
type TemplateOption = 'none' | 'default' | 'custom'

const formatOptions: { value: OutputFormat; label: string; icon: string }[] = [
    { value: 'docx', label: 'Word 文档', icon: '📘' },
    { value: 'html', label: 'HTML 网页', icon: '🌐' },
    { value: 'epub', label: 'EPUB 电子书', icon: '📚' },
    { value: 'latex', label: 'LaTeX 源码', icon: '📐' },
    { value: 'rst', label: 'reStructuredText', icon: '📄' },
]

function ConvertPanel({ markdown, onMarkdownChange }: ConvertPanelProps) {
    const [format, setFormat] = useState<OutputFormat>('docx')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [templateOption, setTemplateOption] = useState<TemplateOption>('none')
    const [customFile, setCustomFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mdFileInputRef = useRef<HTMLInputElement>(null)

    const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (!file.name.endsWith('.docx')) {
                setError('请上传 .docx 格式的模板文件')
                return
            }
            setCustomFile(file)
            setError(null)
        }
    }

    const handleMdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
                setError('请上传 .md 或 .markdown 格式的文件')
                return
            }
            const reader = new FileReader()
            reader.onload = (event) => {
                const content = event.target?.result as string
                onMarkdownChange(content)
                setError(null)
            }
            reader.onerror = () => {
                setError('读取文件失败')
            }
            reader.readAsText(file)
        }
        // Reset input so the same file can be uploaded again
        if (mdFileInputRef.current) {
            mdFileInputRef.current.value = ''
        }
    }

    const handleDownloadDefaultTemplate = async () => {
        try {
            const response = await fetch('/api/reference-doc')
            if (!response.ok) {
                throw new Error('下载模板失败')
            }
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'custom-reference.docx'
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            setError(err instanceof Error ? err.message : '下载模板失败')
        }
    }

    const handleConvert = async () => {
        setLoading(true)
        setError(null)

        try {
            let response: Response

            // Use multipart form if custom template is selected
            if (format === 'docx' && (templateOption === 'custom' || templateOption === 'default')) {
                const formData = new FormData()
                formData.append('markdown', markdown)
                formData.append('format', format)
                
                if (templateOption === 'default') {
                    formData.append('useCustomRef', 'true')
                } else if (templateOption === 'custom' && customFile) {
                    formData.append('referenceDoc', customFile)
                }

                response = await fetch('/api/convert-with-ref', {
                    method: 'POST',
                    body: formData,
                })
            } else {
                response = await fetch('/api/convert', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        markdown,
                        format,
                    }),
                })
            }

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

    const isDocxFormat = format === 'docx'

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

                {isDocxFormat && (
                    <>
                        <label htmlFor="template-select">Word 模板：</label>
                        <select
                            id="template-select"
                            value={templateOption}
                            onChange={(e) => {
                                setTemplateOption(e.target.value as TemplateOption)
                                if (e.target.value !== 'custom') {
                                    setCustomFile(null)
                                }
                            }}
                            disabled={loading}
                        >
                            <option value="none">不使用模板</option>
                            <option value="default">默认模板</option>
                            <option value="custom">自定义模板</option>
                        </select>

                        {templateOption === 'default' && (
                            <button
                                className="template-download-btn"
                                onClick={handleDownloadDefaultTemplate}
                                type="button"
                                title="下载默认模板查看或修改"
                            >
                                📥 下载模板
                            </button>
                        )}

                        {templateOption === 'custom' && (
                            <div className="custom-template-input">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".docx"
                                    onChange={handleTemplateFileChange}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    className="template-upload-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    type="button"
                                >
                                    📁 {customFile ? customFile.name : '选择模板文件'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div className="upload-md-section">
                    <input
                        ref={mdFileInputRef}
                        type="file"
                        accept=".md,.markdown"
                        onChange={handleMdFileUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="upload-md-btn"
                        onClick={() => mdFileInputRef.current?.click()}
                        type="button"
                        disabled={loading}
                        title="上传 Markdown 文件到编辑器"
                    >
                        📤 上传 .md 文件
                    </button>
                </div>

                <button
                    className="convert-button"
                    onClick={handleConvert}
                    disabled={loading || !markdown.trim() || (templateOption === 'custom' && !customFile)}
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
