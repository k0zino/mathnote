import assert from 'node:assert'
import { normalizeLatexDelimiters } from '../src/latex.ts'

const cases = [
  {
    name: 'inline \\(...\\)',
    input: '设 \\(x^2\\) 是一个平方。',
    expected: '设 $x^2$ 是一个平方。',
  },
  {
    name: 'display \\[...\\] becomes a block',
    input: '结果是 \\[\\sum_{n=1}^{\\infty} \\frac{1}{n^2}\\]',
    expected: '结果是 \n$$\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2}\n$$\n',
  },
  {
    name: 'single-line $$ becomes a block',
    input: '已有 $a+b$ 和 $$c+d$$',
    expected: '已有 $a+b$ 和 \n$$\nc+d\n$$\n',
  },
  {
    name: 'already-formatted block is unchanged',
    input: '$$\na+b\n$$',
    expected: '$$\na+b\n$$',
  },
  {
    name: 'code fence is untouched',
    input: '```tex\n\\(x\\)\n```\n外面 \\(y\\)',
    expected: '```tex\n\\(x\\)\n```\n外面 $y$',
  },
  {
    name: 'inline code is untouched',
    input: '写法 `\\(x\\)`，实际 \\(y\\)',
    expected: '写法 `\\(x\\)`，实际 $y$',
  },
  {
    name: 'align -> aligned',
    input: '\\[\\begin{align} a &= b \\end{align}\\]',
    expected: '\n$$\n\\begin{aligned} a &= b \\end{aligned}\n$$\n',
  },
  {
    name: 'latex linebreak is not a display delimiter',
    input: 'a \\\\[2pt] b',
    expected: 'a \\\\[2pt] b',
  },
]

for (const testCase of cases) {
  const actual = normalizeLatexDelimiters(testCase.input)
  assert.strictEqual(actual, testCase.expected, testCase.name)
  console.log(`ok  ${testCase.name}`)
}

console.log('LaTeX delimiter tests passed')
