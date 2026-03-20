import Markdown, { type MarkdownProps } from 'react-native-markdown-display';
import MarkdownIt from 'markdown-it';
import { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { showToast } from '@/utils/toast-bus';

/**
 * Visual tone for markdown (e.g. user bubble on a solid primary background).
 */
export type MarkdownMessageTone = 'default' | 'onPrimary';

/**
 * Props for {@link MarkdownMessage}.
 *
 * `markdown` is rendered using `react-native-markdown-display` and `markdown-it`.
 * Fenced code blocks (```...```) and indented code blocks include a "Copy" button.
 */
export type MarkdownMessageProps = Omit<MarkdownProps, 'children'> & {
  /**
   * Markdown string to render (links, headings, lists, and code blocks).
   */
  markdown: string;
  /**
   * `onPrimary` uses light text and adjusted code/link colors for blue (or primary) bubbles.
   */
  tone?: MarkdownMessageTone;
};

function CopyableCodeBlock({
  code,
  stylesForFence,
  colors,
  tone,
}: {
  code: string;
  stylesForFence: any;
  colors: ReturnType<typeof useNativeThemeColors>;
  tone: MarkdownMessageTone;
}) {
  const onPrimary = tone === 'onPrimary';
  const codeColor = onPrimary ? 'rgba(255,255,255,0.96)' : colors.text;
  const copyBorder = onPrimary ? 'rgba(255,255,255,0.45)' : colors.border;
  const copyLabel = onPrimary ? 'rgba(255,255,255,0.98)' : colors.primary;

  return (
    <View style={{ marginTop: 8, marginBottom: 8 }}>
      <Text
        style={[
          stylesForFence,
          {
            color: codeColor,
            fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
            lineHeight: 20,
          },
        ]}>
        {code}
      </Text>

      <Pressable
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(code);
            showToast({
              variant: 'success',
              title: 'Copied',
              message: 'Code is on your clipboard.',
            });
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
          borderColor: copyBorder,
          backgroundColor: onPrimary ? 'rgba(0,0,0,0.2)' : undefined,
        }}>
        <Text style={{ color: copyLabel, fontWeight: '800', fontSize: 12 }}>Copy</Text>
      </Pressable>

    </View>
  );
}

/**
 * Renders a markdown message with theming support and code-copy UI.
 *
 * Typical usage:
 * - Render assistant chat messages in the chat screen.
 * - Display markdown from any OpenAI-compatible model.
 */
export default function MarkdownMessage({
  markdown,
  tone = 'default',
  ...rest
}: MarkdownMessageProps) {
  const colors = useNativeThemeColors();
  const onPrimary = tone === 'onPrimary';

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
            tone={tone}
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
            tone={tone}
          />
        ),
    };
  }, [colors, tone]);

  const text = onPrimary ? 'rgba(255,255,255,0.96)' : colors.text;
  const link = onPrimary ? 'rgba(255,255,255,0.98)' : colors.primary;
  const codeBg = onPrimary ? 'rgba(0,0,0,0.28)' : colors.surface;
  const codeBorder = onPrimary ? 'rgba(255,255,255,0.28)' : colors.border;

  const markdownStyles = useMemo(
    () => ({
      body: { color: text, lineHeight: 22, fontSize: 16 },
      link: {
        color: link,
        textDecorationLine: 'underline' as const,
        textDecorationColor: onPrimary ? 'rgba(255,255,255,0.55)' : undefined,
      },
      heading1: {
        color: text,
        fontSize: 22,
        fontWeight: '800' as const,
        lineHeight: 30,
        marginTop: 6,
        marginBottom: 4,
      },
      heading2: {
        color: text,
        fontSize: 18,
        fontWeight: '800' as const,
        lineHeight: 26,
        marginTop: 6,
        marginBottom: 4,
      },
      heading3: {
        color: text,
        fontSize: 16,
        fontWeight: '800' as const,
        lineHeight: 24,
        marginTop: 6,
        marginBottom: 4,
      },
      heading4: {
        color: text,
        fontSize: 15,
        fontWeight: '800' as const,
        lineHeight: 22,
        marginTop: 6,
        marginBottom: 3,
      },
      heading5: {
        color: text,
        fontSize: 14,
        fontWeight: '800' as const,
        lineHeight: 21,
        marginTop: 6,
        marginBottom: 3,
      },
      heading6: {
        color: text,
        fontSize: 13,
        fontWeight: '800' as const,
        lineHeight: 19,
        marginTop: 6,
        marginBottom: 3,
      },
      bullet_list: { marginTop: 4, marginBottom: 4 },
      ordered_list: { marginTop: 4, marginBottom: 4 },
      list_item: { marginTop: 2, marginBottom: 2 },
      paragraph: { marginTop: 0, marginBottom: 8 },
      code_inline: {
        backgroundColor: onPrimary ? 'rgba(255,255,255,0.22)' : colors.surface,
        borderWidth: 1,
        borderColor: codeBorder,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
        color: text,
      },
      code_block: {
        backgroundColor: codeBg,
        borderWidth: 1,
        borderColor: codeBorder,
        borderRadius: 14,
        padding: 10,
      },
      fence: {
        backgroundColor: codeBg,
        borderWidth: 1,
        borderColor: codeBorder,
        borderRadius: 14,
        padding: 10,
      },
      pre: {
        backgroundColor: codeBg,
        borderRadius: 14,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: onPrimary ? 'rgba(255,255,255,0.45)' : colors.primary,
        paddingLeft: 10,
        marginVertical: 6,
        opacity: onPrimary ? 0.95 : 1,
      },
    }),
    [codeBg, codeBorder, colors, link, onPrimary, text],
  );

  return (
    <Markdown
      {...rest}
      markdownit={markdownit}
      rules={rules as any}
      style={markdownStyles}>
      {typeof markdown === 'string' ? markdown : String(markdown)}
    </Markdown>
  );
}

