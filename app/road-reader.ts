export type Outcome = "B" | "P" | "T";
export type SignalColor = "R" | "U" | "G";
export type RoadMode = "ask-road" | "road-board";
export type RoadRegion = { x: number; y: number; width: number; height: number };

export type RoadSnapshot = {
  outcomes: Outcome[];
  beadPlate: Outcome[];
  bigRoadOutcomes: Outcome[];
  askBanker: SignalColor[];
  askPlayer: SignalColor[];
  bigEyeRoad: SignalColor[];
  smallRoad: SignalColor[];
  cockroachRoad: SignalColor[];
  derived: SignalColor[];
  markerCount: number;
  confidence: number;
  mode: RoadMode;
  signature: string;
  region: RoadRegion | null;
};

export function isCompositeRoadSnapshot(snapshot: RoadSnapshot) {
  const visibleDerivedRoads = [snapshot.bigEyeRoad, snapshot.smallRoad, snapshot.cockroachRoad]
    .filter((road) => road.length >= 2).length;
  return snapshot.mode === "road-board"
    && snapshot.outcomes.length >= 6
    && snapshot.derived.length >= 6
    && visibleDerivedRoads === 3;
}

type Marker = { x: number; y: number; size: number; width: number; height: number; fill: number; red: number; blue: number; green: number; light: number; pixels: number };
type Component = Marker;
type RoadGroup = {
  markers: Marker[];
  markerSize: number;
  rows: number;
  columns: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  score: number;
  light: number;
  segmented: boolean;
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function coordinateBins(values: number[], tolerance: number) {
  const sorted = [...values].sort((left, right) => left - right);
  const bins: number[] = [];
  for (const value of sorted) {
    const last = bins.at(-1);
    if (last === undefined || value - last > tolerance) bins.push(value);
    else bins[bins.length - 1] = (last + value) / 2;
  }
  return bins.length;
}

function pixelKind(red: number, green: number, blue: number) {
  if (red > 145 && red > green * 1.27 && red > blue * 1.12) return 1;
  if (blue > 120 && blue > red * 1.13 && blue > green * 1.02) return 2;
  if (green > 100 && green > red * 1.1 && green > blue * 1.01) return 3;
  return 0;
}

export function findLightPanelRegions(data: Uint8ClampedArray, width: number, height: number) {
  const step = Math.max(1, Math.ceil(Math.min(width, height) / 420));
  const gridWidth = Math.ceil(width / step);
  const gridHeight = Math.ceil(height / step);
  const mask = new Uint8Array(gridWidth * gridHeight);
  for (let gridY = 0; gridY < gridHeight; gridY += 1) {
    const y = Math.min(height - 1, gridY * step);
    for (let gridX = 0; gridX < gridWidth; gridX += 1) {
      const x = Math.min(width - 1, gridX * step);
      const offset = (y * width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      mask[gridY * gridWidth + gridX] = Number(Math.min(red, green, blue) > 172 && Math.max(red, green, blue) - Math.min(red, green, blue) < 58);
    }
  }

  const stack = new Int32Array(mask.length);
  const regions: Array<RoadRegion & { area: number }> = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start]) continue;
    let stackLength = 0;
    stack[stackLength++] = start;
    let minX = gridWidth;
    let maxX = 0;
    let minY = gridHeight;
    let maxY = 0;
    let pixels = 0;
    while (stackLength) {
      const index = stack[--stackLength];
      if (!mask[index]) continue;
      mask[index] = 0;
      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      pixels += 1;
      if (x > 0 && mask[index - 1]) stack[stackLength++] = index - 1;
      if (x + 1 < gridWidth && mask[index + 1]) stack[stackLength++] = index + 1;
      if (y > 0 && mask[index - gridWidth]) stack[stackLength++] = index - gridWidth;
      if (y + 1 < gridHeight && mask[index + gridWidth]) stack[stackLength++] = index + gridWidth;
    }
    const panelWidth = (maxX - minX + 1) * step;
    const panelHeight = (maxY - minY + 1) * step;
    const aspect = panelWidth / Math.max(1, panelHeight);
    const fill = pixels / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
    if (panelWidth < 58 || panelHeight < 34 || aspect < 1.25 || aspect > 4.8 || fill < 0.3) continue;
    if (panelWidth > width * 0.55 || panelHeight > height * 0.7) continue;
    const padding = 4 * step;
    const left = Math.max(0, minX * step - padding);
    const top = Math.max(0, minY * step - padding);
    const right = Math.min(width, (maxX + 1) * step + padding);
    const bottom = Math.min(height, (maxY + 1) * step + padding);
    regions.push({ x: left / width, y: top / height, width: (right - left) / width, height: (bottom - top) / height, area: panelWidth * panelHeight });
  }
  return regions.sort((left, right) => right.area - left.area).slice(0, 18).map((region) => ({ x: region.x, y: region.y, width: region.width, height: region.height }));
}

