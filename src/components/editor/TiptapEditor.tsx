'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import HorizontalRule from '@tiptap/extension-horizontal-rule'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
}

type ToolbarButtonProps = {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  title?: string
}

function ToolbarButton({ onClick, active, children, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2 py-1 text-[11px] tracking-[0.04em] border border-border-dark transition-colors duration-150 ${
        active
          ? 'bg-accent text-charcoal border-accent'
          : 'text-text-secondary hover:text-text-primary hover:border-text-muted bg-transparent'
      }`}
    >
      {children}
    </button>
  )
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // blockquote and horizontalRule are included in StarterKit but we also import
        // the standalone extensions — disable duplicates
        blockquote: {},
        horizontalRule: false,
        heading: { levels: [2, 3] },
      }),
      HorizontalRule,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose-post outline-none min-h-[320px] px-0',
      },
    },
  })

  if (!editor) return null

  function addLink() {
    const url = window.prompt('url')
    if (!url) return
    editor?.chain().focus().setLink({ href: url }).run()
  }

  function addImage() {
    const url = window.prompt('image url')
    if (!url) return
    editor?.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div className="flex flex-col gap-0 border border-border-dark">
      {/* toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border-dark bg-[#1a1a18]">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="bold"
        >
          b
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="italic"
        >
          i
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="heading 2"
        >
          h2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="heading 3"
        >
          h3
        </ToolbarButton>
        <ToolbarButton
          onClick={addLink}
          active={editor.isActive('link')}
          title="link"
        >
          link
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.isActive('link') ? editor.chain().focus().unsetLink().run() : null}
          title="unlink"
        >
          unlink
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="blockquote"
        >
          quote
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="bullet list"
        >
          list
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="horizontal rule"
        >
          hr
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="code block"
        >
          code
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="image">
          img
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="table"
        >
          table
        </ToolbarButton>
      </div>

      {/* editor area */}
      <div className="bg-charcoal px-6 py-5">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
