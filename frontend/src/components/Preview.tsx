import { useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface PreviewProps {
    markdown: string
    onScroll?: (scrollPercent: number) => void
    scrollPercent?: number
    isScrollSource?: boolean
}

function Preview({ markdown, onScroll, scrollPercent, isScrollSource }: PreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const isInternalScroll = useRef(false)

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

    return (
        <div 
            className="preview-container" 
            ref={containerRef}
            onScroll={handleScroll}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    )
}

export default Preview
