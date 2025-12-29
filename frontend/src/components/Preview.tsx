import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface PreviewProps {
    markdown: string
}

function Preview({ markdown }: PreviewProps) {
    return (
        <div className="preview-container">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
            </ReactMarkdown>
        </div>
    )
}

export default Preview
