import React from "react";
import { extent } from "d3-array";
import { LinePath, Bar } from "@visx/shape";
import { curveBasis } from "@visx/curve";
import { Grid } from "@visx/grid";
import { Group } from "@visx/group";
import { AxisLeft } from "@visx/axis";
import { scaleLinear } from "@visx/scale";

import { Props } from "./LineChart.types";

import {
  getX,
  CHART_HEIGHT,
  CHART_WIDTH,
  BRUSH_MARGIN,
  tickLabelProps,
} from "../config";
import { TelemetryData } from "../../../../modules/race/types";

export function LineChart(props: Props) {
  const {
    index,
    filteredRecords,
    color,
    handleTooltip,
    parent,
    tooltip,
    hideTooltip,
    parameter,
    scaleRecords,
    lapId,
  } = props;

  const getY = (d: any) => d[parameter];

  const rowHeight = (CHART_HEIGHT / 100) * 90;

  /* Graphic dimensions */

  /* X */

  const xScale = scaleLinear({
    domain: extent(scaleRecords, getX) as any,
  });
  xScale.range([0, CHART_WIDTH - 50]);

  /* Y */

  const yScale = scaleLinear({
    domain: extent(scaleRecords, getY) as any,
    nice: true,
  });
  yScale.range([rowHeight, 0]);

  /* Brush dimensions */

  /* X */

  const xBrushMax = Math.max(
    parent.width - BRUSH_MARGIN.left - BRUSH_MARGIN.right,
    0
  );
  const xScaleRelativeToParent = scaleLinear<number>({
    range: [0, xBrushMax],
    domain: extent(scaleRecords, getX) as any,
  });

  /* Y */

  const handleTouch = (e: any) => handleTooltip(e, xScaleRelativeToParent);

  return (
    <Group key={`lines-${index}`} left={50} top={10}>
      <AxisLeft
        scale={yScale as any}
        tickLabelProps={tickLabelProps}
        left={-15}
        hideAxisLine={true}
      />
      {index === 0 && (
        <Grid
          yScale={yScale as any}
          xScale={xScaleRelativeToParent}
          width={parent.width}
          height={rowHeight}
          stroke={"#0f1424"}
        />
      )}
      <LinePath
        style={{ pointerEvents: "none" }}
        data={filteredRecords}
        curve={curveBasis}
        x={(d: TelemetryData) => xScaleRelativeToParent(getX(d))}
        y={(d) => yScale(getY(d)) as any}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={1}
        // enable for area: fill={'rgba(0, 215, 143, 0.1)'}
      />
      <Bar
        x={0}
        y={0}
        width={parent.width}
        height={rowHeight}
        fill="transparent"
        rx={14}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onMouseMove={handleTouch}
        onMouseLeave={hideTooltip}
      />

      {tooltip && (
        <circle
          cx={tooltip.tooltipLeft}
          cy={tooltip.tooltipTop[lapId]}
          r={4}
          fill={color}
          stroke="white"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
    </Group>
  );
}
