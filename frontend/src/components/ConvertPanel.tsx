import { useEffect, useRef, useState } from 'react'
import { Download, FolderOpen, Upload, AlertTriangle, Loader2 } from 'lucide-react'

interface ConvertPanelProps {
    markdown: string
    onMarkdownChange: (markdown: string) => void
}

type OutputFormat = 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'rst'
type TemplateOption = 'none' | 'default' | 'custom'
type ConversionPhase = 'preparing' | 'uploading' | 'converting' | 'downloading' | 'finalizing'

interface ConversionProgress {
    phase: ConversionPhase
    percent: number
    detail: string
}

interface ConversionResult {
    blob: Blob
    filename: string
}

const formatOptions: { value: OutputFormat; label: string }[] = [
    { value: 'pdf', label: 'PDF 文档' },
    { value: 'docx', label: 'Word 文档' },
    { value: 'html', label: 'HTML 网页' },
    { value: 'epub', label: 'EPUB 电子书' },
    { value: 'latex', label: 'LaTeX 源码' },
    { value: 'rst', label: 'reStructuredText' },
]

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const getProgressLabel = (progress: ConversionProgress | null) => {
    if (!progress) {
        return '转换中...'
    }

    switch (progress.phase) {
        case 'preparing':
            return `准备中 ${progress.percent}%`
        case 'uploading':
            return `上传中 ${progress.percent}%`
        case 'converting':
            return `转换中 ${progress.percent}%`
        case 'downloading':
            return `下载中 ${progress.percent}%`
        case 'finalizing':
            return `完成 ${progress.percent}%`
        default:
            return `转换中 ${progress.percent}%`
    }
}

const extractFilename = (contentDisposition: string | null, fallbackFormat: OutputFormat) => {
    let filename = `document.${fallbackFormat}`

    if (!contentDisposition) {
        return filename
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match) {
        return decodeURIComponent(utf8Match[1])
    }

    const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
    if (asciiMatch) {
        return asciiMatch[1]
    }

    return filename
}

const readBlobText = async (blob: Blob | null) => {
    if (!blob) {
        return ''
    }

    try {
        return await blob.text()
    } catch {
        return ''
    }
}

const extractErrorMessage = async (xhr: XMLHttpRequest) => {
    const responseText = await readBlobText(xhr.response instanceof Blob ? xhr.response : null)

    if (responseText) {
        try {
            const parsed = JSON.parse(responseText) as { error?: string }
            if (parsed.error) {
                return parsed.error
            }
        } catch {
            return responseText
        }
    }

    return `转换失败: ${xhr.statusText || '服务器错误'}`
}

const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(anchor)
}

