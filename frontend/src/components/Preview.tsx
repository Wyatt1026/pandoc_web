import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface PreviewProps {
    markdown: string
}

function Preview({ markdown }: PreviewProps) {
    return (
        <div className="preview-container">
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
