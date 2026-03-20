import { Platform, Switch } from "react-native";

import type { MessageCopyPreferenceSwitchProps } from "@/components/message-copy-preference-switch.types";

/** iOS & web: RN switch. Android: `message-copy-preference-switch.android.tsx` (Compose). */
export default function MessageCopyPreferenceSwitch({
  value,
  onValueChange,
  colors,
}: MessageCopyPreferenceSwitchProps) {
  return (
    <Switch
      accessibilityLabel="Copy messages from chat bubbles"
      value={value}
      onValueChange={onValueChange}
      trackColor={{
        false: colors.border,
        true: Platform.OS === "ios" ? undefined : colors.primary,
      }}
      thumbColor={undefined}
      ios_backgroundColor={colors.border}
    />
  );
}
