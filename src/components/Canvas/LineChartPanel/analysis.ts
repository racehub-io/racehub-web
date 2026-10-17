export interface AnalysisRow {
  sessionTime: number;
  lapId?: string;
  participantId?: string;
  lap_distance?: number;
  lap_time?: number;
  world_x?: number;
  world_z?: number;
  packetId?: number;
}

export type AnalysisAxis = "distance" | "time";
export interface Point { x: number; y: number }

export const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function lapRows(rows: AnalysisRow[], lap: { lapId: string; participantId: string }) {
  return rows.filter(row => row.lapId === lap.lapId && row.participantId === lap.participantId)
    .sort((left, right) => left.sessionTime - right.sessionTime);
}

export function axisValue(row: AnalysisRow, axis: AnalysisAxis) {
  const value = axis === "distance" ? row.lap_distance : row.lap_time;
  return finite(value) ? value / (axis === "time" ? 1000 : 1) : undefined;
}

export function channelValue(row: AnalysisRow, parameter: string) {
  const value = (row as unknown as Record<string, unknown>)[parameter];
  return finite(value) ? value : undefined;
}

export function channelRows(rows: AnalysisRow[], parameter: string) {
  const families = new Set(rows.filter(row => channelValue(row, parameter) !== undefined && finite(row.packetId)).map(row => row.packetId));
  return families.size ? rows.filter(row => !finite(row.packetId) || families.has(row.packetId)) : rows;
}

export function recordedChannels(rows: AnalysisRow[]) {
  const metadata = new Set(["carIndex", "playerCarIndex", "sessionTime", "session_time", "timestamp", "frameId", "frameID", "gameYear", "format", "version"]);
  const channels = new Set<string>();
  rows.forEach(row => Object.entries(row).forEach(([key, value]) => {
    if (finite(value) && !metadata.has(key) && !/(?:^|_)(?:id|uid|index|idx)$|(?:ID|UID|Id|Index|Idx)$/.test(key)) channels.add(key);
  }));
  return Array.from(channels).sort();
}

export function channelSegments(rows: AnalysisRow[], axis: AnalysisAxis, parameter: string) {
  const segments: Point[][] = [];
  let segment: Point[] = [];
  channelRows(rows, parameter).forEach(row => {
    const x = axisValue(row, axis);
    const y = channelValue(row, parameter);
    if (x === undefined || y === undefined || (segment.length && x < segment[segment.length - 1].x)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (x !== undefined && y !== undefined) segment.push({ x, y });
  });
  if (segment.length) segments.push(segment);
  return segments;
}

export function samplePoints(points: Point[], limit = 1200) {
  if (points.length <= limit) return points;
  const result = [points[0]];
  const buckets = Math.max(1, Math.floor((limit - 2) / 2));
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = 1 + Math.floor(bucket * (points.length - 2) / buckets);
    const end = 1 + Math.floor((bucket + 1) * (points.length - 2) / buckets);
    let low = start;
    let high = start;
    for (let index = start + 1; index < end; index++) {
      if (points[index].y < points[low].y) low = index;
      if (points[index].y > points[high].y) high = index;
    }
    [low, high].sort((left, right) => left - right).forEach(index => {
      if (result[result.length - 1] !== points[index]) result.push(points[index]);
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

export function numericExtent(values: number[]): [number, number] | undefined {
  let low = Infinity;
  let high = -Infinity;
  values.forEach(value => {
    if (finite(value)) { low = Math.min(low, value); high = Math.max(high, value); }
  });
  return low <= high ? [low, high] : undefined;
}

function distanceSegments(rows: AnalysisRow[]) {
  const segments: Point[][] = [];
  let segment: Point[] = [];
  rows.forEach(row => {
    const x = row.lap_distance;
    const y = finite(row.lap_time) ? row.lap_time / 1000 : undefined;
    if (!finite(x) || x < 0 || y === undefined || y < 0) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    const previous = segment[segment.length - 1];
    if (previous && x === previous.x) return;
    if (previous && (x < previous.x || y < previous.y)) {
      segments.push(segment);
      segment = [];
    }
    segment.push({ x, y });
  });
  if (segment.length) segments.push(segment);
  return segments.filter(points => points.length > 1);
}

function interpolate(segments: Point[][], x: number) {
  const matches = segments.filter(points => x >= points[0].x && x <= points[points.length - 1].x);
  if (matches.length !== 1) return undefined;
  const points = matches[0];
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].x <= x) low = middle; else high = middle;
  }
  const fraction = (x - points[low].x) / (points[high].x - points[low].x);
  return points[low].y + fraction * (points[high].y - points[low].y);
}

export function deltaSegments(rows: AnalysisRow[], reference: AnalysisRow[], axis: AnalysisAxis) {
  const current = distanceSegments(rows);
  const baseline = distanceSegments(reference);
  const result: Point[][] = [];
  current.forEach(points => baseline.forEach(base => {
    const start = Math.max(points[0].x, base[0].x);
    const end = Math.min(points[points.length - 1].x, base[base.length - 1].x);
    if (start >= end) return;
    const distances = Array.from(new Set([...points, ...base].map(point => point.x)
      .filter(x => x >= start && x <= end))).sort((left, right) => left - right);
    let segment: Point[] = [];
    distances.forEach(distance => {
      const time = interpolate(current, distance);
      const referenceTime = interpolate(baseline, distance);
      if (time === undefined || referenceTime === undefined) {
        if (segment.length) result.push(segment);
        segment = [];
      } else {
        segment.push({ x: axis === "distance" ? distance : referenceTime, y: time - referenceTime });
      }
    });
    if (segment.length) result.push(segment);
  }));
  return result;
}

export function nearestPoint(points: Point[], x: number) {
  if (!points.length || x < points[0].x || x > points[points.length - 1].x) return undefined;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].x <= x) low = middle; else high = middle;
  }
  return Math.abs(points[low].x - x) <= Math.abs(points[high].x - x) ? points[low] : points[high];
}