function findComponents(data: Uint8ClampedArray, width: number, height: number, step: number) {
  const maxComponentSize = Math.max(48, Math.min(width, height) * 0.085);
  const gridWidth = Math.ceil(width / step);
  const gridHeight = Math.ceil(height / step);
  const mask = new Uint8Array(gridWidth * gridHeight);
  for (let gridY = 0; gridY < gridHeight; gridY += 1) {
    const y = Math.min(height - 1, gridY * step);
    for (let gridX = 0; gridX < gridWidth; gridX += 1) {
      const x = Math.min(width - 1, gridX * step);
      const offset = (y * width + x) * 4;
      mask[gridY * gridWidth + gridX] = pixelKind(data[offset], data[offset + 1], data[offset + 2]);
    }
  }

  const stack = new Int32Array(mask.length);
  const components: Component[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start]) continue;
    let stackLength = 0;
    stack[stackLength++] = start;
    let minX = gridWidth;
    let maxX = 0;
    let minY = gridHeight;
    let maxY = 0;
    let red = 0;
    let blue = 0;
    let green = 0;
    let pixels = 0;

    while (stackLength) {
      const index = stack[--stackLength];
      const kind = mask[index];
      if (!kind) continue;
      mask[index] = 0;
      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      pixels += 1;
      if (kind === 1) red += 1;
      if (kind === 2) blue += 1;
      if (kind === 3) green += 1;
      if (x > 0 && mask[index - 1]) stack[stackLength++] = index - 1;
      if (x + 1 < gridWidth && mask[index + 1]) stack[stackLength++] = index + 1;
      if (y > 0 && mask[index - gridWidth]) stack[stackLength++] = index - gridWidth;
      if (y + 1 < gridHeight && mask[index + gridWidth]) stack[stackLength++] = index + gridWidth;
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const aspect = componentWidth / componentHeight;
    const size = Math.max(componentWidth, componentHeight);
    // Long labels, chips and page decorations are excluded. Only compact road marks remain.
    if (pixels < 3 || componentWidth < 2 || componentHeight < 2 || size > maxComponentSize || aspect < 0.22 || aspect > 4.8) continue;
    const sampleLight = (sourceX: number, sourceY: number) => {
      const x = Math.max(0, Math.min(width - 1, Math.round(sourceX * step)));
      const y = Math.max(0, Math.min(height - 1, Math.round(sourceY * step)));
      const offset = (y * width + x) * 4;
      const redValue = data[offset];
      const greenValue = data[offset + 1];
      const blueValue = data[offset + 2];
      return Number(Math.min(redValue, greenValue, blueValue) > 178 && Math.max(redValue, greenValue, blueValue) - Math.min(redValue, greenValue, blueValue) < 52);
    };
    const padding = 2;
    const light = [
      sampleLight(minX - padding, minY - padding),
      sampleLight(maxX + padding, minY - padding),
      sampleLight(minX - padding, maxY + padding),
      sampleLight(maxX + padding, maxY + padding),
      sampleLight((minX + maxX) / 2, minY - padding),
      sampleLight((minX + maxX) / 2, maxY + padding),
      sampleLight(minX - padding, (minY + maxY) / 2),
      sampleLight(maxX + padding, (minY + maxY) / 2),
    ].reduce((sum, value) => sum + value, 0) / 8;
    components.push({
      x: ((minX + maxX) / 2) * step,
      y: ((minY + maxY) / 2) * step,
      size: size * step,
      width: componentWidth * step,
      height: componentHeight * step,
      fill: pixels / Math.max(1, componentWidth * componentHeight),
      red,
      blue,
      green,
      pixels,
      light,
    });
  }
  return components;
}

function mergeNearbyMarkers(components: Component[]) {
  const markers: Marker[] = [];
  for (const component of [...components].sort((left, right) => right.size - left.size)) {
    const existing = markers.find((marker) => Math.hypot(marker.x - component.x, marker.y - component.y) < Math.max(marker.size, component.size) * 0.56);
    if (!existing) {
      markers.push({ ...component });
      continue;
    }
    const previousWeight = existing.red + existing.blue + existing.green;
    const total = previousWeight + component.pixels;
    existing.x = ((existing.x * previousWeight) + (component.x * component.pixels)) / total;
    existing.y = ((existing.y * previousWeight) + (component.y * component.pixels)) / total;
    existing.size = Math.max(existing.size, component.size);
    existing.width = Math.max(existing.width, component.width);
    existing.height = Math.max(existing.height, component.height);
    existing.fill = ((existing.fill * previousWeight) + (component.fill * component.pixels)) / total;
    existing.red += component.red;
    existing.blue += component.blue;
    existing.green += component.green;
    existing.pixels += component.pixels;
    existing.light = ((existing.light * previousWeight) + (component.light * component.pixels)) / total;
  }
  return markers;
}

