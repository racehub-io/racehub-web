export interface Props {
  title?: string;
  unit?: string;
  tyresSurfaceTemperature: any;
}

export type MapStateProps = Pick<
    Props, 'tyresSurfaceTemperature'
>;