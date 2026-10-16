import * as React from 'react';
import { QuaternaryIndicator } from '../QuaternaryIndicator';
import { Props } from './TyresSurfaceTemperaturePanel.types';

export function TyresSurfaceTemperaturePanel(props: Props) {
  const { tyresSurfaceTemperature } = props;

  return (
    <QuaternaryIndicator
      unit={props.unit}
      values={[10,8,11,12]}
      minValue={70}
      maxValue={120}
    />
  );
}