function collapseSegmentedCircle(components: Component[]) {
  if (!components.length || components.length > 12) return null;
  const useful = components.filter((component) => component.light >= 0.4);
  if (!useful.length) return null;
  const colors = useful.map(colorFromMarker);
  const dominant = colors.sort((left, right) => colors.filter((color) => color === right).length - colors.filter((color) => color === left).length)[0];
  if (colors.filter((color) => color === dominant).length / colors.length < 0.8) return null;
  const left = Math.min(...useful.map((component) => component.x - component.width / 2));
  const right = Math.max(...useful.map((component) => component.x + component.width / 2));
  const top = Math.min(...useful.map((component) => component.y - component.height / 2));
  const bottom = Math.max(...useful.map((component) => component.y + component.height / 2));
  const width = right - left;
  const height = bottom - top;
  const size = Math.max(width, height);
  const aspect = width / Math.max(1, height);
  const coloredPixels = useful.reduce((sum, component) => sum + component.pixels, 0);
  if (size < 9 || size > 90 || aspect < 0.58 || aspect > 1.72 || coloredPixels / Math.max(1, width * height) < 0.22) return null;
  const weight = useful.reduce((sum, component) => sum + component.pixels, 0);
  return {
    x: useful.reduce((sum, component) => sum + component.x * component.pixels, 0) / weight,
    y: useful.reduce((sum, component) => sum + component.y * component.pixels, 0) / weight,
    size,
    width,
    height,
    fill: coloredPixels / Math.max(1, width * height),
    red: useful.reduce((sum, component) => sum + component.red, 0),
    blue: useful.reduce((sum, component) => sum + component.blue, 0),
    green: useful.reduce((sum, component) => sum + component.green, 0),
    light: median(useful.map((component) => component.light)),
    pixels: coloredPixels,
  } satisfies Marker;
}

function componentGroups(components: Component[]) {
  const parents = components.map((_, index) => index);
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const unite = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  for (let left = 0; left < components.length; left += 1) {
    for (let right = left + 1; right < components.length; right += 1) {
      const a = components[left];
      const b = components[right];
      const averageSize = (a.size + b.size) / 2;
      const sizeRatio = Math.max(a.size, b.size) / Math.max(1, Math.min(a.size, b.size));
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      const overlap = Math.hypot(dx, dy) < Math.max(a.size, b.size) * 0.72;
      const rowNeighbor = sizeRatio < 2.8 && dy < averageSize * 0.9 && dx < averageSize * 3.8;
      const columnNeighbor = sizeRatio < 2.8 && dx < averageSize * 0.9 && dy < averageSize * 3.8;
      if (overlap || rowNeighbor || columnNeighbor) unite(left, right);
    }
  }

  const groups = new Map<number, Component[]>();
  components.forEach((component, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(component);
    groups.set(root, group);
  });
  return [...groups.values()];
}

function segmentedCircleGroups(components: Component[]) {
  const candidates = components.filter((component) => component.light >= 0.6 && component.size >= 3 && component.size <= 44);
  const parents = candidates.map((_, index) => index);
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const unite = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const a = candidates[left];
      const b = candidates[right];
      if (colorFromMarker(a) !== colorFromMarker(b)) continue;
      const reach = Math.max(16, Math.min(42, Math.max(a.size, b.size) * 3.2));
      if (Math.abs(a.x - b.x) <= reach && Math.abs(a.y - b.y) <= reach && Math.hypot(a.x - b.x, a.y - b.y) <= reach * 1.2) unite(left, right);
    }
  }
  const groups = new Map<number, Component[]>();
  candidates.forEach((component, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(component);
    groups.set(root, group);
  });
  return [...groups.values()];
}

function colorFromMarker(marker: Marker): SignalColor {
  const best = Math.max(marker.red, marker.blue, marker.green);
  return best === marker.red ? "R" : best === marker.blue ? "U" : "G";
}

function outcomeFromMarker(marker: Marker): Outcome {
  const color = colorFromMarker(marker);
  return color === "R" ? "B" : color === "U" ? "P" : "T";
}

function readingOrder(markers: Marker[]) {
  const markerSize = Math.max(3, median(markers.map((marker) => marker.size)));
  return [...markers].sort((left, right) => Math.abs(left.x - right.x) > markerSize * 0.7 ? left.x - right.x : left.y - right.y);
}

