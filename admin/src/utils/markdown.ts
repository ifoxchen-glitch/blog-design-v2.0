import { marked, type Renderer } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'

// Register only commonly-used languages to keep bundle small
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('vue', xml)
hljs.registerLanguage('css', css)

export interface RenderOptions {
  onArtifactOpen?: (lang: string, code: string) => void
}

let _renderer: Renderer | null = null

function getRenderer(opts?: RenderOptions): Renderer {
  if (_renderer) return _renderer

  const renderer = new marked.Renderer()

  // Custom code block rendering with copy + artifact buttons
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = lang || 'text'
    const validLang = hljs.getLanguage(language) ? language : 'text'
    let highlighted = text
    try {
      if (validLang !== 'text') {
        highlighted = hljs.highlight(text, { language: validLang }).value
      } else {
        highlighted = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }
    } catch {
      highlighted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    const artifactAttr = opts?.onArtifactOpen
      ? ` data-artifact-lang="${language}" data-artifact-code="${encodeURIComponent(text)}"`
      : ''

    return `<div class="md-code-block relative group my-2 rounded-lg overflow-hidden border border-base-content/10 bg-[#1e1e1e]">
      <div class="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-base-content/10">
        <span class="text-[10px] text-[#6a9955] font-mono uppercase">${language}</span>
        <div class="flex items-center gap-2">
          ${opts?.onArtifactOpen ? `<button class="artifact-open-btn text-[10px] text-[#4ec9b0] hover:text-[#9cdcfe] transition-colors"${artifactAttr}>Artifact</button>` : ''}
          <button class="copy-code-btn text-[10px] text-[#858585] hover:text-white transition-colors" data-code="${encodeURIComponent(text)}">复制</button>
        </div>
      </div>
      <pre class="p-3 overflow-x-auto text-xs font-mono leading-relaxed"><code class="hljs language-${validLang}">${highlighted}</code></pre>
    </div>`
  }

  // Inline code
  renderer.codespan = ({ text }: { text: string }) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<code class="px-1.5 py-0.5 rounded bg-base-300 text-xs font-mono text-primary">${escaped}</code>`
  }

  // Links: open in new tab, add rel
  renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
    const t = title ? ` title="${title}"` : ''
    return `<a href="${href}"${t} target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${text}</a>`
  }

  // Paragraphs
  renderer.paragraph = ({ text }: { text: string }) => {
    return `<p class="mb-2 last:mb-0 leading-relaxed">${text}</p>`
  }

  // Lists
  renderer.list = ({ items, ordered }: { items: any[]; ordered: boolean }) => {
    const tag = ordered ? 'ol' : 'ul'
    const cls = ordered ? 'list-decimal' : 'list-disc'
    const body = items.map((item: any) => renderer.listitem(item)).join('')
    return `<${tag} class="${cls} pl-5 mb-2 space-y-0.5">${body}</${tag}>`
  }

  renderer.listitem = ({ text }: { text: string }) => {
    return `<li class="leading-relaxed">${text}</li>`
  }

  // Headings
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const sizes: Record<number, string> = {
      1: 'text-lg font-bold mb-3 mt-4',
      2: 'text-base font-bold mb-2 mt-3',
      3: 'text-sm font-semibold mb-2 mt-2',
      4: 'text-sm font-medium mb-1 mt-2',
    }
    const cls = sizes[depth] || 'text-sm font-medium mb-1'
    return `<h${depth} class="${cls}">${text}</h${depth}>`
  }

  // Blockquote
  renderer.blockquote = ({ text }: { text: string }) => {
    return `<blockquote class="border-l-2 border-primary/30 pl-3 py-1 my-2 text-base-content/70 italic">${text}</blockquote>`
  }

  // Table
  renderer.table = ({ header, rows }: { header: any[]; rows: any[][] }) => {
    const headerHtml = header.map((cell: any) => renderer.tablecell(cell)).join('')
    const body = rows.map((row: any[]) => {
      const rowHtml = row.map((cell: any) => renderer.tablecell(cell)).join('')
      return renderer.tablerow({ text: rowHtml })
    }).join('')
    return `<div class="overflow-x-auto my-2"><table class="w-full text-xs border-collapse border border-base-content/10 rounded-lg overflow-hidden">
      <thead class="bg-base-200/50"><tr>${headerHtml}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`
  }

  renderer.tablerow = ({ text }: { text: string }) => {
    return `<tr class="border-b border-base-content/5 last:border-0">${text}</tr>`
  }

  renderer.tablecell = ({ text, header }: { text: string; header: boolean }) => {
    const tag = header ? 'th' : 'td'
    const cls = header ? 'px-3 py-2 text-left font-medium text-xs' : 'px-3 py-2 text-xs'
    return `<${tag} class="${cls} border-r border-base-content/5 last:border-0">${text}</${tag}>`
  }

  // Horizontal rule
  renderer.hr = () => {
    return `<hr class="my-3 border-base-content/10" />`
  }

  _renderer = renderer
  return renderer
}

/**
 * Render markdown text to safe HTML.
 * Call initMarkdown() once before using this if you need artifact buttons.
 */
export function renderMarkdown(text: string, opts?: RenderOptions): string {
  const renderer = getRenderer(opts)
  marked.setOptions({
    renderer,
    breaks: true,
    gfm: true,
  })
  return marked.parse(text, { async: false }) as string
}

/**
 * Attach delegated event listeners for copy-code and artifact-open buttons.
 * Call this once on the chat container element.
 */
export function attachMarkdownListeners(
  container: HTMLElement,
  opts?: { onArtifactOpen?: (lang: string, code: string) => void }
): () => void {
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // Copy code button
    if (target.classList.contains('copy-code-btn')) {
      const code = decodeURIComponent(target.getAttribute('data-code') || '')
      navigator.clipboard.writeText(code).then(() => {
        const original = target.textContent
        target.textContent = '已复制!'
        setTimeout(() => { target.textContent = original }, 2000)
      })
      e.stopPropagation()
      return
    }

    // Artifact open button
    if (target.classList.contains('artifact-open-btn')) {
      const lang = target.getAttribute('data-artifact-lang') || 'text'
      const code = decodeURIComponent(target.getAttribute('data-artifact-code') || '')
      opts?.onArtifactOpen?.(lang, code)
      e.stopPropagation()
      return
    }
  }

  container.addEventListener('click', handleClick)
  return () => container.removeEventListener('click', handleClick)
}
