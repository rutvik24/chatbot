import { Host, Switch } from "@expo/ui/jetpack-compose";

import type { MessageCopyPreferenceSwitchProps } from "@/components/message-copy-preference-switch.types";
import { useThemePreference } from "@/ctx/theme-preference-context";

/**
 * Material 3 switch via Jetpack Compose (Expo UI native host).
 */
export default function MessageCopyPreferenceSwitch({
  value,
  onValueChange,
  colors,
}: MessageCopyPreferenceSwitchProps) {
  const { resolvedColorScheme } = useThemePreference();

  return (
    <Host matchContents colorScheme={resolvedColorScheme}>
      <Switch
        value={value}
        onCheckedChange={onValueChange}
        colors={{
          checkedTrackColor: colors.primary,
          checkedThumbColor: "#FFFFFF",
          uncheckedTrackColor: colors.border,
          uncheckedThumbColor: colors.secondaryText,
        }}
      />
    </Host>
  );
}
