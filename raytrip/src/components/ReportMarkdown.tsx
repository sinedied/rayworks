import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReportMarkdown({ content }: { content: string }) {
  return (
    <div className="report-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img']}
        urlTransform={url => /^(https?:|mailto:|#)/i.test(url) ? defaultUrlTransform(url) : ''}
        components={{
          a: ({ href, children }) => href
            ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            : <span>{children}</span>,
          table: ({ children }) => <div className="markdown-table" tabIndex={0} role="region" aria-label="Report table"><table>{children}</table></div>,
        }}
      >{content}</Markdown>
    </div>
  );
}
