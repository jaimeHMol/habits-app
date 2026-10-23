/**
 * Utility to strip basic Markdown formatting from a string.
 * Focused on links, bold, italic, and other common patterns.
 */
export const stripMarkdown = (text) => {
  if (!text) return '';
  
  return text
    // Remove links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italic: **text**, *text*, __text__, _text_
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove strike-through: ~~text~~
    .replace(/~~(.*?)~~/g, '$1')
    // Remove inline code: `text`
    .replace(/`(.*?)`/g, '$1')
    // Remove HTML-like tags (if any)
    .replace(/<[^>]*>/g, '')
    // Clean up extra spaces
    .trim();
};

const dangerousProtocolRegex = /^(javascript|data|vbscript|file):/i;
const validSchemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*$/;

/**
 * Custom URL transformer for ReactMarkdown.
 * - Prepends https:// to URLs starting with www.
 * - Allows custom application protocols (e.g., evernote://, obsidian://, mailto:)
 * - Blocks dangerous XSS protocols (javascript:, data:, vbscript:, file:)
 */
export const customUrlTransform = (value) => {
  if (!value) return '';
  const trimmed = value.trim();

  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  const colon = trimmed.indexOf(':');
  const questionMark = trimmed.indexOf('?');
  const numberSign = trimmed.indexOf('#');
  const slash = trimmed.indexOf('/');

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign)
  ) {
    return trimmed;
  }

  if (dangerousProtocolRegex.test(trimmed)) {
    return '';
  }

  const scheme = trimmed.slice(0, colon);
  if (validSchemeRegex.test(scheme)) {
    return trimmed;
  }

  return '';
};

/**
 * Determines whether a URL should open in a new tab (_blank).
 * Only http(s) and relative links open in a new tab; custom app protocols
 * (e.g. evernote://, mailto:) open directly to avoid leaving blank tabs.
 */
export const isWebUrl = (href) => {
  if (!href) return false;
  return /^(https?:\/\/|\/|#)/i.test(href);
};

