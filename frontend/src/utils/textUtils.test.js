import { describe, it, expect } from 'vitest'
import { stripMarkdown } from './textUtils'

describe('stripMarkdown', () => {
  it('should remove links and keep only the text', () => {
    expect(stripMarkdown('Check this [link](https://example.com)')).toBe('Check this link')
  })

  it('should remove bold and italic formatting', () => {
    expect(stripMarkdown('Hello **world** and *italic*')).toBe('Hello world and italic')
  })

  it('should remove inline code', () => {
    expect(stripMarkdown('Use `npm install`')).toBe('Use npm install')
  })

  it('should handle complex mixed markdown', () => {
    const input = 'Check **[this](url)** and `that` ~~strike~~'
    expect(stripMarkdown(input)).toBe('Check this and that strike')
  })
})