function splitVerticalBands(markers: Marker[]) {
  if (markers.length < 12) return [markers];
  const markerSize = Math.max(3, median(markers.map((marker) => marker.size)));
  const sorted = [...markers].sort((left, right) => left.y - right.y);
  const bands: Marker[][] = [[]];
  let previousY = sorted[0]?.y ?? 0;
  for (const marker of sorted) {
    if (bands.at(-1)?.length && marker.y - previousY > markerSize * 2.4) bands.push([]);
    bands[bands.length - 1].push(marker);
    previousY = marker.y;
  }
  return bands.filter((band) => band.length >= 6);
}

function buildRoadGroups(components: Component[]) {
  const groups: RoadGroup[] = [];
  const rawGroups = componentGroups(components);
  const addGroups = (sourceGroups: Component[][], segmented: boolean) => {
  for (const rawGroup of sourceGroups) {
    for (const markers of splitVerticalBands(mergeNearbyMarkers(rawGroup))) {
      const markerSize = Math.max(3, median(markers.map((marker) => marker.size)));
      const rows = coordinateBins(markers.map((marker) => marker.y), markerSize * 0.72);
      const columns = coordinateBins(markers.map((marker) => marker.x), markerSize * 0.72);
      if (rows > 12 || columns < 2 || columns > 80) continue;
      const minX = Math.min(...markers.map((marker) => marker.x));
      const maxX = Math.max(...markers.map((marker) => marker.x));
      const minY = Math.min(...markers.map((marker) => marker.y));
      const maxY = Math.max(...markers.map((marker) => marker.y));
      const density = markers.length / Math.max(1, rows * columns);
      const light = median(markers.map((marker) => marker.light));
      if (light < 0.4) continue;
      const gridScore = markers.length * 9 + Math.min(1, density) * 24 + markerSize - Math.max(0, rows - 7) * 12;
      groups.push({ markers, markerSize, rows, columns, minX, maxX, minY, maxY, score: gridScore, light, segmented });
    }
  }
  };
  addGroups(rawGroups, false);
  const collapsedCircles = segmentedCircleGroups(components).map(collapseSegmentedCircle).filter((marker): marker is Marker => Boolean(marker));
  if (collapsedCircles.length >= 6) addGroups(componentGroups(collapsedCircles), true);
  return groups.sort((left, right) => right.score - left.score);
}

function isAskRoad(group: RoadGroup) {
  const width = group.maxX - group.minX;
  const height = group.maxY - group.minY;
  return group.rows >= 5 && group.rows <= 8 && group.columns >= 2 && group.columns <= 7 && height > width * 0.85;
}

function splitStructuredMarkers(markers: Marker[]) {
  if (markers.length < 16) return null;
  const sortedSizes = markers.map((marker) => marker.size).sort((left, right) => left - right);
  let splitIndex = -1;
  let splitRatio = 1;
  for (let index = 5; index < sortedSizes.length - 6; index += 1) {
    const ratio = sortedSizes[index + 1] / Math.max(1, sortedSizes[index]);
    if (ratio > splitRatio) {
      splitRatio = ratio;
      splitIndex = index;
    }
  }
  if (splitIndex < 0 || splitRatio < 1.35) return null;
  const threshold = (sortedSizes[splitIndex] + sortedSizes[splitIndex + 1]) / 2;
  const mainMarkers = markers.filter((marker) => marker.size > threshold);
  let derivedMarkers = markers.filter((marker) => marker.size <= threshold);
  if (mainMarkers.length < 6 || derivedMarkers.length < 6) return null;

  const mainSize = Math.max(3, median(mainMarkers.map((marker) => marker.size)));
  const mainBottom = Math.max(...mainMarkers.map((marker) => marker.y));
  const lowerMarkers = derivedMarkers.filter((marker) => marker.y > mainBottom + mainSize * 0.2);
  if (lowerMarkers.length >= 6) derivedMarkers = lowerMarkers;
  const derivedSize = Math.max(3, median(derivedMarkers.map((marker) => marker.size)));
  const sortedDerived = [...derivedMarkers].sort((left, right) => left.y - right.y);
  const verticalBands: Marker[][] = [[]];
  let previousY = sortedDerived[0]?.y ?? 0;
  for (const marker of sortedDerived) {
    if (verticalBands.at(-1)?.length && marker.y - previousY > Math.max(12, derivedSize * 1.6)) verticalBands.push([]);
    verticalBands[verticalBands.length - 1].push(marker);
    previousY = marker.y;
  }
  const largestBand = verticalBands.sort((left, right) => right.length - left.length)[0];
  if (largestBand?.length >= 6) derivedMarkers = largestBand;
  const mainRows = coordinateBins(mainMarkers.map((marker) => marker.y), mainSize * 0.72);
  const mainColumns = coordinateBins(mainMarkers.map((marker) => marker.x), mainSize * 0.72);
  const mainCenterY = median(mainMarkers.map((marker) => marker.y));
  const derivedCenterY = median(derivedMarkers.map((marker) => marker.y));
  if (mainRows > 8 || mainColumns < 5 || derivedCenterY <= mainCenterY + mainSize * 0.7) return null;
  return { mainMarkers, derivedMarkers };
}

