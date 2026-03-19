import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useWindowDimensions } from 'react-native';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

type AuthIllustrationVariant = 'signIn' | 'signUp' | 'forgotPassword' | 'changePassword';

/**
 * Which illustration to render in the auth screens.
 */
type AuthIllustrationProps = {
  variant: AuthIllustrationVariant;
};

function asSvgColor(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Decorative SVG-like illustration used on authentication screens.
 *
 * Use this in sign-in / sign-up / forgot-password / change-password forms.
 */
export default function AuthIllustration({
  variant,
}: AuthIllustrationProps) {
  const colors = useNativeThemeColors();
  const { width } = useWindowDimensions();
  const illustrationHeight = Math.max(92, Math.min(156, width * 0.26));
  const primary = asSvgColor(colors.primary, '#2563EB');
  const success = asSvgColor(colors.success, '#16A34A');
  const text = asSvgColor(colors.text, '#111827');

  const accentPath = {
    signIn: 'M20 55 C50 10, 150 10, 180 55 C150 90, 50 90, 20 55 Z',
    signUp: 'M18 58 C58 12, 142 12, 182 58 C142 100, 58 100, 18 58 Z',
    forgotPassword: 'M22 56 C44 22, 156 22, 178 56 C156 86, 44 86, 22 56 Z',
    changePassword: 'M22 58 C48 16, 152 16, 178 58 C152 92, 48 92, 22 58 Z',
  }[variant];

  return (
    <Svg width="100%" height={illustrationHeight} viewBox="0 0 200 120">
      <Rect x={8} y={12} width={184} height={96} rx={22} fill={primary} fillOpacity="0.12" />
      <Path d={accentPath} fill={primary} fillOpacity="0.2" />
      <Circle cx={44} cy={38} r={8} fill={primary} fillOpacity="0.45" />
      <Circle cx={158} cy={80} r={10} fill={success} fillOpacity="0.35" />
      <Rect x={62} y={46} width={76} height={8} rx={4} fill={text} fillOpacity="0.35" />
      <Rect x={72} y={62} width={56} height={8} rx={4} fill={text} fillOpacity="0.2" />
    </Svg>
  );
}
