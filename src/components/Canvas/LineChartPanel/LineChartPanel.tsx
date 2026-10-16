import React from "react";
import classnames from "classnames";
import { extent } from "d3-array";
import { Line } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisBottom, AxisScale, AxisScaleOutput } from "@visx/axis";
import { ContinuousDomain, DefaultOutput, scaleLinear } from "@visx/scale";
import { localPoint } from "@visx/event";
import { ParentSize } from "@visx/responsive";
import { defaultStyles, TooltipWithBounds } from "@visx/tooltip";
import { FiActivity } from "react-icons/fi";
import {
  getX,
  BRUSH_HEIGHT,
  CHART_HEIGHT,
  tickLabelProps,
  bisectLapDistance,
} from "./config";

import { TRIGGER_TOOLTIP } from "../../../modules/race/actions";
import {
  SelectedLaps,
  SelectedLapsColors,
  useDispatch,
  useStore,
} from "../../../modules/context";
import { Props } from "./LineChartPanel.types";
import styles from "./LineChartPanel.module.scss";
import { LineChart } from "./LineChart";
import { BrushChart } from "./LineChart/BrushChart";
import { TelemetryData } from "../../../modules/race/types";

interface DeltaTimes {
  [lapId: string]: DeltaTime;
}

interface DataPoint {
  x: number;
  y: number;
}

interface DeltaTime {
  lapId: string;
  tDiffx: Array<number>;
  interpolatedTimes: Array<number>;
  deltaTime: Array<DataPoint>;
  isPrimaryLap: boolean;
}

function linspace(startValue: number, stopValue: number, cardinality: number) {
  var arr = [];
  var step = (stopValue - startValue) / (cardinality - 1);
  for (var i = 0; i < cardinality; i++) {
    arr.push(startValue + (step * i)) as number;
  }
  return arr;
}

