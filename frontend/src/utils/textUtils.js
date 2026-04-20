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
