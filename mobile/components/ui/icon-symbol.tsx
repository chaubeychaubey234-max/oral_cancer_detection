// MaterialIcons mapping on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// SF Symbol names used in this app mapped to Material Icons
const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  'house.fill': 'home',
  'paperplane.fill': 'info-outline',
  'camera.fill': 'photo-camera',
  'clock.fill': 'history',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
};

type IconSymbolName = keyof typeof MAPPING | string;

/**
 * An icon component that uses Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: string;
}) {
  const iconName = MAPPING[name] || 'circle';
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
