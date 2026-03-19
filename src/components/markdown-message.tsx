import Markdown, { type MarkdownProps } from 'react-native-markdown-display';
import MarkdownIt from 'markdown-it';
import { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { showToast } from '@/utils/toast-bus';

export type MarkdownMessageProps = Omit<MarkdownProps, 'children'> & {
  markdown: string;
};

function CopyableCodeBlock({
  code,
  stylesForFence,
  colors,
}: {
  code: string;
  stylesForFence: any;
  colors: ReturnType<typeof useNativeThemeColors>;
}) {
  return (
    <View style={{ marginTop: 8, marginBottom: 8 }}>
      <Text
        style={[
          stylesForFence,
          // Ensure code remains readable on both light/dark themes.
          {
            color: colors.text,
            fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
            lineHeight: 18,
          },
        ]}>
        {code}
      </Text>

      <Pressable
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(code);
            showToast({ message: 'Copied' });
          } catch {
            // If copy fails, we just don't show the success toast.
          }
        }}
        style={{
          marginTop: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Copy</Text>
      </Pressable>

    </View>
  );
}

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

  const rules = useMemo(() => {
    const normalizeCode = (node: any) => {
      let content = node?.content;
      if (typeof content === 'string' && content.charAt(content.length - 1) === '\n') {
        content = content.substring(0, content.length - 1);
      }
      return typeof content === 'string' ? content : '';
    };

    return {
      // Triple-backtick fences.
      fence: (node: any, _children: any, _parent: any, styles: any) =>
        (
          <CopyableCodeBlock
            code={normalizeCode(node)}
            key={node.key}
            stylesForFence={styles.fence}
            colors={colors}
          />
        ),
      // Indented code blocks.
      code_block: (node: any, _children: any, _parent: any, styles: any) =>
        (
          <CopyableCodeBlock
            code={normalizeCode(node)}
            key={node.key}
            stylesForFence={styles.code_block}
            colors={colors}
          />
        ),
    };
  }, [colors]);

  return (
    <Markdown
      {...rest}
      markdownit={markdownit}
      rules={rules as any}
      style={{
        body: { color: colors.text, lineHeight: 20 },
        link: { color: colors.primary },
        heading1: {
          color: colors.text,
          fontSize: 22,
          fontWeight: '800',
          lineHeight: 30,
          marginTop: 6,
          marginBottom: 4,
        },
        heading2: {
          color: colors.text,
          fontSize: 18,
          fontWeight: '800',
          lineHeight: 26,
          marginTop: 6,
          marginBottom: 4,
        },
        heading3: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '800',
          lineHeight: 24,
          marginTop: 6,
          marginBottom: 4,
        },
        heading4: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '800',
          lineHeight: 22,
          marginTop: 6,
          marginBottom: 3,
        },
        heading5: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '800',
          lineHeight: 21,
          marginTop: 6,
          marginBottom: 3,
        },
        heading6: {
          color: colors.text,
          fontSize: 12,
          fontWeight: '800',
          lineHeight: 18,
          marginTop: 6,
          marginBottom: 3,
        },
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

