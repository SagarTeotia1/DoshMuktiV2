import { Heart, TrendingUp, Leaf, Trophy, Shield, Sparkles, Gift } from 'lucide-react';

// Icon + duotone per shopping purpose — shared by the homepage "What Do You Seek?" row and the nav drawer.
export const PURPOSE_ICONS = {
  love: Heart,
  wealth: TrendingUp,
  health: Leaf,
  success: Trophy,
  protection: Shield,
  clarity: Sparkles,
  gifting: Gift,
} as const;

/** Muted, bronze-adjacent duotones — desaturated so each purpose reads distinct without breaking the warm palette. */
export const PURPOSE_GRADIENTS: Record<string, [string, string]> = {
  love: ['#D98BA0', '#B8546B'],
  wealth: ['#C9863F', '#9C5A26'],
  health: ['#9CBF8C', '#6B8F5C'],
  success: ['#8CAAC9', '#5B7A9C'],
  protection: ['#B69BD1', '#8B6BAE'],
  clarity: ['#A6A6D1', '#7A7AAE'],
  gifting: ['#E0A9C4', '#B8698F'],
};
