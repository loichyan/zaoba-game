import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

interface MathTexProps {
  tex: string;
  display?: boolean;
  className?: string;
}

export function MathTex({ tex, display = false, className = '' }: MathTexProps) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
      }),
    [tex, display],
  );

  const Tag = display ? 'div' : 'span';
  return (
    <Tag
      className={`math-tex ${display ? 'is-display' : 'is-inline'} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
