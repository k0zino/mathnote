/**
 * 不同模型会混用 \(...\)、\[...\]、$...$、$$...$$ 四种定界符。
 * remark-math 只认 $ 形式，所以渲染前做一次归一化；代码块和行内代码原样保留。
 */

function displayBlock(body: string): string {
  return `\n$$\n${body.trim()}\n$$\n`
}

function normalizeMathText(text: string): string {
  return (
    text
      // \[ ... \] -> 多行 $$ ... $$（remark-math 要求 display 定界符单独成行）
      .replace(/(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g, (_match, body: string) =>
        displayBlock(body),
      )
      // 单行 $$ ... $$ 也展开成 display block
      .replace(/\$\$([^\n]*?)\$\$/g, (_match, body: string) => displayBlock(body))
      // \( ... \) -> $ ... $
      .replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g, (_match, body: string) => {
        return `$${body}$`
      })
      // KaTeX 不支持 align，用 aligned 代替
      .replace(/\\begin\{(align|align\*)\}/g, '\\begin{aligned}')
      .replace(/\\end\{(align|align\*)\}/g, '\\end{aligned}')
  )
}

export function normalizeLatexDelimiters(text: string): string {
  // 先按代码块 / 行内代码切分，只处理代码之外的文本
  const codePattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g
  let result = ''
  let lastIndex = 0

  for (const match of text.matchAll(codePattern)) {
    const index = match.index ?? 0
    result += normalizeMathText(text.slice(lastIndex, index))
    result += match[0]
    lastIndex = index + match[0].length
  }

  result += normalizeMathText(text.slice(lastIndex))
  return result
}
