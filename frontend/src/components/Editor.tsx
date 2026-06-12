import { useEffect, useRef, useMemo, useState } from 'react'
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
    const [isSyncingScroll, setIsSyncingScroll] = useState(false)

    // Handle external scroll sync
    useEffect(() => {
        let resetTimer: ReturnType<typeof setTimeout> | null = null

        if (scrollPercent !== undefined && !isScrollSource && editorRef.current?.view) {
            const view = editorRef.current.view
            const scroller = view.scrollDOM
            const maxScroll = scroller.scrollHeight - scroller.clientHeight
            if (maxScroll > 0) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setIsSyncingScroll(true)
                scroller.scrollTop = maxScroll * scrollPercent
                // Reset flag after a short delay
                resetTimer = setTimeout(() => {
                    setIsSyncingScroll(false)
                }, 50)
            }
        }

        return () => {
            if (resetTimer) {
                clearTimeout(resetTimer)
            }
        }
    }, [scrollPercent, isScrollSource])

    const scrollExtension = useMemo(() => {
        return EditorView.domEventHandlers({
            scroll: (event) => {
                if (isSyncingScroll || !onScroll) return
                const target = event.target as HTMLElement
                const maxScroll = target.scrollHeight - target.clientHeight
                if (maxScroll > 0) {
                    const percent = target.scrollTop / maxScroll
                    onScroll(percent)
                }
            }
        })
    }, [isSyncingScroll, onScroll])

    return (
        <div className="editor-container">
            <CodeMirror
                ref={editorRef}
                value={value}
                height="100%"
                theme={theme}
                extensions={[
                    markdown({ base: markdownLanguage, codeLanguages: languages }),
                    scrollExtension,
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