export function LineChartPanel(props: Props) {
  const { dispatch } = useDispatch();
  const { store } = useStore();
  const {
    selectedLaps,
    selectedLapsColors,
    domain,
    primaryLapId,
    tooltipCoordinate,
  } = store;
  const { laps } = props;

  // if it has a domain set up, then filter the charts, otherwise render lapsData
  let filteredLapsData: { [lapId: string]: TelemetryData[] } = {};
  let xScaleOfFirstLap: AxisScale<AxisScaleOutput>;

  Object.keys(selectedLaps).forEach((lapId: string) => {
    const lap = selectedLaps[lapId];

    const startIndex = laps.findIndex((l) => l.sessionTime === lap.startTime);
    const endIndex = laps.findIndex((l) => l.sessionTime === lap.endTime);

    let lapData = laps.slice(startIndex, endIndex);
    if (domain && !props.brush) {
      const getY = (d: TelemetryData): number =>
        d[props.parameter as keyof TelemetryData] as number;

      lapData = lapData.filter((telemetryData: TelemetryData) => {
        const x = getX(telemetryData);
        const y = getY(telemetryData);
        return x > domain.x0 && x < domain.x1 && y > domain.y0 && y < domain.y1;
      });
    }

    filteredLapsData = {
      ...filteredLapsData,
      [lapId]: lapData,
    };

    xScaleOfFirstLap = scaleLinear({
      domain: extent(
        filteredLapsData[lapId],
        (datum: TelemetryData) => datum.lap_distance
      ) as ContinuousDomain,
    });
  });

  const handleTooltip = (
    event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>,
    xScale: any
  ) => {
    let { x } = localPoint(event) || { x: 0 };
    x -= 50;

    const invertedX = xScale.invert(x);

    dispatch({ type: TRIGGER_TOOLTIP, coordinate: invertedX });
  };

  const hideTooltip = () => {
    dispatch({ type: TRIGGER_TOOLTIP, coordinate: undefined });
  };

  if (!primaryLapId) {
    return <div />;
  }

  const maxLapDistances = Object.keys(selectedLaps).map((lapId: string) => {
    const lapData = filteredLapsData[lapId];
    const lapDistance = lapData.map(d => d.lap_distance);
    return Math.max(...lapDistance);
  });

  const maxLapDistance = Math.max(...maxLapDistances);
  const tDiffx: Array<number> = linspace(0,maxLapDistance,1000);

  const deltaTimes: DeltaTimes = {};

  Object.keys(selectedLaps).forEach((lapId: string) => {
    const isPrimaryLap = lapId === primaryLapId;

    const lapData = filteredLapsData[lapId];
    const lapDistance = lapData.map(d => d.lap_distance);
    const lapTime = lapData.map(d => d.lap_time);
    const scalar = maxLapDistance / Math.max(...lapDistance);
    const scaledLapDistance = lapDistance.map(d => d * scalar);
    const interpolator = scaleLinear().domain(scaledLapDistance).range(lapTime);
    const interpolatedTimes = tDiffx.map((d) => interpolator(d) as number);
    deltaTimes[lapId] = {
      lapId,
      tDiffx,
      interpolatedTimes,
      isPrimaryLap,
      deltaTime: [],
    }
  });

  const baseline = deltaTimes[primaryLapId].interpolatedTimes;

  Object.keys(deltaTimes).forEach((lapId: string) => {
    const { tDiffx, interpolatedTimes } = deltaTimes[lapId];
    const deltaTime = interpolatedTimes.map((t,i) => ({x: tDiffx[i], y: t - baseline[i]}));
    deltaTimes[lapId].deltaTime = deltaTime;
  });

  // get min value of all delta times
  const minDeltaTimes = Object.keys(deltaTimes).map((lapId: string) => {
    const { deltaTime } = deltaTimes[lapId];
    const dts = deltaTime.map(d => d.y);
    return Math.min(...dts);
  });

  const minDeltaTime = Math.min(...minDeltaTimes);

  // get max value of all delta times
  const maxDeltaTimes = Object.keys(deltaTimes).map((lapId: string) => {
    const { deltaTime } = deltaTimes[lapId];
    const dts = deltaTime.map(d => d.y);
    return Math.max(...dts);
  });

  const maxDeltaTime = Math.max(...maxDeltaTimes);

  return (
    <ParentSize>
      {(parent) => {
        const tooltip =
          tooltipCoordinate &&
          generateTooltip(
            props.parameter,
            selectedLaps,
            filteredLapsData,
            tooltipCoordinate,
            parent,
            primaryLapId
          );

        return (
          <>
            {(!selectedLaps || Object.keys(selectedLaps).length === 0) && (
              <div
                className={classnames(
                  styles.loadLapMessage,
                  props.brush && styles.brushLapMessage
                )}
              >
                <FiActivity className={styles.icon} />
                Select a lap to graph telemetry
              </div>
            )}
            <svg
              id="lineChartWrapper"
              width={parent.width}
              height={"100%"}
              className={styles.lineChartWrapper}
            >
              {/* Renders charts for each lap */}
              {Object.keys(selectedLaps).map((lapId: string, index: number) => {
                return props.brush ? (
                  <BrushChart
                    key={`brush-chart-${lapId}`}
                    color={selectedLapsColors[lapId]}
                    records={filteredLapsData[lapId]}
                    scaleRecords={filteredLapsData[primaryLapId]}
                    deltaTimes={deltaTimes[lapId]}
                    deltaTimeRange={[minDeltaTime, maxDeltaTime]}
                    parent={parent}
                    parameter={props.parameter}
                    index={index}
                    lapId={lapId}
                    tooltip={tooltip}
                  />
                ) : (
                  <LineChart
                    key={`line-chart-${lapId}`}
                    index={index}
                    filteredRecords={filteredLapsData[lapId]}
                    scaleRecords={filteredLapsData[primaryLapId]}
                    color={selectedLapsColors[lapId]}
                    parent={parent}
                    handleTooltip={handleTooltip}
                    hideTooltip={hideTooltip}
                    parameter={props.parameter}
                    lapId={lapId}
                    tooltip={tooltip}
                  />
                );
              })}
              {/* Renders lower axis */}
              {xScaleOfFirstLap?.range([0, parent.width - 50]) && (
                <Group left={50} key={"axis-bottom"}>
                  <AxisBottom
                    top={CHART_HEIGHT - 5}
                    hideAxisLine={true}
                    tickLabelProps={tickLabelProps}
                    scale={xScaleOfFirstLap}
                    tickFormat={(v: any) => `${v}m`}
                  />
                </Group>
              )}

              {tooltip && !props.brush && (
                <Line
                  from={{
                    x: tooltip.tooltipLeft + 50,
                    y: BRUSH_HEIGHT + 30,
                  }}
                  to={{
                    x: tooltip.tooltipLeft + 50,
                    y: -25,
                  }}
                  stroke={"rgba(255,255,255,0.3)"}
                  strokeWidth={2}
                  pointerEvents="none"
                  strokeDasharray="5,2"
                />
              )}
            </svg>
            {tooltip &&
              !props.brush &&
              renderTooltip(
                selectedLaps,
                selectedLapsColors,
                tooltip,
                primaryLapId
              )}
          </>
        );
      }}
    </ParentSize>
  );
}

