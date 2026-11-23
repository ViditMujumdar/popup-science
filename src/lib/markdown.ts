import { marked } from 'marked';
import DOMPurify from 'dompurify';
/** Markdown from the AI → sanitized HTML (no links, images or raw HTML survive). */
export function md(src: string): string {
  const html = marked.parse(src, { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'br', 'h3', 'h4', 'blockquote', 'sub', 'sup'], ALLOWED_ATTR: [] });
}
