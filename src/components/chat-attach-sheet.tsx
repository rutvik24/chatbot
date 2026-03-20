import { SymbolView } from "expo-symbols";
import {
  type ColorValue,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/common";

import type { ChatAttachmentChipColors } from "./chat-attachment-chips";

type Props = {
  visible: boolean;
  onClose: () => void;
  colors: ChatAttachmentChipColors & { background: ColorValue };
  onPickLibrary: () => void;
  onPickCamera: () => void;
  onPickFiles: () => void;
};

type RowProps = {
  icon: {
    ios: string;
    android: string;
    web: string;
  };
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ChatAttachmentChipColors & { background: ColorValue };
};

function SheetRow({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.surface }]}>
        <SymbolView
          name={icon as Parameters<typeof SymbolView>[0]["name"]}
          size={22}
          tintColor={colors.primary}
        />
      </View>
      <View style={styles.rowText}>
        <AppText style={[styles.rowTitle, { color: colors.text }]}>
          {title}
        </AppText>
        <AppText
          style={[styles.rowSubtitle, { color: colors.secondaryText }]}
          numberOfLines={2}
        >
          {subtitle}
        </AppText>
      </View>
      <SymbolView
        name={{
          ios: "chevron.right",
          android: "chevron_right",
          web: "chevron_right",
        }}
        size={16}
        tintColor={colors.secondaryText}
      />
    </Pressable>
  );
}

export function ChatAttachSheet({
  visible,
  onClose,
  colors,
  onPickLibrary,
  onPickCamera,
  onPickFiles,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              marginBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          <AppText style={[styles.sheetTitle, { color: colors.text }]}>
            Add to message
          </AppText>
          <AppText
            style={[styles.sheetHint, { color: colors.secondaryText }]}
            numberOfLines={2}
          >
            Photos, scans, PDFs, and text files help the assistant give richer
            answers. Your model must support vision or files.
          </AppText>

          <SheetRow
            icon={{
              ios: "photo.on.rectangle",
              android: "photo_library",
              web: "photo_library",
            }}
            title="Photo library"
            subtitle="Screenshots, exports, or any saved image"
            colors={colors}
            onPress={() => {
              onClose();
              onPickLibrary();
            }}
          />
          <SheetRow
            icon={{
              ios: "camera.fill",
              android: "photo_camera",
              web: "photo_camera",
            }}
            title="Camera"
            subtitle="Capture a document or whiteboard in the moment"
            colors={colors}
            onPress={() => {
              onClose();
              onPickCamera();
            }}
          />
          <SheetRow
            icon={{
              ios: "doc.text.fill",
              android: "attach_file",
              web: "attach_file",
            }}
            title="Files"
            subtitle="PDF, notes, code, CSV, JSON, and more"
            colors={colors}
            onPress={() => {
              onClose();
              onPickFiles();
            }}
          />

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <AppText style={[styles.cancelText, { color: colors.primary }]}>
              Cancel
            </AppText>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 12,
  },
  sheet: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sheetHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