const renderTooltip = (
  selectedLaps: SelectedLaps,
  selectedLapsColors: SelectedLapsColors,
  tooltip: any,
  primaryLapId: string
) => {
  return (
    <TooltipWithBounds
      top={tooltip.relativeTop + tooltip.tooltipTop[primaryLapId] - 15}
      left={tooltip.tooltipLeft - 55}
      style={{
        ...defaultStyles,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(255,255,255,0.85)",
      }}
    >
      <>
        <span>{tooltip.lapDistance.toFixed(1)}m</span>
        {Object.keys(selectedLaps).map((lapId: string) => (
          <div key={`tooltip-${lapId}`} className={styles.tooltipDataWrapper}>
            <div
              style={{
                backgroundColor: selectedLapsColors[lapId],
              }}
              className={styles.tooltipDataColor}
            />
            <span key={`tooltip-data-${lapId}`}>
              {tooltip.tooltipData[lapId].toFixed(3)}
            </span>
          </div>
        ))}
      </>
    </TooltipWithBounds>
  );
};

const generateTooltip = (
  parameter: any,
  selectedLaps: any,
  filteredLapsData: any,
  invertedX: any,
  parent: any,
  primaryLapId: string
) => {
  const xBrushMax = Math.max(parent.width, 0);

  const xScale = scaleLinear<number>({
    range: [0, xBrushMax],
    domain: extent(filteredLapsData[primaryLapId], getX) as any,
  });

  const rowHeight = (CHART_HEIGHT * 90) / 100;
  const getY = (d: any) => d[parameter];
  const yScale = scaleLinear({
    domain: extent(filteredLapsData[primaryLapId], getY) as any,
    nice: true,
  });
  yScale.range([rowHeight, 0]);

  const tooltipData: any = {};
  const tooltipTop: any = {};

  Object.keys(selectedLaps).forEach((lapId: string) => {
    const selectedLap = filteredLapsData[lapId];
    const index = bisectLapDistance(selectedLap, invertedX, 1);

    const d0 = selectedLap[index - 1];
    const d1 = selectedLap[index];

    let data = d0;

    if (d1 && d1.lapDistance) {
      data =
        invertedX.valueOf() - d0.lapDistance >
        d1.lapDistance - invertedX.lapDistance
          ? d1
          : d0;
    }

    if (!data) {
      return;
    }

    if (!tooltipData[lapId]) {
      tooltipData[lapId] = {};
    }

    tooltipData[lapId] = data[parameter];
    tooltipTop[lapId] = yScale(data[parameter]);
  });

  const tooltipLeft = xScale(invertedX);

  return {
    tooltipData,
    tooltipLeft,
    tooltipTop: tooltipTop,
    relativeTop: 0,
    lapDistance: invertedX,
    parameter: parameter,
  };
};