function classifyDerivedRoads(markers: Marker[], horizontalBounds?: { minX: number; maxX: number }) {
  const useful = markers.filter((marker) => colorFromMarker(marker) !== "G");
  const bigEye: Marker[] = [];
  const small: Marker[] = [];
  const cockroach: Marker[] = [];
  const markerSize = Math.max(3, median(useful.map((marker) => marker.size)));
  const usePanelThirds = horizontalBounds && horizontalBounds.maxX - horizontalBounds.minX >= markerSize * 18;
  const firstBoundary = usePanelThirds ? horizontalBounds.minX + (horizontalBounds.maxX - horizontalBounds.minX) / 3 : 0;
  const secondBoundary = usePanelThirds ? horizontalBounds.minX + ((horizontalBounds.maxX - horizontalBounds.minX) * 2) / 3 : 0;
  for (const marker of useful) {
    if (usePanelThirds) {
      if (marker.x < firstBoundary) bigEye.push(marker);
      else if (marker.x < secondBoundary) small.push(marker);
      else cockroach.push(marker);
      continue;
    }
    const aspect = Math.max(marker.width, marker.height) / Math.max(1, Math.min(marker.width, marker.height));
    if (aspect >= 1.45) cockroach.push(marker);
    else if (marker.fill >= 0.52) small.push(marker);
    else bigEye.push(marker);
  }
  return {
    bigEyeRoad: readingOrder(bigEye).map(colorFromMarker).slice(-96),
    smallRoad: readingOrder(small).map(colorFromMarker).slice(-96),
    cockroachRoad: readingOrder(cockroach).map(colorFromMarker).slice(-96),
  };
}

function emptySnapshot(): RoadSnapshot {
  return { outcomes: [], beadPlate: [], bigRoadOutcomes: [], askBanker: [], askPlayer: [], bigEyeRoad: [], smallRoad: [], cockroachRoad: [], derived: [], markerCount: 0, confidence: 0, mode: "road-board", signature: "", region: null };
}

function detectBeadPlate(data: Uint8ClampedArray, width: number, height: number, components: Component[]) {
  const collapsed = segmentedCircleGroups(components)
    .map(collapseSegmentedCircle)
    .filter((marker): marker is Marker => Boolean(marker))
    .filter((marker) => marker.x > width * 0.1 && marker.y < height * 0.88 && marker.light >= 0.6);
  if (collapsed.length < 6) return [] as Outcome[];
  const markerSize = Math.max(4, median(collapsed.map((marker) => marker.size)));
  const binCenters = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    const bins: number[][] = [];
    for (const value of sorted) {
      const bin = bins.at(-1);
      if (!bin || value - (bin.reduce((sum, item) => sum + item, 0) / bin.length) > markerSize * 0.65) bins.push([value]);
      else bin.push(value);
    }
    return bins.map((bin) => bin.reduce((sum, value) => sum + value, 0) / bin.length);
  };
  const stepFrom = (centers: number[]) => {
    const diffs = centers.slice(1).map((center, index) => center - centers[index])
      .filter((difference) => difference > markerSize * 1.35 && difference < Math.min(width, height) * 0.3)
      .sort((left, right) => left - right);
    return diffs.length ? median(diffs.slice(0, Math.max(1, Math.ceil(diffs.length * 0.7)))) : 0;
  };
  const xBins = binCenters(collapsed.map((marker) => marker.x));
  const yBins = binCenters(collapsed.map((marker) => marker.y));
  if (yBins.length < 5 || yBins.length > 7 || xBins.length < 3) return [] as Outcome[];
  const stepX = stepFrom(xBins);
  const stepY = stepFrom(yBins);
  if (!stepX || !stepY || stepX / stepY < 0.65 || stepX / stepY > 1.55) return [] as Outcome[];

  const sampleCell = (centerX: number, centerY: number) => {
    const radiusX = Math.max(3, Math.round(stepX * 0.36));
    const radiusY = Math.max(3, Math.round(stepY * 0.36));
    const totals = [0, 0, 0, 0];
    let pixels = 0;
    for (let y = Math.max(0, Math.round(centerY - radiusY)); y <= Math.min(height - 1, Math.round(centerY + radiusY)); y += 2) {
      for (let x = Math.max(0, Math.round(centerX - radiusX)); x <= Math.min(width - 1, Math.round(centerX + radiusX)); x += 2) {
        const offset = (y * width + x) * 4;
        totals[pixelKind(data[offset], data[offset + 1], data[offset + 2])] += 1;
        pixels += 1;
      }
    }
    const best = Math.max(totals[1], totals[2], totals[3]);
    if (best / Math.max(1, pixels) < 0.12) return null;
    return best === totals[1] ? "B" as const : best === totals[2] ? "P" as const : "T" as const;
  };

  let originX = Math.min(...xBins);
  let originY = Math.min(...yBins);
  while (originX - stepX >= 0) {
    const candidate = originX - stepX;
    const hits = Array.from({ length: 6 }, (_, row) => sampleCell(candidate, originY + row * stepY)).filter(Boolean).length;
    if (hits < 2) break;
    originX = candidate;
  }
  while (originY - stepY >= 0 && Array.from({ length: 5 }, (_, column) => sampleCell(originX + column * stepX, originY - stepY)).filter(Boolean).length >= 2) originY -= stepY;

  const outcomes: Outcome[] = [];
  let emptyColumns = 0;
  for (let column = 0; column < 32 && originX + column * stepX < width; column += 1) {
    const values = Array.from({ length: 6 }, (_, row) => sampleCell(originX + column * stepX, originY + row * stepY));
    const present = values.filter((value): value is Outcome => Boolean(value));
    if (!present.length) {
      emptyColumns += 1;
      if (emptyColumns >= 2) break;
      continue;
    }
    emptyColumns = 0;
    for (const value of values) {
      if (!value) break;
      outcomes.push(value);
    }
  }
  return outcomes.length >= 12 ? outcomes.slice(-96) : [];
}

