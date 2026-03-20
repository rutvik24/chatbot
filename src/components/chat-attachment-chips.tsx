import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import {
  type ColorValue,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText } from "@/components/common";
import type { ChatAttachment } from "@/utils/chat-timeline";

export type ChatAttachmentChipColors = {
  surface: ColorValue;
  border: ColorValue;
  text: ColorValue;
  secondaryText: ColorValue;
  primary: ColorValue;
};

type Props = {
  attachments: ChatAttachment[];
  colors: ChatAttachmentChipColors;
  variant: "composer" | "bubble";
  onRemove?: (id: string) => void;
};

/** Preview size: large enough to recognize the image/doc, small enough not to dominate the thread. */
const THUMB = { composer: 66, bubble: 78 } as const;

/** Text column width beside the thumb (filename + type). */
const META_EXTRA = { composer: 66, bubble: 78 } as const;

/** Thumb + margins + one text line + strip padding (composer horizontal scroll bound). */
const COMPOSER_STRIP_MAX_HEIGHT = THUMB.composer + 52;

export function ChatAttachmentChips({
  attachments,
  colors,
  variant,
  onRemove,
}: Props) {
  if (!attachments.length) return null;

  const thumb = THUMB[variant];
  const showRemove = Boolean(onRemove);

  const chips = attachments.map((a) => {
        const hasUri = Boolean(a.localUri);
        return (
          <View
            key={a.id}
            style={[
              styles.chip,
              {
                width: thumb + META_EXTRA[variant],
                borderColor: colors.border,
                backgroundColor:
                  variant === "bubble"
                    ? "rgba(255,255,255,0.12)"
                    : colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.thumbWrap,
                {
                  width: thumb,
                  height: thumb,
                  backgroundColor:
                    variant === "bubble"
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(148,163,184,0.22)",
                },
              ]}
            >
              {a.kind === "image" && hasUri ? (
                <Image
                  source={{ uri: a.localUri! }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  transition={120}
                />
              ) : (
                <View style={styles.fileIconCenter}>
                  <SymbolView
                    name={{
                      ios: "doc.fill",
                      android: "description",
                      web: "description",
                    }}
                    size={variant === "composer" ? 28 : 32}
                    tintColor={
                      variant === "bubble" ? "#FFFFFF" : colors.secondaryText
                    }
                  />
                </View>
              )}
              {!hasUri ? (
                <View style={styles.unavailableBadge}>
                  <AppText style={styles.unavailableBadgeText}>!</AppText>
                </View>
              ) : null}
              {showRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.name}`}
                  onPress={() => onRemove?.(a.id)}
                  style={({ pressed }) => [
                    styles.removeBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "xmark.circle.fill",
                      android: "close",
                      web: "close",
                    }}
                    size={22}
                    tintColor="rgba(0,0,0,0.45)"
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.metaCol}>
              <AppText
                numberOfLines={variant === "composer" ? 1 : 2}
                style={[
                  styles.fileName,
                  {
                    color:
                      variant === "bubble" ? "rgba(255,255,255,0.95)" : colors.text,
                  },
                ]}
              >
                {a.name}
              </AppText>
              <AppText
                numberOfLines={1}
                style={[
                  styles.mime,
                  {
                    color:
                      variant === "bubble"
                        ? "rgba(255,255,255,0.65)"
                        : colors.secondaryText,
                  },
                ]}
              >
                {!hasUri
                  ? "Re-attach to use"
                  : a.kind === "image"
                    ? "Image"
                    : a.mimeType?.split("/")[1]?.toUpperCase() || "File"}
              </AppText>
            </View>
          </View>
        );
  });

  /** Bubbles live inside the chat FlatList — avoid nested horizontal ScrollView (breaks vertical scroll, esp. Android). */
  if (variant === "bubble") {
    return (
      <View
        style={[styles.wrapRow, styles.rowBubble]}
        collapsable={false}
      >
        {chips}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={false}
      overScrollMode={Platform.OS === "android" ? "never" : undefined}
      style={styles.composerScroll}
      contentContainerStyle={[styles.row, styles.rowComposer]}
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  composerScroll: {
    flexGrow: 0,
    maxHeight: COMPOSER_STRIP_MAX_HEIGHT,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 10,
    width: "100%",
  },
  rowComposer: {
    paddingBottom: 10,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  rowBubble: {
    paddingBottom: 8,
    maxWidth: "100%",
  },
  chip: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
  },
  thumbWrap: {
    borderRadius: 15,
    margin: 7,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  fileIconCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  metaCol: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 12,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.15,
  },
  mime: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: "600",
  },
  removeBtn: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
  },
  unavailableBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(220,38,38,0.95)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  unavailableBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
