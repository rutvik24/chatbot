import type { ColorValue } from "react-native";

export type MessageCopySwitchColors = {
  primary: ColorValue;
  border: ColorValue;
  secondaryText: ColorValue;
};

export type MessageCopyPreferenceSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  colors: MessageCopySwitchColors;
};
