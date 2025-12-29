import { useEffect, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'

interface EditorProps {
    value: string
    onChange: (value: string) => void
    theme: 'light' | 'dark'
    onScroll?: (scrollPercent: number) => void
    scrollPercent?: number
    isScrollSource?: boolean
}

function Editor({ value, onChange, theme, onScroll, scrollPercent, isScrollSource }: EditorProps) {
    const editorRef = useRef<ReactCodeMirrorRef>(null)
    const isInternalScroll = useRef(false)

    // Handle external scroll sync
    useEffect(() => {
        if (scrollPercent !== undefined && !isScrollSource && editorRef.current?.view) {
            const view = editorRef.current.view
            const scroller = view.scrollDOM
            const maxScroll = scroller.scrollHeight - scroller.clientHeight
            if (maxScroll > 0) {
                isInternalScroll.current = true
                scroller.scrollTop = maxScroll * scrollPercent
                // Reset flag after a short delay
                setTimeout(() => {
                    isInternalScroll.current = false
                }, 50)
            }
        }
    }, [scrollPercent, isScrollSource])

    // Create scroll handler extension
    const scrollHandler = useCallback(() => {
        return EditorView.domEventHandlers({
            scroll: (event) => {
                if (isInternalScroll.current || !onScroll) return
                const target = event.target as HTMLElement
                const maxScroll = target.scrollHeight - target.clientHeight
                if (maxScroll > 0) {
                    const percent = target.scrollTop / maxScroll
                    onScroll(percent)
                }
            }
        })
    }, [onScroll])

    return (
        <div className="editor-container">
            <CodeMirror
                ref={editorRef}
                value={value}
                height="100%"
                theme={theme}
                extensions={[
                    markdown({ base: markdownLanguage, codeLanguages: languages }),
                    scrollHandler(),
                ]}
                onChange={(val) => onChange(val)}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    autocompletion: true,
                }}
            />
        </div>
    )
}

export default Editor