function extractRoad(components: Component[], width: number, height: number, detectedBeadPlate: Outcome[] = []): RoadSnapshot {
  const groups = buildRoadGroups(components);
  const trustedDetectedBeadPlate = groups.some((group) => !group.segmented && group.rows > 7 && group.markers.length >= detectedBeadPlate.length)
    ? [] : detectedBeadPlate;
  const globalMarkers = mergeNearbyMarkers(components).filter((marker) => marker.light >= 0.4);
  const globalStructured = splitStructuredMarkers(globalMarkers);
  if (!groups.length && !globalStructured && !trustedDetectedBeadPlate.length) return emptySnapshot();

  const askGroup = groups.find(isAskRoad);
  const wideGroups = groups.filter((group) => group.columns >= 5 && !isAskRoad(group));
  const beadGroup = wideGroups
    .filter((group) => group.segmented && group.rows >= 5 && group.rows <= 7 && group.columns >= 4)
    .sort((left, right) => right.markers.length - left.markers.length)[0];
  const structuralGroups = wideGroups.filter((group) => !group.segmented);
  const mainGroup = [...(structuralGroups.length ? structuralGroups : beadGroup ? [beadGroup] : [])].sort((left, right) => {
    const sizeDifference = right.markerSize - left.markerSize;
    return Math.abs(sizeDifference) > 2 ? sizeDifference : right.score - left.score;
  })[0];
  const structuredCandidate = [
    ...(globalStructured ? [{
      group: undefined as RoadGroup | undefined,
      road: globalStructured,
      minX: Math.min(...globalMarkers.map((marker) => marker.x)),
      maxX: Math.max(...globalMarkers.map((marker) => marker.x)),
    }] : []),
    ...groups.filter((group) => !group.segmented).map((group) => ({ group, road: splitStructuredMarkers(group.markers), minX: group.minX, maxX: group.maxX })),
  ]
    .filter((candidate): candidate is { group: RoadGroup | undefined; road: NonNullable<ReturnType<typeof splitStructuredMarkers>>; minX: number; maxX: number } => Boolean(candidate.road))
    .sort((left, right) => (right.road.mainMarkers.length + right.road.derivedMarkers.length) - (left.road.mainMarkers.length + left.road.derivedMarkers.length))[0];

  let askBanker: SignalColor[] = [];
  let askPlayer: SignalColor[] = [];
  if (askGroup) {
    const middle = (askGroup.minY + askGroup.maxY) / 2;
    // Filled ask-road badges are much denser than the vertical 莊問路／閒問路 labels beside them.
    const badges = askGroup.markers.filter((marker) => {
      const coloredPixels = marker.red + marker.blue + marker.green;
      return marker.size >= askGroup.markerSize * 0.65 && coloredPixels / Math.max(1, marker.size * marker.size) >= 0.27;
    });
    askBanker = readingOrder(badges.filter((marker) => marker.y < middle)).map(colorFromMarker).slice(-12);
    askPlayer = readingOrder(badges.filter((marker) => marker.y >= middle)).map(colorFromMarker).slice(-12);
  }

  const mainMarkers = structuredCandidate?.road.mainMarkers ?? mainGroup?.markers ?? [];
  const derivedGroups = structuralGroups
    .filter((group) => group !== mainGroup && group !== beadGroup && (!mainGroup || group.markerSize < mainGroup.markerSize * 0.92 || group.minY > mainGroup.maxY))
    .sort((left, right) => left.minY - right.minY || left.minX - right.minX);
  const derivedMarkers = [
    ...(structuredCandidate?.road.derivedMarkers ?? []),
    ...derivedGroups.filter((group) => group !== structuredCandidate?.group).flatMap((group) => group.markers),
  ];
  const beadPlate = trustedDetectedBeadPlate.length ? trustedDetectedBeadPlate : beadGroup ? readingOrder(beadGroup.markers).map(outcomeFromMarker).slice(-96) : [];
  let bigRoadOutcomes = readingOrder(mainMarkers).map(outcomeFromMarker).slice(-96);
  const structuredBounds = structuredCandidate ? { minX: structuredCandidate.minX, maxX: structuredCandidate.maxX } : undefined;
  const { bigEyeRoad, smallRoad, cockroachRoad } = classifyDerivedRoads(derivedMarkers, structuredBounds);
  const derived = [...bigEyeRoad, ...smallRoad, ...cockroachRoad];
  if (beadPlate.length >= 12 && bigRoadOutcomes.length < beadPlate.length * 0.45 && !derived.length) bigRoadOutcomes = [];
  const outcomes = beadPlate.length >= 6 ? beadPlate : bigRoadOutcomes;
  const markerCount = Math.max(outcomes.length, bigRoadOutcomes.length) + derived.length + askBanker.length + askPlayer.length;
  if (markerCount < 6) return emptySnapshot();

  const mode: RoadMode = askGroup && !mainMarkers.length ? "ask-road" : "road-board";
  const confidence = Math.min(0.94, 0.42 + Math.min(0.38, markerCount / 80) + (mainMarkers.length ? 0.08 : 0) + (askGroup ? 0.06 : 0));
  const signature = [outcomes.join(""), beadPlate.join(""), bigRoadOutcomes.join(""), bigEyeRoad.join(""), smallRoad.join(""), cockroachRoad.join(""), askBanker.join(""), askPlayer.join("")].join("|");
  const selectedMarkers = mainMarkers.length ? [...mainMarkers, ...derivedMarkers] : askGroup ? askGroup.markers : [];
  const selectedSize = Math.max(4, median(selectedMarkers.map((marker) => marker.size)));
  const minX = Math.min(...selectedMarkers.map((marker) => marker.x));
  const maxX = Math.max(...selectedMarkers.map((marker) => marker.x));
  const minY = Math.min(...selectedMarkers.map((marker) => marker.y));
  const maxY = Math.max(...selectedMarkers.map((marker) => marker.y));
  const left = Math.max(0, minX - selectedSize * 3);
  const top = Math.max(0, minY - selectedSize * 3);
  const right = Math.min(width, maxX + Math.max(selectedSize * 20, (maxX - minX) * 0.35));
  const bottom = Math.min(height, maxY + selectedSize * 4);
  const region = selectedMarkers.length ? {
    x: left / width,
    y: top / height,
    width: Math.max(1, right - left) / width,
    height: Math.max(1, bottom - top) / height,
  } : null;
  return { outcomes, beadPlate, bigRoadOutcomes, askBanker, askPlayer, bigEyeRoad, smallRoad, cockroachRoad, derived, markerCount, confidence, mode, signature, region };
}

