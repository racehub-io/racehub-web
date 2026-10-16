import React, { useState } from "react";
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import classnames from "classnames";

import { Props } from "./MapPanel.types";
import styles from "./MapPanel.module.scss";
import { useStore } from "../../../modules/context";

const INITIAL_ZOOM_LEVEL = 7;
// smaller is faster
const ZOOM_IN_SPEED = 0.85;
// bigger is faster
const ZOOM_OUT_SPEED = 1.15;
// bigger is faster
const PAN_SPEED = 20;

let timeoutIndex: any = 0;

// This is the wrapper for DataPanels, adds border, and generic controls
export function MapPanel(props: Props) {
  const {
    store: { domain, selectedLaps, tooltipCoordinate, selectedLapsColors },
  } = useStore();
  const { laps } = props;

  const [xPanning, setXPanning] = useState(0);
  const [yPanning, setYPanning] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM_LEVEL);

  const handleZoomIn = () => {
    setZoomLevel((prevZoomLevel) => prevZoomLevel * ZOOM_IN_SPEED);
  };

  const handleZoomOut = () => {
    setZoomLevel((prevZoomLevel) => prevZoomLevel * ZOOM_OUT_SPEED);
  };

  const repeat = (callback: any) => {
    callback();
    // TODO: use rAF instead
    timeoutIndex = setTimeout(() => repeat(callback), 100);
  };

  const handleMouseUp = () => {
    clearTimeout(timeoutIndex);
  };

  const handleYPanUp = () => {
    setYPanning((prevYPan) => prevYPan - PAN_SPEED * zoomLevel);
  };

  const handleYPanDown = () => {
    setYPanning((prevYPan) => prevYPan + PAN_SPEED * zoomLevel);
  };

  const handleXPanLeft = () => {
    setXPanning((prevXPan) => prevXPan + PAN_SPEED * zoomLevel);
  };

  const handleXPanRight = () => {
    setXPanning((prevXPan) => prevXPan - PAN_SPEED * zoomLevel);
  };

  const renderPoints = () => {
    // TODO: this will not refresh when resizing the 'react-grid-layout' view, fix that
    const mapPanel = document.getElementById("mapPanelWrapper");
    const mapPanelWidth = mapPanel && mapPanel.offsetWidth;
    const mapPanelHeight = mapPanel && mapPanel.offsetHeight;

    const ceilZoomLevel = Math.ceil(zoomLevel);
    const absoluteZoomLevel = Math.abs(zoomLevel);

    let points: any = [];

    Object.keys(selectedLaps).forEach((lapId: string) => {
      const lap = selectedLaps[lapId];

      const startIndex = laps.findIndex((l) => l.sessionTime === lap.startTime);
      const endIndex = laps.findIndex((l) => l.sessionTime === lap.endTime);

      const pointsArray = laps.slice(startIndex, endIndex);

      const pointsElements = pointsArray.map(
        (racerLapPoint: any, index: number) => {
          const isSelected =
            domain?.x0 <= racerLapPoint.lap_distance &&
            racerLapPoint.lap_distance <= domain?.x1;
          const yPosition =
            (racerLapPoint.world_x + yPanning) / absoluteZoomLevel;
          const xPosition =
            (racerLapPoint.world_z + xPanning) / -absoluteZoomLevel;
          let shouldRender = true;
          /* optimizer based on map size */
          if (
            (mapPanelWidth && Math.abs(xPosition) > mapPanelWidth / 2) ||
            (mapPanelHeight && Math.abs(yPosition) > mapPanelHeight / 2)
          ) {
            shouldRender = false;
          }
          const pointColor =
            !domain || isSelected ? selectedLapsColors[lapId] : "#656E80";
          const isHighlighted =
            tooltipCoordinate &&
            Math.abs(tooltipCoordinate - racerLapPoint.lap_distance) < 1;
          return shouldRender ? (
            <div
              key={`map-point-${index}-${xPosition}-${yPosition}`}
              className={styles.mapPoint}
              style={{
                backgroundColor: pointColor,
                top: `calc(50% - ${yPosition}px)`,
                left: `calc(50% - ${xPosition}px)`,
                width: isHighlighted ? "10px" : "3px",
                height: isHighlighted ? "10px" : "3px",
              }}
            />
          ) : null;
        }
      );
      points.push(pointsElements);
    });

    return points;
  };

  return (
    <div id="mapPanelWrapper" className={styles.mapPanelWrapper}>
      {renderPoints()}
      <div className={styles.zoomWrapper}>
        <div
          className={classnames(styles.button, styles.zoomInButton)}
          onMouseDown={() => repeat(handleZoomIn)}
          onMouseUp={handleMouseUp}
        >
          <FiZoomIn className={styles.icon} />
        </div>
        <div
          className={classnames(styles.button, styles.zoomOutButton)}
          onMouseDown={() => repeat(handleZoomOut)}
          onMouseUp={handleMouseUp}
        >
          <FiZoomOut className={styles.icon} />
        </div>
      </div>
      <div className={styles.moveWrapper}>
        <div
          className={classnames(styles.button, styles.moveUpButton)}
          onMouseDown={() => repeat(handleYPanUp)}
          onMouseUp={handleMouseUp}
        >
          <FiArrowUp className={styles.icon} />
        </div>
        <div
          className={classnames(styles.button, styles.moveRightButton)}
          onMouseDown={() => repeat(handleXPanRight)}
          onMouseUp={handleMouseUp}
        >
          <FiArrowRight className={styles.icon} />
        </div>
        <div
          className={classnames(styles.button, styles.moveDownButton)}
          onMouseDown={() => repeat(handleYPanDown)}
          onMouseUp={handleMouseUp}
        >
          <FiArrowDown className={styles.icon} />
        </div>
        <div
          className={classnames(styles.button, styles.moveLeftButton)}
          onMouseDown={() => repeat(handleXPanLeft)}
          onMouseUp={handleMouseUp}
        >
          <FiArrowLeft className={styles.icon} />
        </div>
      </div>
    </div>
  );
}