function ConvertPanel({ markdown, onMarkdownChange }: ConvertPanelProps) {
    const [format, setFormat] = useState<OutputFormat>('docx')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState<ConversionProgress | null>(null)
    const [templateOption, setTemplateOption] = useState<TemplateOption>('none')
    const [customFile, setCustomFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mdFileInputRef = useRef<HTMLInputElement>(null)
    const xhrRef = useRef<XMLHttpRequest | null>(null)
    const conversionPulseRef = useRef<number | null>(null)

    const clearConversionPulse = () => {
        if (conversionPulseRef.current !== null) {
            window.clearInterval(conversionPulseRef.current)
            conversionPulseRef.current = null
        }
    }

    const startConversionPulse = () => {
        clearConversionPulse()
        conversionPulseRef.current = window.setInterval(() => {
            setProgress((current) => {
                if (!current || current.phase !== 'converting') {
                    return current
                }

                const increment = current.percent < 72 ? 3 : 1
                return {
                    ...current,
                    percent: Math.min(current.percent + increment, 88),
                }
            })
        }, 320)
    }

    useEffect(() => {
        return () => {
            clearConversionPulse()
            xhrRef.current?.abort()
        }
    }, [])

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

    const requestConversion = (url: string, body: Document | XMLHttpRequestBodyInit | null, isJson: boolean) => {
        return new Promise<ConversionResult>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhrRef.current = xhr
            xhr.open('POST', url)
            xhr.responseType = 'blob'

            if (isJson) {
                xhr.setRequestHeader('Content-Type', 'application/json')
            }

            xhr.upload.onloadstart = () => {
                setProgress({
                    phase: 'uploading',
                    percent: 8,
                    detail: '正在发送文档到服务器',
                })
            }

            xhr.upload.onprogress = (event) => {
                const uploadRatio = event.lengthComputable ? event.loaded / event.total : 0.5
                const percent = clampProgress(8 + uploadRatio * 28)
                setProgress({
                    phase: 'uploading',
                    percent,
                    detail: '正在发送文档到服务器',
                })
            }

            xhr.upload.onload = () => {
                setProgress((current) => ({
                    phase: 'converting',
                    percent: Math.max(current?.percent ?? 0, 40),
                    detail: '服务器正在生成文件',
                }))
                startConversionPulse()
            }

            xhr.onprogress = (event) => {
                clearConversionPulse()
                const downloadRatio = event.lengthComputable ? event.loaded / event.total : 0.5
                const percent = clampProgress(88 + downloadRatio * 10)
                setProgress({
                    phase: 'downloading',
                    percent: Math.min(percent, 98),
                    detail: '正在接收转换结果',
                })
            }

            xhr.onload = async () => {
                clearConversionPulse()
                xhrRef.current = null

                if (xhr.status >= 200 && xhr.status < 300) {
                    setProgress({
                        phase: 'finalizing',
                        percent: 100,
                        detail: '正在保存文件',
                    })

                    resolve({
                        blob: xhr.response,
                        filename: extractFilename(xhr.getResponseHeader('Content-Disposition'), format),
                    })
                    return
                }

                reject(new Error(await extractErrorMessage(xhr)))
            }

            xhr.onerror = () => {
                clearConversionPulse()
                xhrRef.current = null
                reject(new Error('网络错误，转换失败'))
            }

            xhr.onabort = () => {
                clearConversionPulse()
                xhrRef.current = null
                reject(new Error('转换已取消'))
            }

            xhr.send(body)
        })
    }

    const handleConvert = async () => {
        setLoading(true)
        setError(null)
        setProgress({
            phase: 'preparing',
            percent: 3,
            detail: '正在准备转换请求',
        })

        try {
            let result: ConversionResult

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

                result = await requestConversion('/api/convert-with-ref', formData, false)
            } else {
                result = await requestConversion(
                    '/api/convert',
                    JSON.stringify({
                        markdown,
                        format,
                    }),
                    true,
                )
            }

            triggerDownload(result.blob, result.filename)
        } catch (err) {
            setError(err instanceof Error ? err.message : '发生未知错误')
        } finally {
            clearConversionPulse()
            setLoading(false)
            xhrRef.current = null
            setProgress(null)
        }
    }

    const isDocxFormat = format === 'docx'

    return (
        <>
            <div className="convert-controls">
                <select
                    id="format-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutputFormat)}
                    disabled={loading}
                    aria-label="输出格式"
                >
                    {formatOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                {isDocxFormat && (
                    <>
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
                            aria-label="Word 模板"
                        >
                            <option value="none">无模板</option>
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
                                <Download size={14} /> <span>下载模板</span>
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
                                    <FolderOpen size={14} /> {customFile ? customFile.name : '选择模板'}
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
                        <Upload size={14} /> <span>上传 .md</span>
                    </button>
                </div>

                <button
                    className={`convert-button${loading ? ' is-loading' : ''}`}
                    onClick={handleConvert}
                    disabled={loading || !markdown.trim() || (templateOption === 'custom' && !customFile)}
                    aria-busy={loading}
                    style={loading ? ({ ['--convert-progress' as string]: `${progress?.percent ?? 0}%` }) : undefined}
                >
                    {loading ? (
                        <>
                            <span className="convert-button-content">
                                <span className="convert-button-label">
                                    <Loader2 className="animate-spin" size={14} />
                                    {getProgressLabel(progress)}
                                </span>
                                <span className="convert-button-subtitle">
                                    {progress?.detail ?? '正在处理文件'}
                                </span>
                            </span>
                            <span className="convert-button-progress" aria-hidden="true">
                                <span className="convert-button-progress-bar" />
                            </span>
                        </>
                    ) : (
                        <>
                            <Download size={14} /> 转换下载
                        </>
                    )}
                </button>
            </div>
            {error && (
                <div className="error-message">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}
        </>
    )
}

export default ConvertPanel