export function readRoadFromPixels(data: Uint8ClampedArray, width: number, height: number, options?: { step?: number }) {
  // Step 1: Crop black borders
  const cropped = cropBlackBorders(data, width, height);
  data = cropped.data;
  width = cropped.width;
  height = cropped.height;

  // Step 2: Resolution check — images too small cannot be reliably recognized
  const MIN_SHORT_EDGE = 280;
  if (Math.min(width, height) < MIN_SHORT_EDGE) {
    throw new Error("圖片解析度不足，請上傳較清晰的完整牌路截圖");
  }

  // Step 3: Run recognition
  const step = options?.step ?? Math.max(1, Math.ceil(Math.min(width, height) / 560));
  const components = findComponents(data, width, height, step);
  return extractRoad(components, width, height, detectBeadPlate(data, width, height, components));
}

export function cropBlackBorders(data: Uint8ClampedArray, width: number, height: number) {
  let top = 0, bottom = height - 1, left = 0, right = width - 1;
  const isBlack = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return data[idx] < 20 && data[idx + 1] < 20 && data[idx + 2] < 20;
  };
  while (top < height && Array.from({ length: width }, (_, x) => isBlack(x, top)).every(Boolean)) top++;
  while (bottom > top && Array.from({ length: width }, (_, x) => isBlack(x, bottom)).every(Boolean)) bottom--;
  while (left < width && Array.from({ length: height }, (_, y) => isBlack(left, y)).every(Boolean)) left++;
  while (right > left && Array.from({ length: height }, (_, y) => isBlack(right, y)).every(Boolean)) right--;
  const newWidth = right - left + 1;
  const newHeight = bottom - top + 1;
  const newData = new Uint8ClampedArray(newWidth * newHeight * 4);
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcIdx = ((top + y) * width + (left + x)) * 4;
      const dstIdx = (y * newWidth + x) * 4;
      newData[dstIdx] = data[srcIdx];
      newData[dstIdx + 1] = data[srcIdx + 1];
      newData[dstIdx + 2] = data[srcIdx + 2];
      newData[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: newData, width: newWidth, height: newHeight };
}

