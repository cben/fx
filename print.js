'use strict'
const indent = require('indent-string')
const config = require('./config')

function format(value, style, highlightStyle, regexp, transform = x => x) {
  console.error('  format:', value)
  if (!regexp) {
    return style(transform(value))
  }
  const marked = value
    .replace(regexp, s => '<highlight>' + s + '<highlight>')

  return transform(marked)
    .split(/<highlight>/g)
    .map((s, i) => i % 2 !== 0 ? highlightStyle(s) : style(s))
    .join('')
}

function print(input, options = {}) {
  console.error('print:', input, options)

  const { expanded, highlight, currentPath, hidden = new Set() } = options
  const index = new Map()
  let row = 0
  let skippedLines = false

  function doPrint(v, path = '') {
    index.set(row, path)

    // Code for highlighting parts become cumbersome.
    // Maybe we should refactor this part.
    const highlightStyle = (currentPath === path) ? config.highlightCurrent : config.highlight
    const formatStyle = (v, style) => format(v, style, highlightStyle, highlight)
    const formatText = (v, style, path) => {
      const highlightStyle = (currentPath === path) ? config.highlightCurrent : config.highlight
      return format(v, style, highlightStyle, highlight, JSON.stringify)
    }

    const eol = () => {
      row++
      skippedLines = false
      return '\n'
    }

    const markSkipped = (text) => {
      if (!skippedLines) {
        return text
      }
      // KLUDGE: rewrite leading line of already formatted text.
      const leadingSpaces = text.search(/\S/)
      const newPrefix = '\u203E'.repeat(Math.max(leadingSpaces, 1)) // ‾ OVERLINE
      return text.replace(/^\s*/, newPrefix) 
    }

    if (typeof v === 'undefined') {
      return void 0
    }

    if (v === null) {
      return formatStyle(JSON.stringify(v), config.null)
    }

    if (typeof v === 'number' && Number.isFinite(v)) {
      return formatStyle(JSON.stringify(v), config.number)
    }

    if (typeof v === 'object' && v.isLosslessNumber) {
      return formatStyle(v.toString(), config.number)
    }

    if (typeof v === 'boolean') {
      return formatStyle(JSON.stringify(v), config.boolean)

    }

    if (typeof v === 'string') {
      return formatText(v, config.string, path)
    }

    if (Array.isArray(v)) {
      let output = config.bracket('[')
      const len = v.length

      if (len > 0) {
        if (expanded && !expanded.has(path)) {
          output += '\u2026'
        } else {
          output += eol()
          let i = 0
          for (let item of v) {
            const value = typeof item === 'undefined' ? null : item // JSON.stringify compatibility
            const itemPath = path + '[' + i + ']'
            if (hidden.has(itemPath)) {
              skippedLines = true
            } else {
              output += markSkipped(indent(doPrint(value, itemPath), config.space))
              output += i < len - 1 ? config.comma(',') + eol() : '  '
              //output += 
            }
            i++
          }
        }
      }

      return output + config.bracket(markSkipped(']'))
    }

    if (typeof v === 'object' && v.constructor === Object) {
      let output = config.bracket('{')

      const entries = Object.entries(v).filter(([key, value]) => typeof value !== 'undefined') // JSON.stringify compatibility
      const len = entries.length

      if (len > 0) {
        if (expanded && !expanded.has(path)) {
          output += '\u2026'
        } else {
          output += eol()
          let i = 0
          for (let [key, value] of entries) {
            const itemPath = path + '.' + key
            if (hidden.has(itemPath)) {
              skippedLines = true
            } else {
              const part = formatText(key, config.key, itemPath) + config.colon(':') + ' ' + doPrint(value, itemPath)
              output += markSkipped(indent(part, config.space))
              output += i < len - 1 ? config.comma(',') + eol() : '  '
              //output += eol()
            }
            i++
          }
        }
      }

      return output + config.bracket(markSkipped('}'))
    }

    return JSON.stringify(v, null, config.space)
  }

  return [doPrint(input), index]
}

module.exports = print
