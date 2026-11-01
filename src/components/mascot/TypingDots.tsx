import { ThinkingStars } from '@/components/mascot/ThinkingStars';

/** L'indicatore «Theia sta scrivendo»: le due stelline che girano (dove non compare il viso di Theia). */
export function TypingDots({ size = 9, color }: { size?: number; color?: string }) {
  return <ThinkingStars size={size * 2.6} color={color} />;
}
