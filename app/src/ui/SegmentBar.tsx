import { useEffect } from "react";
import { Rect } from "react-native-svg";
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedProps,
  withTiming,
  ReduceMotion,
} from "react-native-reanimated";
import { colors } from "./theme";
const AnimatedRect = Animated.createAnimatedComponent(Rect);
function Segment({
  progress,
  index,
  count,
  x,
  y,
  width,
  height,
  color,
}: {
  progress: SharedValue<number>;
  index: number;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: Math.min(1, Math.max(0, progress.value * count - index)),
  }));
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        stroke={colors.rim}
        strokeWidth={1}
        fill={colors.surface}
      />
      <AnimatedRect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        fill={color}
        animatedProps={animatedProps}
      />
    </>
  );
}
export function SegmentBar({
  value,
  count = 12,
  x,
  y,
  vertical = false,
  arc = false,
  color = colors.accent,
}: {
  value: number | null;
  count?: number;
  x: number;
  y: number;
  vertical?: boolean;
  arc?: boolean;
  color?: string;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value =
      value === null
        ? 0
        : withTiming(Math.min(1, Math.max(0, value)), {
            duration: 140,
            reduceMotion: ReduceMotion.System,
          });
  }, [value, progress]);
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Segment
          key={i}
          progress={progress}
          index={i}
          count={count}
          x={vertical ? x : x + i * 14}
          y={
            vertical
              ? y + (count - 1 - i) * 13
              : arc
                ? y + Math.abs((i / (count - 1) - 0.5) * 2) ** 2 * 40
                : y
          }
          width={vertical ? 16 : 8}
          height={vertical ? 7 : 25}
          color={color}
        />
      ))}
    </>
  );
}