export function readRoadFromSource(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, lockedRegion?: RoadRegion | null) {
  const cropX = lockedRegion ? Math.max(0, Math.floor(lockedRegion.x * sourceWidth)) : 0;
  const cropY = lockedRegion ? Math.max(0, Math.floor(lockedRegion.y * sourceHeight)) : 0;
  const cropWidth = lockedRegion ? Math.max(1, Math.min(sourceWidth - cropX, Math.ceil(lockedRegion.width * sourceWidth))) : sourceWidth;
  const cropHeight = lockedRegion ? Math.max(1, Math.min(sourceHeight - cropY, Math.ceil(lockedRegion.height * sourceHeight))) : sourceHeight;

  // Step 1: Draw to temp canvas at original size to access pixel data
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = cropWidth;
  tempCanvas.height = cropHeight;
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
  if (!tempCtx) return emptySnapshot();
  tempCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const tempImage = tempCtx.getImageData(0, 0, cropWidth, cropHeight);

  // Step 2: Crop black borders
  const cropped = cropBlackBorders(tempImage.data, cropWidth, cropHeight);

  // Step 3: Downscale large images to standard size
  const STANDARD_SHORT_EDGE = 546;
  const currentShortEdge = Math.min(cropped.width, cropped.height);
  const scale = currentShortEdge > STANDARD_SHORT_EDGE ? STANDARD_SHORT_EDGE / currentShortEdge : 1;
  const width = Math.max(1, Math.round(cropped.width * scale));
  const height = Math.max(1, Math.round(cropped.height * scale));

  // Step 4: Draw to final canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return emptySnapshot();

  if (scale < 1) {
    // Put cropped data on a temp canvas, then downscale via drawImage
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropped.width;
    croppedCanvas.height = cropped.height;
    const croppedCtx = croppedCanvas.getContext("2d", { willReadFrequently: true });
    if (croppedCtx) {
      croppedCtx.putImageData(new ImageData(cropped.data, cropped.width, cropped.height), 0, 0);
      context.drawImage(croppedCanvas, 0, 0, cropped.width, cropped.height, 0, 0, width, height);
    }
  } else {
    context.putImageData(new ImageData(cropped.data, cropped.width, cropped.height), 0, 0);
  }

  const image = context.getImageData(0, 0, width, height);
  const snapshot = readRoadFromPixels(image.data, width, height);
  if (lockedRegion && snapshot.region) {
    snapshot.region = {
      x: lockedRegion.x + snapshot.region.x * lockedRegion.width,
      y: lockedRegion.y + snapshot.region.y * lockedRegion.height,
      width: snapshot.region.width * lockedRegion.width,
      height: snapshot.region.height * lockedRegion.height,
    };
  }
  return snapshot;
}

export function locateLiveRoadFromSource(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return emptySnapshot();
  context.drawImage(source, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const candidates = findLightPanelRegions(image.data, width, height);
  let best: { snapshot: RoadSnapshot; region: RoadRegion; score: number } | null = null;
  for (const region of candidates) {
    const snapshot = readRoadFromSource(source, sourceWidth, sourceHeight, region);
    if (!isCompositeRoadSnapshot(snapshot)) continue;
    const visibleDerivedRoads = [snapshot.bigEyeRoad, snapshot.smallRoad, snapshot.cockroachRoad]
      .filter((road) => road.length >= 2).length;
    const score = snapshot.derived.length * 4
      + snapshot.outcomes.length * 2
      + snapshot.markerCount
      + visibleDerivedRoads * 80
      + region.width * 40;
    if (!best || score > best.score) best = { snapshot, region, score };
  }
  if (!best) return emptySnapshot();
  const marginX = Math.min(0.02, best.region.width * 0.08);
  const marginY = Math.min(0.025, best.region.height * 0.1);
  best.snapshot.region = {
    x: Math.max(0, best.region.x - marginX),
    y: Math.max(0, best.region.y - marginY),
    width: Math.min(1 - Math.max(0, best.region.x - marginX), best.region.width + marginX * 2),
    height: Math.min(1 - Math.max(0, best.region.y - marginY), best.region.height + marginY * 2),
  };
  return best.snapshot;
}

export async function readRoadFromImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    return readRoadFromSource(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
