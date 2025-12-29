import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

interface EditorProps {
    value: string
    onChange: (value: string) => void
    theme: 'light' | 'dark'
}

function Editor({ value, onChange, theme }: EditorProps) {
    return (
        <div className="editor-container">
            <CodeMirror
                value={value}
                height="100%"
                theme={theme}
                extensions={[
                    markdown({ base: markdownLanguage, codeLanguages: languages })
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
