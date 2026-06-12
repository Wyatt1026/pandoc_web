import { useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface PreviewProps {
    markdown: string
    assetUrls?: Record<string, string>
    markdownPath?: string | null
    onScroll?: (scrollPercent: number) => void
    scrollPercent?: number
    isScrollSource?: boolean
}

const stripUrlSuffix = (value: string) => value.split(/[?#]/, 1)[0]

const decodePath = (value: string) => {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

const normalizeAssetPath = (value: string) => {
    const cleanPath = decodePath(stripUrlSuffix(value))
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')

    const segments: string[] = []
    for (const segment of cleanPath.split('/')) {
        if (!segment || segment === '.') {
            continue
        }

        if (segment === '..') {
            segments.pop()
            continue
        }

        segments.push(segment)
    }

    return segments.join('/')
}

const dirname = (value: string) => {
    const normalized = normalizeAssetPath(value)
    const lastSlashIndex = normalized.lastIndexOf('/')
    return lastSlashIndex === -1 ? '' : normalized.slice(0, lastSlashIndex)
}

const isExternalImageSrc = (value: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)

const removePandocImageAttributes = (value: string) => {
    return value.replace(/(!\[[^\]\n]*\]\([^)\n]+\))\{[^}\n]*\}/g, '$1')
}

function Preview({ markdown, assetUrls = {}, markdownPath, onScroll, scrollPercent, isScrollSource }: PreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const isInternalScroll = useRef(false)
    const markdownDir = useMemo(() => (markdownPath ? dirname(markdownPath) : ''), [markdownPath])
    const previewMarkdown = useMemo(() => removePandocImageAttributes(markdown), [markdown])

    // Handle external scroll sync
    useEffect(() => {
        if (scrollPercent !== undefined && !isScrollSource && containerRef.current) {
            const container = containerRef.current
            const maxScroll = container.scrollHeight - container.clientHeight
            if (maxScroll > 0) {
                isInternalScroll.current = true
                container.scrollTop = maxScroll * scrollPercent
                // Reset flag after a short delay
                setTimeout(() => {
                    isInternalScroll.current = false
                }, 50)
            }
        }
    }, [scrollPercent, isScrollSource])

    const handleScroll = useCallback(() => {
        if (isInternalScroll.current || !onScroll || !containerRef.current) return
        const container = containerRef.current
        const maxScroll = container.scrollHeight - container.clientHeight
        if (maxScroll > 0) {
            const percent = container.scrollTop / maxScroll
            onScroll(percent)
        }
    }, [onScroll])

    const resolveImageSrc = useCallback((src: string | undefined) => {
        if (!src || isExternalImageSrc(src)) {
            return src
        }

        const directPath = normalizeAssetPath(src)
        const relativeToMarkdownPath = normalizeAssetPath(markdownDir ? `${markdownDir}/${src}` : src)
        return assetUrls[directPath] ?? assetUrls[relativeToMarkdownPath] ?? src
    }, [assetUrls, markdownDir])

    return (
        <div 
            className="preview-container" 
            ref={containerRef}
            onScroll={handleScroll}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    img: ({ node, src, alt, ...props }) => {
                        void node

                        return (
                            <img
                                {...props}
                                src={resolveImageSrc(src)}
                                alt={alt ?? ''}
                                loading="lazy"
                                decoding="async"
                            />
                        )
                    },
                }}
            >
                {previewMarkdown}
            </ReactMarkdown>
        </div>
    )
}

export default Preview
