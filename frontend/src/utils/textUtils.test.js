import { describe, it, expect } from 'vitest'
import { stripMarkdown, customUrlTransform, isWebUrl } from './textUtils'

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

describe('customUrlTransform', () => {
  it('should prepend https:// to urls starting with www.', () => {
    expect(customUrlTransform('www.google.com')).toBe('https://www.google.com')
    expect(customUrlTransform('WWW.EXAMPLE.COM/path')).toBe('https://WWW.EXAMPLE.COM/path')
  })

  it('should preserve standard http and https urls', () => {
    expect(customUrlTransform('https://google.com')).toBe('https://google.com')
    expect(customUrlTransform('http://example.com')).toBe('http://example.com')
  })

  it('should allow custom application protocols', () => {
    expect(customUrlTransform('evernote:///xxx/yyy/zzz')).toBe('evernote:///xxx/yyy/zzz')
    expect(customUrlTransform('obsidian://open?vault=my-vault')).toBe('obsidian://open?vault=my-vault')
    expect(customUrlTransform('mailto:test@example.com')).toBe('mailto:test@example.com')
  })

  it('should block dangerous XSS protocols', () => {
    expect(customUrlTransform('javascript:alert(1)')).toBe('')
    expect(customUrlTransform('JAVASCRIPT:alert(1)')).toBe('')
    expect(customUrlTransform('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(customUrlTransform('vbscript:msgbox("xss")')).toBe('')
    expect(customUrlTransform('file:///etc/passwd')).toBe('')
  })

  it('should preserve relative paths and anchors', () => {
    expect(customUrlTransform('/local/path')).toBe('/local/path')
    expect(customUrlTransform('#section')).toBe('#section')
  })
})

describe('isWebUrl', () => {
  it('should return true for http/https and relative urls', () => {
    expect(isWebUrl('https://www.google.com')).toBe(true)
    expect(isWebUrl('http://example.com')).toBe(true)
    expect(isWebUrl('/relative/path')).toBe(true)
  })

  it('should return false for custom app protocols', () => {
    expect(isWebUrl('evernote:///xxx/yyy/zzz')).toBe(false)
    expect(isWebUrl('mailto:user@example.com')).toBe(false)
  })
})
