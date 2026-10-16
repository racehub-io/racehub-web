import React from "react";
import { extent, max } from "d3-array";
import { LinePath, Bar } from "@visx/shape";
import { Brush } from "@visx/brush";
import { curveBasis, curveLinear } from "@visx/curve";
import { Grid } from "@visx/grid";
import { Group } from "@visx/group";
import { AxisRight } from "@visx/axis";
import { Bounds } from "@visx/brush/lib/types";
import { scaleLinear } from "@visx/scale";

import { Props } from "./BrushChart.types";

import { AreaChart } from "./AreaChart";

import {
  tickLabelProps,
  getX,
  CHART_HEIGHT,
  CHART_WIDTH,
  BRUSH_HEIGHT,
  BRUSH_MARGIN,
} from "../config";

import { DOMAIN_SELECTION } from "../../../../modules/race/actions";

import { TelemetryData } from "../../../../modules/race/types";
import { useDispatch } from "../../../../modules/context";

interface DataPoint {
  x: number;
  y: number;
}

export function BrushChart(props: Props) {
  const { dispatch } = useDispatch();
  const { index, color, parent, scaleRecords, records, deltaTimes, deltaTimeRange, parameter, lapId, tooltip } = props;

  const { isPrimaryLap, deltaTime } = deltaTimes;

  // convert all values of deltaTimeRange to absolute values
  const deltaTimeRangeAbs = deltaTimeRange.map((d) => Math.abs(d));
  const deltaTimeRangeMax = max(deltaTimeRangeAbs) as number;
  const deltaTimeScaleRange = [-deltaTimeRangeMax/1e3, deltaTimeRangeMax/1e3];

  const getDeltaTimeX = (d: DataPoint) => d.x;
  const getDeltaTimeY = (d: DataPoint) => d.y/1e3;

  const getY = (d: any) => d[parameter];

  const rowHeight = (CHART_HEIGHT / 100) * 90;

  const selectedBrushStyle = {
    fill: '#387d7a',
    fillOpacity: 0.4,
    stroke: '#00d78f',
  };

  const onBrushChange = (domain: Bounds | null) => {
    if (!domain) return;
    dispatch({ type: DOMAIN_SELECTION, domain });
  };

  /* Graphic dimensions */

  /* X */
  const xScale = scaleLinear({
    domain: extent(scaleRecords, getX) as any,
  });
  xScale.range([0, CHART_WIDTH]);

  /* Y */

  const yScale = scaleLinear({
    domain: extent(scaleRecords, getY) as any,
    nice: true,
  });
  yScale.range([rowHeight, 0]);

  const yScaleDeltaTime = scaleLinear({
    domain: deltaTimeScaleRange,
    range: [rowHeight, 0]
  });

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

  const yBrushMax = Math.max(BRUSH_HEIGHT, 0);
  const yScaleRelativeToParent = scaleLinear({
    range: [yBrushMax, 0],
    domain: [0, (max(scaleRecords, getY) as any) || 0],
    nice: true,
  });

  const originLine: Array<DataPoint> = [{x: 0, y: 0}, {x: max(scaleRecords, getX) || 0, y: 0}]

  return (
    <Group key={`lines`} left={0} top={0}>
      <AxisRight
        scale={yScaleDeltaTime as any}
        tickLabelProps={tickLabelProps}
        left={xBrushMax-25}
        hideAxisLine={true}
      />
      {index === 0 && (
        <Grid
          yScale={yScaleDeltaTime as any}
          xScale={xScaleRelativeToParent}
          width={parent.width}
          height={rowHeight}
          stroke={"#0f1424"}
          strokeOpacity={0.5}
        />
      )}
      <LinePath
        style={{ pointerEvents: "none" }}
        data={records}
        curve={curveBasis}
        x={(d: TelemetryData) => xScaleRelativeToParent(getX(d))}
        y={(d) => yScale(getY(d)) as any}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.8}
        // enable for area: fill={'rgba(0, 215, 143, 0.1)'}
      />
      {!isPrimaryLap && (
        <LinePath
          style={{ pointerEvents: "none" }}
          data={deltaTime}
          curve={curveBasis}
          x={(d: DataPoint) => xScaleRelativeToParent(getDeltaTimeX(d))}
          y={(d: DataPoint) => yScaleDeltaTime(getDeltaTimeY(d)) as any}
          stroke={color}
          strokeWidth={3}
          strokeOpacity={1}
          // enable for area: fill={'rgba(0, 215, 143, 0.1)'}
        />
      )}
      {isPrimaryLap && (
        <LinePath
          data={originLine}
          curve={curveLinear}
          x={(d: DataPoint) => xScaleRelativeToParent(getDeltaTimeX(d))}
          y={(d: DataPoint) => yScaleDeltaTime(getDeltaTimeY(d)) as any}
          stroke={"#ffffff"}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}
      {index === 0 && (
        <AreaChart
          hideBottomAxis
          hideLeftAxis
          data={records}
          width={parent.width}
          yMax={yBrushMax}
          xScale={xScaleRelativeToParent}
          yScale={yScaleRelativeToParent}
          margin={BRUSH_MARGIN}
          gradientColor={"#af8baf"}
        >
          <Brush
            xScale={xScaleRelativeToParent}
            yScale={yScaleRelativeToParent}
            width={xBrushMax}
            height={yBrushMax}
            margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
            handleSize={8}
            resizeTriggerAreas={["left", "right"]}
            brushDirection="horizontal"
            onChange={onBrushChange}
            selectedBoxStyle={selectedBrushStyle}
          />
        </AreaChart>
      )}
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
