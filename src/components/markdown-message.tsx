import Markdown, { type MarkdownProps } from 'react-native-markdown-display';
import MarkdownIt from 'markdown-it';
import { useMemo } from 'react';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export type MarkdownMessageProps = Omit<MarkdownProps, 'children'> & {
  markdown: string;
};

export default function MarkdownMessage({ markdown, ...rest }: MarkdownMessageProps) {
  const colors = useNativeThemeColors();

  const markdownit = useMemo(
    () =>
      new MarkdownIt({
        breaks: true, // Treat single newlines as <br>
        linkify: true,
      }),
    []
  );

  return (
    <Markdown
      {...rest}
      markdownit={markdownit}
      style={{
        body: { color: colors.text, lineHeight: 20 },
        link: { color: colors.primary },
        code_inline: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 8,
          color: colors.text,
        },
        code_block: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
        },
        fence: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
        },
        pre: {
          backgroundColor: colors.surface,
          borderRadius: 12,
        },
      }}>
      {typeof markdown === 'string' ? markdown : String(markdown)}
    </Markdown>
  );
}

