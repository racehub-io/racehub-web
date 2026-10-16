/* eslint-disable react-hooks/rules-of-hooks */
import React, { useMemo } from "react";
import { Stack } from "@visx/shape";
import { scaleLinear, scaleOrdinal } from "@visx/scale";
import { transpose } from "d3-array";
import { animated, useSpring } from "react-spring";

import { generateData } from "./generateData";
import { useAnimationFrame } from "./helpers";

// seconds
const ANIMATION_TIME = 4e3;

// constants
const NUM_LAYERS = 3;
const SAMPLES_PER_LAYER = 20;
const BUMPS_PER_LAYER = 15;
export const BACKGROUND = "#ffdede";

// utils
const range = (n: number) => Array.from(new Array(n), (_, i) => i);

const keys = range(NUM_LAYERS);

// scales
const yScale = scaleLinear<number>({
  domain: [-30, 50],
});
const colorScale = scaleOrdinal<number, string>({
  domain: keys,
  range: ["#212c45", "#00d78f", "#212c45"],
});

// accessors
type Datum = number[];
const getY0 = (d: Datum) => yScale(d[0]) ?? 0;
const getY1 = (d: Datum) => yScale(d[1]) ?? 0;
let animationCount = 0;

export type StreamGraphProps = {
  width: number;
  height: number;
  multiplier?: number;
  opacity?: number;
  marginTop?: number;
  animate?: boolean;
};

export function Streamgraph({
  width,
  height,
  opacity = 1,
  marginTop = 0,
  multiplier = 3,
  animate = true,
}: StreamGraphProps) {
  const [frame, setFrame] = React.useState(0);

  useAnimationFrame((deltaTime: number) => {
    animationCount += deltaTime;

    if (animationCount > ANIMATION_TIME) {
      animationCount = 0;
      setFrame((prevFrame) => prevFrame + 1);
    }
  });

  const xScale = scaleLinear<number>({
    domain: [0, SAMPLES_PER_LAYER * multiplier - 1],
  });

  if (width < 10) return null;

  xScale.range([0, width]);
  yScale.range([height, 0]);

  const disabledMultiplier = !animate ? 0 : 1;

  // generate layers in render to update on touch
  const layers = useMemo(() => {
    return transpose<number>(
      keys.map(() =>
        generateData(
          SAMPLES_PER_LAYER * multiplier,
          BUMPS_PER_LAYER * disabledMultiplier
        )
      )
    );
  }, [frame]);

  const stacks = useMemo(() => {
    return (
      <g>
        <Stack<number[], number>
          data={layers}
          keys={keys}
          offset="wiggle"
          color={colorScale}
          x={(_, i) => xScale(i) ?? 0}
          y0={getY0}
          y1={getY1}
        >
          {({ stacks, path }) =>
            stacks.map((stack) => {
              // Alternatively use renderprops <Spring to={{ d }}>{tweened => ...}</Spring>
              const tweened = useSpring({
                d: path(stack),
                config: { duration: ANIMATION_TIME },
              });
              const color = colorScale(stack.key);
              return (
                <g key={`series-${stack.key}`}>
                  <animated.path d={(tweened.d as any) || ""} fill={color} />
                </g>
              );
            })
          }
        </Stack>
      </g>
    );
  }, [layers]);

  return (
    <svg width={width} height={height} style={{ opacity, marginTop }}>
      {stacks}
    </svg>
  );
}
