import { o as require_react, s as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/road-reader.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function isCompositeRoadSnapshot(snapshot) {
	const visibleDerivedRoads = [
		snapshot.bigEyeRoad,
		snapshot.smallRoad,
		snapshot.cockroachRoad
	].filter((road) => road.length >= 2).length;
	return snapshot.mode === "road-board" && snapshot.outcomes.length >= 6 && snapshot.derived.length >= 6 && visibleDerivedRoads === 3;
}
function median(values) {
	if (!values.length) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function coordinateBins(values, tolerance) {
	const sorted = [...values].sort((left, right) => left - right);
	const bins = [];
	for (const value of sorted) {
		const last = bins.at(-1);
		if (last === void 0 || value - last > tolerance) bins.push(value);
		else bins[bins.length - 1] = (last + value) / 2;
	}
	return bins.length;
}
function pixelKind(red, green, blue) {
	if (red > 145 && red > green * 1.27 && red > blue * 1.12) return 1;
	if (blue > 120 && blue > red * 1.13 && blue > green * 1.02) return 2;
	if (green > 100 && green > red * 1.1 && green > blue * 1.01) return 3;
	return 0;
}
function findLightPanelRegions(data, width, height) {
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
	const regions = [];
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
		if (panelWidth < 58 || panelHeight < 34 || aspect < 1.25 || aspect > 4.8 || fill < .3) continue;
		if (panelWidth > width * .55 || panelHeight > height * .7) continue;
		const padding = 4 * step;
		const left = Math.max(0, minX * step - padding);
		const top = Math.max(0, minY * step - padding);
		const right = Math.min(width, (maxX + 1) * step + padding);
		const bottom = Math.min(height, (maxY + 1) * step + padding);
		regions.push({
			x: left / width,
			y: top / height,
			width: (right - left) / width,
			height: (bottom - top) / height,
			area: panelWidth * panelHeight
		});
	}
	return regions.sort((left, right) => right.area - left.area).slice(0, 18).map((region) => ({
		x: region.x,
		y: region.y,
		width: region.width,
		height: region.height
	}));
}
function findComponents(data, width, height, step) {
	const maxComponentSize = Math.max(48, Math.min(width, height) * .085);
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
	const components = [];
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
		if (pixels < 3 || componentWidth < 2 || componentHeight < 2 || size > maxComponentSize || aspect < .22 || aspect > 4.8) continue;
		const sampleLight = (sourceX, sourceY) => {
			const x = Math.max(0, Math.min(width - 1, Math.round(sourceX * step)));
			const offset = (Math.max(0, Math.min(height - 1, Math.round(sourceY * step))) * width + x) * 4;
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
			sampleLight(maxX + padding, (minY + maxY) / 2)
		].reduce((sum, value) => sum + value, 0) / 8;
		components.push({
			x: (minX + maxX) / 2 * step,
			y: (minY + maxY) / 2 * step,
			size: size * step,
			width: componentWidth * step,
			height: componentHeight * step,
			fill: pixels / Math.max(1, componentWidth * componentHeight),
			red,
			blue,
			green,
			pixels,
			light
		});
	}
	return components;
}
function mergeNearbyMarkers(components) {
	const markers = [];
	for (const component of [...components].sort((left, right) => right.size - left.size)) {
		const existing = markers.find((marker) => Math.hypot(marker.x - component.x, marker.y - component.y) < Math.max(marker.size, component.size) * .56);
		if (!existing) {
			markers.push({ ...component });
			continue;
		}
		const previousWeight = existing.red + existing.blue + existing.green;
		const total = previousWeight + component.pixels;
		existing.x = (existing.x * previousWeight + component.x * component.pixels) / total;
		existing.y = (existing.y * previousWeight + component.y * component.pixels) / total;
		existing.size = Math.max(existing.size, component.size);
		existing.width = Math.max(existing.width, component.width);
		existing.height = Math.max(existing.height, component.height);
		existing.fill = (existing.fill * previousWeight + component.fill * component.pixels) / total;
		existing.red += component.red;
		existing.blue += component.blue;
		existing.green += component.green;
		existing.pixels += component.pixels;
		existing.light = (existing.light * previousWeight + component.light * component.pixels) / total;
	}
	return markers;
}
function componentGroups(components) {
	const parents = components.map((_, index) => index);
	const find = (index) => {
		while (parents[index] !== index) {
			parents[index] = parents[parents[index]];
			index = parents[index];
		}
		return index;
	};
	const unite = (left, right) => {
		const leftRoot = find(left);
		const rightRoot = find(right);
		if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
	};
	for (let left = 0; left < components.length; left += 1) for (let right = left + 1; right < components.length; right += 1) {
		const a = components[left];
		const b = components[right];
		const averageSize = (a.size + b.size) / 2;
		const sizeRatio = Math.max(a.size, b.size) / Math.max(1, Math.min(a.size, b.size));
		const dx = Math.abs(a.x - b.x);
		const dy = Math.abs(a.y - b.y);
		const overlap = Math.hypot(dx, dy) < Math.max(a.size, b.size) * .72;
		const rowNeighbor = sizeRatio < 2.8 && dy < averageSize * .9 && dx < averageSize * 3.8;
		const columnNeighbor = sizeRatio < 2.8 && dx < averageSize * .9 && dy < averageSize * 3.8;
		if (overlap || rowNeighbor || columnNeighbor) unite(left, right);
	}
	const groups = /* @__PURE__ */ new Map();
	components.forEach((component, index) => {
		const root = find(index);
		const group = groups.get(root) ?? [];
		group.push(component);
		groups.set(root, group);
	});
	return [...groups.values()];
}
function colorFromMarker(marker) {
	const best = Math.max(marker.red, marker.blue, marker.green);
	return best === marker.red ? "R" : best === marker.blue ? "U" : "G";
}
function outcomeFromMarker(marker) {
	const color = colorFromMarker(marker);
	return color === "R" ? "B" : color === "U" ? "P" : "T";
}
function readingOrder(markers) {
	const markerSize = Math.max(3, median(markers.map((marker) => marker.size)));
	return [...markers].sort((left, right) => Math.abs(left.x - right.x) > markerSize * .7 ? left.x - right.x : left.y - right.y);
}
function splitVerticalBands(markers) {
	if (markers.length < 12) return [markers];
	const markerSize = Math.max(3, median(markers.map((marker) => marker.size)));
	const sorted = [...markers].sort((left, right) => left.y - right.y);
	const bands = [[]];
	let previousY = sorted[0]?.y ?? 0;
	for (const marker of sorted) {
		if (bands.at(-1)?.length && marker.y - previousY > markerSize * 2.4) bands.push([]);
		bands[bands.length - 1].push(marker);
		previousY = marker.y;
	}
	return bands.filter((band) => band.length >= 6);
}
function buildRoadGroups(components) {
	const groups = [];
	for (const rawGroup of componentGroups(components)) for (const markers of splitVerticalBands(mergeNearbyMarkers(rawGroup))) {
		const markerSize = Math.max(3, median(markers.map((marker) => marker.size)));
		const rows = coordinateBins(markers.map((marker) => marker.y), markerSize * .72);
		const columns = coordinateBins(markers.map((marker) => marker.x), markerSize * .72);
		if (rows > 12 || columns < 2 || columns > 80) continue;
		const minX = Math.min(...markers.map((marker) => marker.x));
		const maxX = Math.max(...markers.map((marker) => marker.x));
		const minY = Math.min(...markers.map((marker) => marker.y));
		const maxY = Math.max(...markers.map((marker) => marker.y));
		const density = markers.length / Math.max(1, rows * columns);
		const light = median(markers.map((marker) => marker.light));
		if (light < .4) continue;
		const gridScore = markers.length * 9 + Math.min(1, density) * 24 + markerSize - Math.max(0, rows - 7) * 12;
		groups.push({
			markers,
			markerSize,
			rows,
			columns,
			minX,
			maxX,
			minY,
			maxY,
			score: gridScore,
			light
		});
	}
	return groups.sort((left, right) => right.score - left.score);
}
function isAskRoad(group) {
	const width = group.maxX - group.minX;
	const height = group.maxY - group.minY;
	return group.rows >= 5 && group.rows <= 8 && group.columns >= 2 && group.columns <= 7 && height > width * .85;
}
function splitStructuredMarkers(markers) {
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
	const lowerMarkers = derivedMarkers.filter((marker) => marker.y > mainBottom + mainSize * .2);
	if (lowerMarkers.length >= 6) derivedMarkers = lowerMarkers;
	const derivedSize = Math.max(3, median(derivedMarkers.map((marker) => marker.size)));
	const sortedDerived = [...derivedMarkers].sort((left, right) => left.y - right.y);
	const verticalBands = [[]];
	let previousY = sortedDerived[0]?.y ?? 0;
	for (const marker of sortedDerived) {
		if (verticalBands.at(-1)?.length && marker.y - previousY > Math.max(12, derivedSize * 1.6)) verticalBands.push([]);
		verticalBands[verticalBands.length - 1].push(marker);
		previousY = marker.y;
	}
	const largestBand = verticalBands.sort((left, right) => right.length - left.length)[0];
	if (largestBand?.length >= 6) derivedMarkers = largestBand;
	const mainRows = coordinateBins(mainMarkers.map((marker) => marker.y), mainSize * .72);
	const mainColumns = coordinateBins(mainMarkers.map((marker) => marker.x), mainSize * .72);
	const mainCenterY = median(mainMarkers.map((marker) => marker.y));
	const derivedCenterY = median(derivedMarkers.map((marker) => marker.y));
	if (mainRows > 8 || mainColumns < 5 || derivedCenterY <= mainCenterY + mainSize * .7) return null;
	return {
		mainMarkers,
		derivedMarkers
	};
}
function classifyDerivedRoads(markers, horizontalBounds) {
	const useful = markers.filter((marker) => colorFromMarker(marker) !== "G");
	const bigEye = [];
	const small = [];
	const cockroach = [];
	const markerSize = Math.max(3, median(useful.map((marker) => marker.size)));
	const usePanelThirds = horizontalBounds && horizontalBounds.maxX - horizontalBounds.minX >= markerSize * 18;
	const firstBoundary = usePanelThirds ? horizontalBounds.minX + (horizontalBounds.maxX - horizontalBounds.minX) / 3 : 0;
	const secondBoundary = usePanelThirds ? horizontalBounds.minX + (horizontalBounds.maxX - horizontalBounds.minX) * 2 / 3 : 0;
	for (const marker of useful) {
		if (usePanelThirds) {
			if (marker.x < firstBoundary) bigEye.push(marker);
			else if (marker.x < secondBoundary) small.push(marker);
			else cockroach.push(marker);
			continue;
		}
		if (Math.max(marker.width, marker.height) / Math.max(1, Math.min(marker.width, marker.height)) >= 1.45) cockroach.push(marker);
		else if (marker.fill >= .52) small.push(marker);
		else bigEye.push(marker);
	}
	return {
		bigEyeRoad: readingOrder(bigEye).map(colorFromMarker).slice(-96),
		smallRoad: readingOrder(small).map(colorFromMarker).slice(-96),
		cockroachRoad: readingOrder(cockroach).map(colorFromMarker).slice(-96)
	};
}
function emptySnapshot() {
	return {
		outcomes: [],
		askBanker: [],
		askPlayer: [],
		bigEyeRoad: [],
		smallRoad: [],
		cockroachRoad: [],
		derived: [],
		markerCount: 0,
		confidence: 0,
		mode: "road-board",
		signature: "",
		region: null
	};
}
function extractRoad(components, width, height) {
	const groups = buildRoadGroups(components);
	const globalMarkers = mergeNearbyMarkers(components).filter((marker) => marker.light >= .4);
	const globalStructured = splitStructuredMarkers(globalMarkers);
	if (!groups.length && !globalStructured) return emptySnapshot();
	const askGroup = groups.find(isAskRoad);
	const wideGroups = groups.filter((group) => group.columns >= 5 && !isAskRoad(group));
	const mainGroup = [...wideGroups].sort((left, right) => {
		const sizeDifference = right.markerSize - left.markerSize;
		return Math.abs(sizeDifference) > 2 ? sizeDifference : right.score - left.score;
	})[0];
	const structuredCandidate = [...globalStructured ? [{
		group: void 0,
		road: globalStructured,
		minX: Math.min(...globalMarkers.map((marker) => marker.x)),
		maxX: Math.max(...globalMarkers.map((marker) => marker.x))
	}] : [], ...groups.map((group) => ({
		group,
		road: splitStructuredMarkers(group.markers),
		minX: group.minX,
		maxX: group.maxX
	}))].filter((candidate) => Boolean(candidate.road)).sort((left, right) => right.road.mainMarkers.length + right.road.derivedMarkers.length - (left.road.mainMarkers.length + left.road.derivedMarkers.length))[0];
	let askBanker = [];
	let askPlayer = [];
	if (askGroup) {
		const middle = (askGroup.minY + askGroup.maxY) / 2;
		const badges = askGroup.markers.filter((marker) => {
			const coloredPixels = marker.red + marker.blue + marker.green;
			return marker.size >= askGroup.markerSize * .65 && coloredPixels / Math.max(1, marker.size * marker.size) >= .27;
		});
		askBanker = readingOrder(badges.filter((marker) => marker.y < middle)).map(colorFromMarker).slice(-12);
		askPlayer = readingOrder(badges.filter((marker) => marker.y >= middle)).map(colorFromMarker).slice(-12);
	}
	const mainMarkers = structuredCandidate?.road.mainMarkers ?? mainGroup?.markers ?? [];
	const derivedGroups = wideGroups.filter((group) => group !== mainGroup && (!mainGroup || group.markerSize < mainGroup.markerSize * .92 || group.minY > mainGroup.maxY)).sort((left, right) => left.minY - right.minY || left.minX - right.minX);
	const derivedMarkers = [...structuredCandidate?.road.derivedMarkers ?? [], ...derivedGroups.filter((group) => group !== structuredCandidate?.group).flatMap((group) => group.markers)];
	const outcomes = readingOrder(mainMarkers).map(outcomeFromMarker).slice(-96);
	const { bigEyeRoad, smallRoad, cockroachRoad } = classifyDerivedRoads(derivedMarkers, structuredCandidate ? {
		minX: structuredCandidate.minX,
		maxX: structuredCandidate.maxX
	} : void 0);
	const derived = [
		...bigEyeRoad,
		...smallRoad,
		...cockroachRoad
	];
	const markerCount = outcomes.length + derived.length + askBanker.length + askPlayer.length;
	if (markerCount < 6) return emptySnapshot();
	const mode = askGroup && !mainMarkers.length ? "ask-road" : "road-board";
	const confidence = Math.min(.94, .42 + Math.min(.38, markerCount / 80) + (mainMarkers.length ? .08 : 0) + (askGroup ? .06 : 0));
	const signature = [
		outcomes.join(""),
		bigEyeRoad.join(""),
		smallRoad.join(""),
		cockroachRoad.join(""),
		askBanker.join(""),
		askPlayer.join("")
	].join("|");
	const selectedMarkers = mainMarkers.length ? [...mainMarkers, ...derivedMarkers] : askGroup ? askGroup.markers : [];
	const selectedSize = Math.max(4, median(selectedMarkers.map((marker) => marker.size)));
	const minX = Math.min(...selectedMarkers.map((marker) => marker.x));
	const maxX = Math.max(...selectedMarkers.map((marker) => marker.x));
	const minY = Math.min(...selectedMarkers.map((marker) => marker.y));
	const maxY = Math.max(...selectedMarkers.map((marker) => marker.y));
	const left = Math.max(0, minX - selectedSize * 3);
	const top = Math.max(0, minY - selectedSize * 3);
	const right = Math.min(width, maxX + Math.max(selectedSize * 20, (maxX - minX) * .35));
	const bottom = Math.min(height, maxY + selectedSize * 4);
	const region = selectedMarkers.length ? {
		x: left / width,
		y: top / height,
		width: Math.max(1, right - left) / width,
		height: Math.max(1, bottom - top) / height
	} : null;
	return {
		outcomes,
		askBanker,
		askPlayer,
		bigEyeRoad,
		smallRoad,
		cockroachRoad,
		derived,
		markerCount,
		confidence,
		mode,
		signature,
		region
	};
}
function readRoadFromPixels(data, width, height, options) {
	const cropped = cropBlackBorders(data, width, height);
	data = cropped.data;
	width = cropped.width;
	height = cropped.height;
	if (Math.min(width, height) < 280) throw new Error("圖片解析度不足，請上傳較清晰的完整牌路截圖");
	const step = options?.step ?? Math.max(1, Math.ceil(Math.min(width, height) / 560));
	return extractRoad(findComponents(data, width, height, step), width, height);
}
function cropBlackBorders(data, width, height) {
	let top = 0, bottom = height - 1, left = 0, right = width - 1;
	const isBlack = (x, y) => {
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
	for (let y = 0; y < newHeight; y++) for (let x = 0; x < newWidth; x++) {
		const srcIdx = ((top + y) * width + (left + x)) * 4;
		const dstIdx = (y * newWidth + x) * 4;
		newData[dstIdx] = data[srcIdx];
		newData[dstIdx + 1] = data[srcIdx + 1];
		newData[dstIdx + 2] = data[srcIdx + 2];
		newData[dstIdx + 3] = data[srcIdx + 3];
	}
	return {
		data: newData,
		width: newWidth,
		height: newHeight
	};
}
function readRoadFromSource(source, sourceWidth, sourceHeight, lockedRegion) {
	const cropX = lockedRegion ? Math.max(0, Math.floor(lockedRegion.x * sourceWidth)) : 0;
	const cropY = lockedRegion ? Math.max(0, Math.floor(lockedRegion.y * sourceHeight)) : 0;
	const cropWidth = lockedRegion ? Math.max(1, Math.min(sourceWidth - cropX, Math.ceil(lockedRegion.width * sourceWidth))) : sourceWidth;
	const cropHeight = lockedRegion ? Math.max(1, Math.min(sourceHeight - cropY, Math.ceil(lockedRegion.height * sourceHeight))) : sourceHeight;
	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = cropWidth;
	tempCanvas.height = cropHeight;
	const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
	if (!tempCtx) return emptySnapshot();
	tempCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
	const cropped = cropBlackBorders(tempCtx.getImageData(0, 0, cropWidth, cropHeight).data, cropWidth, cropHeight);
	const STANDARD_SHORT_EDGE = 546;
	const currentShortEdge = Math.min(cropped.width, cropped.height);
	const scale = currentShortEdge > STANDARD_SHORT_EDGE ? STANDARD_SHORT_EDGE / currentShortEdge : 1;
	const width = Math.max(1, Math.round(cropped.width * scale));
	const height = Math.max(1, Math.round(cropped.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return emptySnapshot();
	if (scale < 1) {
		const croppedCanvas = document.createElement("canvas");
		croppedCanvas.width = cropped.width;
		croppedCanvas.height = cropped.height;
		const croppedCtx = croppedCanvas.getContext("2d", { willReadFrequently: true });
		if (croppedCtx) {
			croppedCtx.putImageData(new ImageData(cropped.data, cropped.width, cropped.height), 0, 0);
			context.drawImage(croppedCanvas, 0, 0, cropped.width, cropped.height, 0, 0, width, height);
		}
	} else context.putImageData(new ImageData(cropped.data, cropped.width, cropped.height), 0, 0);
	const snapshot = readRoadFromPixels(context.getImageData(0, 0, width, height).data, width, height);
	if (lockedRegion && snapshot.region) snapshot.region = {
		x: lockedRegion.x + snapshot.region.x * lockedRegion.width,
		y: lockedRegion.y + snapshot.region.y * lockedRegion.height,
		width: snapshot.region.width * lockedRegion.width,
		height: snapshot.region.height * lockedRegion.height
	};
	return snapshot;
}
function locateLiveRoadFromSource(source, sourceWidth, sourceHeight) {
	const scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
	const width = Math.max(1, Math.round(sourceWidth * scale));
	const height = Math.max(1, Math.round(sourceHeight * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return emptySnapshot();
	context.drawImage(source, 0, 0, width, height);
	const candidates = findLightPanelRegions(context.getImageData(0, 0, width, height).data, width, height);
	let best = null;
	for (const region of candidates) {
		const snapshot = readRoadFromSource(source, sourceWidth, sourceHeight, region);
		if (!isCompositeRoadSnapshot(snapshot)) continue;
		const visibleDerivedRoads = [
			snapshot.bigEyeRoad,
			snapshot.smallRoad,
			snapshot.cockroachRoad
		].filter((road) => road.length >= 2).length;
		const score = snapshot.derived.length * 4 + snapshot.outcomes.length * 2 + snapshot.markerCount + visibleDerivedRoads * 80 + region.width * 40;
		if (!best || score > best.score) best = {
			snapshot,
			region,
			score
		};
	}
	if (!best) return emptySnapshot();
	const marginX = Math.min(.02, best.region.width * .08);
	const marginY = Math.min(.025, best.region.height * .1);
	best.snapshot.region = {
		x: Math.max(0, best.region.x - marginX),
		y: Math.max(0, best.region.y - marginY),
		width: Math.min(1 - Math.max(0, best.region.x - marginX), best.region.width + marginX * 2),
		height: Math.min(1 - Math.max(0, best.region.y - marginY), best.region.height + marginY * 2)
	};
	return best.snapshot;
}
async function readRoadFromImage(file) {
	const bitmap = await createImageBitmap(file);
	try {
		return readRoadFromSource(bitmap, bitmap.width, bitmap.height);
	} finally {
		bitmap.close();
	}
}
//#endregion
//#region app/road-analyzer.tsx
var import_jsx_runtime = require_jsx_runtime();
var labels = {
	B: "莊",
	P: "閒",
	T: "和"
};
var STANDARD_ODDS = {
	banker: 45.8597,
	player: 44.6247,
	tie: 9.5156
};
var SUPPORT_LINE_URL = "https://lin.ee/WG0xITo";
var APP_VERSION = "v1.10.0";
function trackSupportClick(source) {
	if (typeof window === "undefined") return;
	const analyticsWindow = window;
	const parameters = {
		event_category: "contact",
		event_label: "LINE @mt7777",
		link_source: source
	};
	if (typeof analyticsWindow.gtag === "function") analyticsWindow.gtag("event", "generate_lead", parameters);
	else {
		analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
		analyticsWindow.dataLayer.push({
			event: "generate_lead",
			...parameters
		});
	}
}
var EMPTY_LEARNING_PROFILE = {
	modelVersion: "v3-feedback-calibration",
	minimumSamples: 12,
	totalFeedback: 0,
	decisiveFeedback: 0,
	buckets: {}
};
function clamp(value, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, value));
}
function redShare(signals) {
	const useful = signals.filter((signal) => signal !== "G");
	return useful.length ? useful.filter((signal) => signal === "R").length / useful.length : .5;
}
function recencyWeightedBalance(signals) {
	const useful = signals.filter((signal) => signal !== "G").slice(-24);
	if (!useful.length) return 0;
	let weighted = 0;
	let totalWeight = 0;
	useful.forEach((signal, index) => {
		const weight = .65 + (index + 1) / useful.length;
		weighted += (signal === "R" ? 1 : -1) * weight;
		totalWeight += weight;
	});
	return totalWeight ? weighted / totalWeight : 0;
}
function patternScore(outcomes) {
	const history = outcomes.slice(-30);
	if (history.length < 7) return {
		score: 0,
		agreement: 0,
		windows: 0
	};
	const windowScores = [
		9,
		16,
		28
	].filter((_size, index) => history.length >= [
		7,
		12,
		20
	][index]).map((size) => {
		const sample = history.slice(-size);
		let score = 0;
		let totalWeight = 0;
		for (let lag = 1; lag <= Math.min(4, Math.floor((sample.length - 1) / 2)); lag += 1) {
			let correlation = 0;
			let comparisons = 0;
			for (let index = lag; index < sample.length; index += 1) {
				correlation += sample[index] === sample[index - lag] ? 1 : -1;
				comparisons += 1;
			}
			const normalized = comparisons ? correlation / comparisons : 0;
			const reliability = clamp((Math.abs(normalized) - .2) / .8, 0, 1);
			if (!reliability) continue;
			const anchor = sample[sample.length - lag] === "B" ? 1 : -1;
			const direction = normalized >= 0 ? anchor : -anchor;
			const weight = reliability / lag;
			score += direction * weight;
			totalWeight += weight;
		}
		const last = sample.at(-1);
		if (last) {
			let run = 1;
			for (let index = sample.length - 2; index >= 0 && sample[index] === last; index -= 1) run += 1;
			const recent = sample.slice(-8);
			const alternation = recent.slice(1).reduce((sum, value, index) => sum + Number(value !== recent[index]), 0) / Math.max(1, recent.length - 1);
			if (run >= 2) {
				const weight = Math.min(.7, .18 + run * .1);
				score += (last === "B" ? 1 : -1) * weight;
				totalWeight += weight;
			} else if (alternation >= .68) {
				const weight = Math.min(.65, (alternation - .5) * 1.6);
				score += (last === "B" ? -1 : 1) * weight;
				totalWeight += weight;
			}
		}
		return totalWeight ? clamp(score / totalWeight, -1, 1) : 0;
	});
	const meaningful = windowScores.filter((score) => Math.abs(score) >= .12);
	if (!meaningful.length) return {
		score: 0,
		agreement: 0,
		windows: windowScores.length
	};
	const positive = meaningful.filter((score) => score > 0).length;
	const negative = meaningful.length - positive;
	const agreement = Math.max(positive, negative) / meaningful.length;
	return {
		score: clamp(windowScores.reduce((sum, value, index) => sum + value * [
			.48,
			.32,
			.2
		][index], 0) / windowScores.reduce((sum, _value, index) => sum + [
			.48,
			.32,
			.2
		][index], 0), -1, 1),
		agreement,
		windows: windowScores.length
	};
}
function roadPrediction(snapshot, learningProfile) {
	const baseDecisive = STANDARD_ODDS.banker + STANDARD_ODDS.player;
	const baseBanker = STANDARD_ODDS.banker / baseDecisive * 100;
	if (!snapshot || snapshot.markerCount < 6) return null;
	const outcomes = snapshot.outcomes.filter((item) => item !== "T");
	const pattern = patternScore(outcomes);
	const separatedRoads = [
		{
			signals: snapshot.bigEyeRoad,
			weight: .46
		},
		{
			signals: snapshot.smallRoad,
			weight: .33
		},
		{
			signals: snapshot.cockroachRoad,
			weight: .21
		}
	].filter((road) => road.signals.length >= 3);
	const derivedRoads = separatedRoads.length ? separatedRoads : snapshot.derived.length >= 5 ? [{
		signals: snapshot.derived,
		weight: .35
	}] : [];
	const derivedBalances = derivedRoads.map((road) => ({
		balance: recencyWeightedBalance(road.signals),
		weight: road.weight * Math.min(1, road.signals.length / 10)
	}));
	const derivedWeight = derivedBalances.reduce((sum, road) => sum + road.weight, 0);
	const derivedClarity = derivedWeight ? derivedBalances.reduce((sum, road) => sum + Math.abs(road.balance) * road.weight, 0) / derivedWeight : 0;
	const derivedDirectionAgreement = derivedBalances.length <= 1 ? derivedClarity : Math.abs(derivedBalances.reduce((sum, road) => sum + Math.sign(road.balance) * road.weight, 0)) / Math.max(.01, derivedWeight);
	const bankerAsk = snapshot.askBanker.filter((signal) => signal !== "G");
	const playerAsk = snapshot.askPlayer.filter((signal) => signal !== "G");
	let askScore = 0;
	if (bankerAsk.length >= 2 && playerAsk.length >= 2) askScore = clamp((redShare(bankerAsk) - redShare(playerAsk)) * 2, -1, 1);
	const hasPattern = outcomes.length >= 7 && Math.abs(pattern.score) >= .12;
	const hasAskRoad = Math.abs(askScore) >= .12;
	const combinedScore = hasPattern && hasAskRoad ? pattern.score * .72 + askScore * .28 : hasPattern ? pattern.score : hasAskRoad ? askScore : 0;
	const sampleQuality = hasAskRoad && !outcomes.length ? Math.min(1, Math.min(bankerAsk.length, playerAsk.length) / 5) : Math.min(1, outcomes.length / 24);
	const recognitionQuality = clamp((snapshot.confidence - .45) / .45, .35, 1);
	const roadCalibration = derivedRoads.length ? .82 + .18 * derivedClarity * derivedDirectionAgreement : .78;
	const tendency = combinedScore * 1.65 * sampleQuality * recognitionQuality * roadCalibration;
	const conflictingWindows = hasPattern && pattern.agreement < .67;
	const rawWeakSignal = Math.abs(tendency) < .42 || !hasAskRoad && outcomes.length < 9 || conflictingWindows;
	const rawCalibratedTendency = rawWeakSignal ? 0 : tendency;
	const rawPredictedSide = clamp(baseBanker + rawCalibratedTendency, 49.1, 52.3) >= 50 ? "B" : "P";
	const rawAbsoluteTendency = Math.abs(rawCalibratedTendency);
	const rawStrength = rawWeakSignal ? "觀望" : snapshot.markerCount >= 20 && pattern.agreement >= .67 && rawAbsoluteTendency >= .9 ? "中" : "低";
	const allThreeRoads = snapshot.bigEyeRoad.length > 0 && snapshot.smallRoad.length > 0 && snapshot.cockroachRoad.length > 0;
	const signal = snapshot.mode === "ask-road" ? "莊／閒問路" : allThreeRoads ? "大路＋三路" : snapshot.derived.length ? "大路＋衍生路" : "大路";
	const signalClass = snapshot.mode === "ask-road" ? "ask" : allThreeRoads ? "composite" : "basic";
	const strengthClass = rawStrength === "觀望" ? "watch" : rawStrength === "中" ? "medium" : "low";
	const featureBucket = `${signalClass}:${strengthClass}:${rawPredictedSide}`;
	const learned = learningProfile?.buckets[featureBucket];
	const learningSamples = learned?.decisive ?? 0;
	const learningHitRate = learned?.decisive ? learned.correct / learned.decisive : null;
	const learningApplied = Boolean(learned && learned.decisive >= (learningProfile?.minimumSamples ?? 12));
	const learnedWeakSignal = Boolean(learningApplied && learned && learned.decisive >= 20 && (learningHitRate ?? .5) < .46);
	const banker = clamp(baseBanker + rawCalibratedTendency * (learningApplied && (learningHitRate ?? .5) > .5 ? clamp(1 + ((learningHitRate ?? .5) - .5) * .6, 1, 1.1) : 1), 49.1, 52.3);
	const predictedSide = banker >= 50 ? "B" : "P";
	const strength = rawWeakSignal || learnedWeakSignal ? "觀望" : rawStrength;
	const baseNote = rawWeakSignal ? conflictingWindows ? "短、中期訊號互相衝突，維持理論基準" : "樣本或訊號不足，維持理論基準" : hasAskRoad && hasPattern ? "問路方向與多時間窗形態一致，已保守校準" : hasAskRoad ? "依莊／閒問路差異保守校準" : derivedRoads.length ? "短、中期形態同向，並以三路一致度校準" : "依大路多時間窗形態保守校準";
	const note = learnedWeakSignal ? `${baseNote}；同類訊號累積 ${learningSamples} 局後可靠度偏低，本局降為觀望` : learningApplied ? `${baseNote}；已套用 ${learningSamples} 局同類回報校準` : baseNote;
	return {
		banker,
		player: 100 - banker,
		tie: STANDARD_ODDS.tie,
		strength,
		signal,
		note,
		predictedSide,
		signalClass,
		strengthClass,
		featureBucket,
		learningSamples,
		learningHitRate,
		learningApplied
	};
}
function liveRoadOnly(snapshot) {
	if (!isCompositeRoadSnapshot(snapshot)) return null;
	const outcomes = snapshot.outcomes;
	const derived = snapshot.derived;
	return {
		...snapshot,
		askBanker: [],
		askPlayer: [],
		markerCount: outcomes.length + derived.length,
		signature: `${outcomes.join("")}|${snapshot.bigEyeRoad.join("")}|${snapshot.smallRoad.join("")}|${snapshot.cockroachRoad.join("")}||`
	};
}
function liveRoadStateKey(snapshot) {
	return [
		snapshot.outcomes.join(""),
		snapshot.bigEyeRoad.length,
		snapshot.smallRoad.length,
		snapshot.cockroachRoad.length
	].join("|");
}
function isNextCompletedRound(previous, candidate) {
	if (candidate.outcomes.length !== previous.outcomes.length + 1) return false;
	const sampleLength = Math.min(18, previous.outcomes.length);
	const previousTail = previous.outcomes.slice(-sampleLength);
	const candidateTail = candidate.outcomes.slice(0, -1).slice(-sampleLength);
	return previousTail.reduce((count, outcome, index) => count + Number(outcome === candidateTail[index]), 0) >= Math.ceil(sampleLength * .85);
}
function Icon({ name, size = 20 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		children: {
			paste: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "7",
					y: "5",
					width: "12",
					height: "16",
					rx: "2"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 5V3h8v2" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 17H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" })
			] }),
			scan: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 8V5a1 1 0 0 1 1-1h3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 4h3a1 1 0 0 1 1 1v3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 16v3a1 1 0 0 1-1 1h-3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 20H5a1 1 0 0 1-1-1v-3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "3"
				})
			] }),
			shield: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m9 12 2 2 4-4" })] }),
			chart: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 19V9" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 19V5" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 19v-7" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M22 19H2" })
			] }),
			info: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "9"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 11v5" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 8h.01" })
			] }),
			logout: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 17l5-5-5-5" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 12H3" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" })
			] }),
			monitor: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: "3",
					y: "4",
					width: "18",
					height: "13",
					rx: "2"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 21h8" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 17v4" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m8 11 2.3 2.3L16 8" })
			] }),
			stop: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "5",
				y: "5",
				width: "14",
				height: "14",
				rx: "2"
			}) }),
			line: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 11.4c0 4-3.8 7.2-8.5 7.2-.8 0-1.6-.1-2.3-.3L5 20l1.2-3.1C4.5 15.6 3.5 13.7 3.5 11.4c0-4 3.8-7.2 8.5-7.2s8 3.2 8 7.2Z" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 9v4h2" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 9v4" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m14 13 3-4v4" })
			] }),
			chat: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" }) })
		}[name]
	});
}
function TrialGrowthContent({ lineUrl }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "growth-content",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "seo-intro",
				"aria-labelledby": "baccarat-prediction-guide",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "seo-intro-copy",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "section-kicker",
							children: "MT1399 BACCARAT GUIDE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "baccarat-prediction-guide",
							children: "百家樂牌路分析器使用教學與牌路規則說明"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "百家樂預測工具會先辨識截圖中的大路、大眼路、小路與蟑螂路，再把近期排列轉換成可閱讀的莊閒訊號比例。手機使用者只要截取完整牌路並從相簿上傳，電腦使用者則可直接貼上截圖。" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "seo-feature-tags",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "手機截圖分析" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "四種牌路辨識" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "莊閒訊號整理" })
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "seo-conversion-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "更多百家樂教學" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "前往 MT1399 查看完整玩法、策略與最新文章" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "growth-cta primary",
							href: "https://mt1399.com/",
							target: "_blank",
							rel: "noreferrer",
							children: ["進入 MT1399 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "→" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "growth-cta secondary",
							href: lineUrl,
							target: "_blank",
							rel: "noreferrer",
							onClick: () => trackSupportClick("guide_card"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								name: "chat",
								size: 17
							}), " 聯繫官方客服"]
						})] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "road-explainer",
				"aria-labelledby": "road-analysis-title",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content-heading",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "ROAD MAP ANALYSIS" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "road-analysis-title",
							children: "百家樂牌路分析會看哪些資料？"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "系統會分開整理四種牌路，不會把下方紅藍訊號直接當成莊或閒。" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "road-explainer-grid",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "01" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "大路" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "記錄每局莊、閒與和的排列，是百家樂預測分析的主要資料來源。" })
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "02" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "大眼路（大眼仔路）" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "用來觀察大路排列是否整齊，以及近期結構是否持續一致。" })
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "03" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "小路" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "從不同間隔比較牌路結構，協助判斷訊號是否互相呼應。" })
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "04" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "曱甴路（蟑螂路）" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "補充觀察較長間隔的規律變化，作為訊號強弱的校準依據。" })
						] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "method-section",
				"aria-labelledby": "analysis-method-title",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content-heading",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "HOW IT WORKS" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "analysis-method-title",
							children: "百家樂牌路辨識分析如何產生結果？"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "公開目前工具實際使用的訊號來源與限制，不刊登尚未完成驗證的準確率。" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "method-grid",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "01" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "辨識完整牌路" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "先從截圖讀取大路、大眼仔路、小路與曱甴路；圖片模糊、裁切不完整或版型特殊時，可能無法產生結果。" })] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "02" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "比較近期排列" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "大路會以不同長度的近期區間比較連續、跳動與重複形態，不只依最後一局直接判斷。" })] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "03" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "校準訊號強弱" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "下三路只用來觀察牌路整齊度與一致性，不會把紅藍符號直接解讀為莊或閒。" })] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "04" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "不足時維持觀望" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "當可辨識樣本太少、短中期訊號衝突或畫面信心不足時，系統會降低強度並顯示觀望。" })] })] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "faq-section",
				"aria-labelledby": "prediction-faq",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content-heading",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "FAQ" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "prediction-faq",
							children: "百家樂預測常見問題"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "快速了解支援平台、手機上傳、電腦貼上、辨識內容與試用次數。" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "faq-list",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["其他百家樂遊戲可以使用嗎？", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
							"可以。",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "MT 真人、DG 真人、T9 真人、歐博真人、W 真人與 SA 真人等遊戲" }),
							"，只要畫面採用可辨識的標準百家樂牌路介面即可上傳分析；特殊版型或截圖不完整時可能無法辨識。"
						] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["手機如何使用 MT1399 百家樂牌路分析工具？", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "faq-answer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "手機使用者可依 3 個步驟完成牌路分析：" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "截取畫面：" }), "在百家樂遊戲中擷取包含大路與下三路的完整牌路。"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "上傳圖片：" }), "回到本頁點選「選擇手機截圖」，再從相簿選取圖片。"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "查看結果：" }), "辨識完成後，查看大路與三條衍生路的近期訊號整理。"] })
							] })]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["電腦如何貼上百家樂牌路截圖進行分析？", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Windows 可按 Win＋Shift＋S 截取完整牌路，回到分析器後按 Ctrl＋V；也可以點擊「從剪貼簿貼上」或直接拖曳圖片。圖片需清楚包含大路與下三路。" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["MT1399 百家樂路圖分析器會讀取哪些內容？", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "工具會辨識截圖中的大路、大眼仔路、小路與曱甴路，整理大路近期排列、下三路規律度、訊號一致度及可辨識樣本數，再輸出保守的牌路推估；不會讀取下注金額或遊戲帳號。" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["免費試用次數怎麼計算？", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "只有成功辨識牌路並產生分析結果才會計算一次；無法辨識或沒有產生結果時不會扣除使用次數。" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["百家樂牌路分析結果代表下一局一定會出現嗎？", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "不代表。分析結果是根據已辨識牌路的近期排列、下三路一致度與樣本品質進行訊號整理，不是勝率保證；牌局結果仍具有隨機性。" })] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "article-section",
				"aria-labelledby": "mt1399-articles",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content-heading article-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "MT1399 FEATURED ARTICLES" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "mt1399-articles",
						children: "延伸閱讀：百家樂教學與策略文章"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "https://mt1399.com/",
						target: "_blank",
						rel: "noreferrer",
						children: "查看全部文章 →"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "article-grid",
					children: [
						{
							tag: "新手入門",
							title: "百家樂是什麼？玩法、規則與牌路一次看懂",
							description: "先理解莊、閒、和的基本規則，再開始閱讀大路與衍生牌路。",
							href: "https://mt1399.com/mt-baccarat-what-is"
						},
						{
							tag: "策略觀念",
							title: "百家樂策略怎麼看？常見牌路與使用方式",
							description: "整理百家樂策略、牌路訊號與實際操作時應先注意的重點。",
							href: "https://mt1399.com/mt-baccarat-strategy"
						},
						{
							tag: "條件教學",
							title: "百家樂洗碼量、有效投注與流水條件解析",
							description: "看懂洗碼量、流水倍數與有效投注之間的差異與計算方式。",
							href: "https://mt1399.com/baccarat-turnover-requirements"
						}
					].map((article, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: article.href,
						target: "_blank",
						rel: "noreferrer",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: article.tag }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: ["0", index + 1] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: article.title }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: article.description }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["閱讀文章 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "→" })] })
						]
					}, article.href))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "bottom-conversion",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "MT1399 OFFICIAL" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "想看更多百家樂預測教學與最新文章？" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "前往 MT1399 瀏覽完整內容，或直接聯繫官方客服取得協助。" })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "growth-cta light",
					href: "https://mt1399.com/",
					target: "_blank",
					rel: "noreferrer",
					children: "前往 MT1399"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					className: "growth-cta glass",
					href: lineUrl,
					target: "_blank",
					rel: "noreferrer",
					onClick: () => trackSupportClick("bottom_conversion"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						name: "chat",
						size: 17
					}), " 專人服務"]
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "growth-footer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "© MT1399 百家樂資訊與牌路分析" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "分析結果為牌路訊號整理，不代表下一局必然結果。" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: "https://mt1399.com/",
					target: "_blank",
					rel: "noreferrer",
					children: "MT1399 官網"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: lineUrl,
					target: "_blank",
					rel: "noreferrer",
					onClick: () => trackSupportClick("footer"),
					children: "官方 LINE"
				})] })]
			})
		]
	});
}
function longestStreak(road) {
	let best = 0;
	let current = 0;
	let previous = null;
	road.filter((item) => item !== "T").forEach((item) => {
		current = item === previous ? current + 1 : 1;
		best = Math.max(best, current);
		previous = item;
	});
	return best;
}
function activeStreak(road) {
	const withoutTies = road.filter((item) => item !== "T");
	const last = withoutTies.at(-1);
	if (!last) return "尚無資料";
	let count = 0;
	for (let index = withoutTies.length - 1; index >= 0 && withoutTies[index] === last; index -= 1) count += 1;
	return `${labels[last]} ${count} 連`;
}
function timeLabel() {
	return new Intl.DateTimeFormat("zh-TW", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false
	}).format(/* @__PURE__ */ new Date());
}
function RoadAnalyzer({ member, trial }) {
	const isTrial = Boolean(trial);
	const usageLimit = trial?.limit ?? member?.dailyLimit ?? 0;
	const [captureMode, setCaptureMode] = (0, import_react.useState)("upload");
	const [deviceMode, setDeviceMode] = (0, import_react.useState)("mobile");
	const [preview, setPreview] = (0, import_react.useState)(null);
	const [snapshot, setSnapshot] = (0, import_react.useState)(null);
	const [prediction, setPrediction] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)("idle");
	const [liveStatus, setLiveStatus] = (0, import_react.useState)("idle");
	const [liveMessage, setLiveMessage] = (0, import_react.useState)("選擇 MT 百家的分頁或視窗後，系統會持續辨識新局");
	const [lastDetectedAt, setLastDetectedAt] = (0, import_react.useState)("");
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const [pasteMessage, setPasteMessage] = (0, import_react.useState)("");
	const [analysisError, setAnalysisError] = (0, import_react.useState)("");
	const [usedToday, setUsedToday] = (0, import_react.useState)(trial?.used ?? member?.usedToday ?? 0);
	const [trialExhausted, setTrialExhausted] = (0, import_react.useState)(isTrial && (trial?.used ?? 0) >= usageLimit);
	const [trialDisabled, setTrialDisabled] = (0, import_react.useState)(Boolean(trial?.disabled));
	const [learningTotal, setLearningTotal] = (0, import_react.useState)(0);
	const [activePrediction, setActivePrediction] = (0, import_react.useState)(null);
	const [feedbackTarget, setFeedbackTarget] = (0, import_react.useState)(null);
	const [feedbackSubmitting, setFeedbackSubmitting] = (0, import_react.useState)(false);
	const [feedbackReceipt, setFeedbackReceipt] = (0, import_react.useState)("");
	const [learningError, setLearningError] = (0, import_react.useState)("");
	const inputRef = (0, import_react.useRef)(null);
	const videoRef = (0, import_react.useRef)(null);
	const streamRef = (0, import_react.useRef)(null);
	const monitorTimerRef = (0, import_react.useRef)(null);
	const previewUrlRef = (0, import_react.useRef)(null);
	const analyzingRef = (0, import_react.useRef)(false);
	const frameReadingRef = (0, import_react.useRef)(false);
	const acceptedSnapshotRef = (0, import_react.useRef)(null);
	const pendingStateKeyRef = (0, import_react.useRef)("");
	const pendingCountRef = (0, import_react.useRef)(0);
	const missingFramesRef = (0, import_react.useRef)(0);
	const liveRegionRef = (0, import_react.useRef)(null);
	const learningProfileRef = (0, import_react.useRef)(EMPTY_LEARNING_PROFILE);
	const latestSnapshotRef = (0, import_react.useRef)(null);
	const activePredictionRef = (0, import_react.useRef)(null);
	const feedbackTargetRef = (0, import_react.useRef)(null);
	const reportedPredictionIdsRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	(0, import_react.useEffect)(() => {
		const coarsePointer = window.matchMedia("(pointer: coarse)");
		const detectDevice = () => {
			setDeviceMode(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || coarsePointer.matches && window.innerWidth < 980 ? "mobile" : "desktop");
		};
		detectDevice();
		window.addEventListener("resize", detectDevice);
		coarsePointer.addEventListener?.("change", detectDevice);
		return () => {
			window.removeEventListener("resize", detectDevice);
			coarsePointer.removeEventListener?.("change", detectDevice);
		};
	}, []);
	const road = (0, import_react.useMemo)(() => snapshot?.outcomes ?? [], [snapshot]);
	const trialUnavailable = trialExhausted || trialDisabled;
	const liveAnalysisEnabled = !isTrial && Boolean(member?.liveAnalysisEnabled);
	const learningEnabled = !isTrial && Boolean(member?.learningEnabled);
	const stats = (0, import_react.useMemo)(() => {
		const banker = road.filter((item) => item === "B").length;
		const player = road.filter((item) => item === "P").length;
		const tie = road.filter((item) => item === "T").length;
		const decisive = banker + player;
		return {
			banker,
			player,
			tie,
			bankerShare: decisive ? banker / decisive * 100 : 0,
			playerShare: decisive ? player / decisive * 100 : 0,
			streak: activeStreak(road),
			longest: longestStreak(road)
		};
	}, [road]);
	(0, import_react.useEffect)(() => {
		if (!isTrial) return;
		fetch("/analyze/api/trial/status").then((response) => response.json()).then((value) => {
			if (typeof value.used !== "number") return;
			setUsedToday(value.used);
			setTrialExhausted(value.used >= (value.limit ?? usageLimit));
			setTrialDisabled(Boolean(value.disabled));
			if (value.disabled) setAnalysisError("此 IP 的免費試用已被管理員停用");
		}).catch(() => void 0);
	}, [isTrial, usageLimit]);
	(0, import_react.useEffect)(() => {
		if (!learningEnabled) return;
		let active = true;
		fetch("/analyze/api/learning", { cache: "no-store" }).then(async (response) => {
			const value = await response.json();
			if (!active || !response.ok || !value.profile) return;
			learningProfileRef.current = value.profile;
			setLearningTotal(value.profile.totalFeedback);
		}).catch(() => void 0);
		return () => {
			active = false;
		};
	}, [learningEnabled]);
	(0, import_react.useEffect)(() => {
		if (isTrial) return;
		let active = true;
		const reportPresence = () => {
			fetch("/analyze/api/member/presence", {
				method: "POST",
				keepalive: true
			}).then((response) => {
				if (active && (response.status === 401 || response.status === 403)) window.location.replace("/");
			}).catch(() => void 0);
		};
		reportPresence();
		const timer = window.setInterval(reportPresence, 45e3);
		const handleVisibility = () => {
			if (document.visibilityState === "visible") reportPresence();
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () => {
			active = false;
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, [isTrial]);
	const commitAnalysis = (0, import_react.useCallback)(async (parsed, mode) => {
		const previousPrediction = learningEnabled ? activePredictionRef.current : null;
		const previousSnapshot = latestSnapshotRef.current;
		if (previousPrediction && !reportedPredictionIdsRef.current.has(previousPrediction.id) && !feedbackTargetRef.current) {
			const detectedOutcome = previousSnapshot && isNextCompletedRound(previousSnapshot, parsed) ? parsed.outcomes.at(-1) : void 0;
			const target = {
				...previousPrediction,
				suggestedActual: detectedOutcome
			};
			feedbackTargetRef.current = target;
			setFeedbackTarget(target);
		}
		latestSnapshotRef.current = parsed;
		activePredictionRef.current = null;
		setActivePrediction(null);
		const nextPrediction = roadPrediction(parsed, learningEnabled ? learningProfileRef.current : null);
		setSnapshot(parsed);
		setPrediction(nextPrediction);
		setFeedbackReceipt("");
		setLearningError("");
		if (!learningEnabled || !nextPrediction) return;
		try {
			const response = await fetch("/analyze/api/learning", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					predictedSide: nextPrediction.predictedSide,
					bankerTenths: Math.round(nextPrediction.banker * 10),
					signalClass: nextPrediction.signalClass,
					strengthClass: nextPrediction.strengthClass,
					captureMode: mode,
					signature: parsed.signature
				})
			});
			const value = await response.json();
			if (!response.ok || !value.prediction) throw new Error(value.error || "無法建立學習紀錄");
			const record = {
				id: value.prediction.id,
				predictedSide: value.prediction.predictedSide,
				banker: nextPrediction.banker,
				player: nextPrediction.player,
				featureBucket: value.prediction.featureBucket
			};
			activePredictionRef.current = record;
			setActivePrediction(record);
		} catch {
			setLearningError("本局分析正常，但學習紀錄暫時無法建立");
		}
	}, [learningEnabled]);
	const submitFeedback = (0, import_react.useCallback)(async (target, actualOutcome) => {
		if (feedbackSubmitting || reportedPredictionIdsRef.current.has(target.id)) return;
		setFeedbackSubmitting(true);
		setLearningError("");
		try {
			const response = await fetch("/analyze/api/learning", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					predictionId: target.id,
					actualOutcome,
					detected: Boolean(target.suggestedActual)
				})
			});
			const value = await response.json();
			if (!response.ok) throw new Error(value.error || "目前無法儲存開牌結果");
			reportedPredictionIdsRef.current.add(target.id);
			if (feedbackTargetRef.current?.id === target.id) {
				feedbackTargetRef.current = null;
				setFeedbackTarget(null);
			}
			if (activePredictionRef.current?.id === target.id) {
				activePredictionRef.current = null;
				setActivePrediction(null);
			}
			if (value.profile) {
				learningProfileRef.current = value.profile;
				setLearningTotal(value.profile.totalFeedback);
			}
			setFeedbackReceipt(value.correct === null ? "和局已記錄，不列入莊閒命中率" : value.correct ? "本局命中，已納入模型學習" : "本局未命中，已納入模型學習");
		} catch (cause) {
			setLearningError(cause instanceof Error ? cause.message : "目前無法儲存開牌結果");
		} finally {
			setFeedbackSubmitting(false);
		}
	}, [feedbackSubmitting]);
	const skipFeedback = (0, import_react.useCallback)((target) => {
		reportedPredictionIdsRef.current.add(target.id);
		if (feedbackTargetRef.current?.id === target.id) {
			feedbackTargetRef.current = null;
			setFeedbackTarget(null);
		}
		if (activePredictionRef.current?.id === target.id) {
			activePredictionRef.current = null;
			setActivePrediction(null);
		}
		setFeedbackReceipt("已略過本局，不會影響模型");
		setLearningError("");
	}, []);
	const consumeUsage = (0, import_react.useCallback)(async (mode = "screenshot") => {
		const usageResponse = await fetch(isTrial ? "/analyze/api/trial/use" : "/analyze/api/member/use", isTrial ? { method: "POST" } : {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mode })
		});
		const usage = await usageResponse.json();
		if (!isTrial && (usageResponse.status === 401 || usageResponse.status === 403 && !usage.error?.includes("畫面即時分析"))) {
			window.location.replace("/");
			throw new Error("請重新登入");
		}
		if (!usageResponse.ok) {
			if (isTrial && usageResponse.status === 429) setTrialExhausted(true);
			if (isTrial && usageResponse.status === 403 && usage.disabled) setTrialDisabled(true);
			throw new Error(usage.error || "目前無法進行分析");
		}
		const used = isTrial ? usage.used : usage.usedToday;
		if (typeof used !== "number") throw new Error("目前無法記錄分析次數");
		setUsedToday(used);
		if (isTrial && used >= (usage.limit ?? usageLimit)) setTrialExhausted(true);
		return used;
	}, [isTrial, usageLimit]);
	const stopLive = (0, import_react.useCallback)((message = "即時監控已停止") => {
		if (monitorTimerRef.current) {
			clearInterval(monitorTimerRef.current);
			monitorTimerRef.current = null;
		}
		const stream = streamRef.current;
		streamRef.current = null;
		stream?.getTracks().forEach((track) => track.stop());
		if (videoRef.current) videoRef.current.srcObject = null;
		frameReadingRef.current = false;
		liveRegionRef.current = null;
		acceptedSnapshotRef.current = null;
		pendingStateKeyRef.current = "";
		pendingCountRef.current = 0;
		setLiveStatus("stopped");
		setLiveMessage(message);
		setStatus((current) => current === "ready" ? current : "idle");
	}, []);
	const inspectLiveFrame = (0, import_react.useCallback)(async () => {
		const video = videoRef.current;
		if (!video || !streamRef.current || frameReadingRef.current || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
		frameReadingRef.current = true;
		try {
			const lockedRegion = liveRegionRef.current;
			const parsed = liveRoadOnly(!lockedRegion ? locateLiveRoadFromSource(video, video.videoWidth, video.videoHeight) : readRoadFromSource(video, video.videoWidth, video.videoHeight, lockedRegion));
			if (!parsed) {
				missingFramesRef.current += 1;
				if (lockedRegion && missingFramesRef.current >= 12) {
					liveRegionRef.current = null;
					pendingStateKeyRef.current = "";
					pendingCountRef.current = 0;
					setLiveMessage("牌路區持續被遮擋，正在重新鎖定同一種標準牌路面板…");
					return;
				}
				if (missingFramesRef.current === 4) setLiveMessage("本局預測維持不變，等待標準牌路白色格線區恢復顯示");
				return;
			}
			missingFramesRef.current = 0;
			const newlyLocked = !lockedRegion && parsed.region;
			if (newlyLocked) liveRegionRef.current = parsed.region;
			const accepted = acceptedSnapshotRef.current;
			if (accepted && !isNextCompletedRound(accepted, parsed)) {
				pendingStateKeyRef.current = "";
				pendingCountRef.current = 0;
				setLiveMessage("本局預測已鎖定，等待大路確定新增 1 個結果");
				return;
			}
			const stateKey = liveRoadStateKey(parsed);
			if (stateKey === pendingStateKeyRef.current) pendingCountRef.current += 1;
			else {
				pendingStateKeyRef.current = stateKey;
				pendingCountRef.current = 1;
				setLiveMessage(newlyLocked ? "已鎖定標準牌路面板，正在確認目前局數…" : "大路新增結果，正在等待畫面穩定…");
			}
			if (pendingCountRef.current < 4) return;
			const used = await consumeUsage("live");
			acceptedSnapshotRef.current = parsed;
			pendingStateKeyRef.current = "";
			pendingCountRef.current = 0;
			await commitAnalysis(parsed, "live");
			setStatus("ready");
			setLastDetectedAt(timeLabel());
			setLiveMessage("本局預測已鎖定，等待大路確定新增 1 個結果");
			if (isTrial && used >= usageLimit) stopLive("免費試用次數已用完");
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : "畫面辨識暫時中斷，系統正在重試…";
			if (isTrial && (message.includes("試用次數已用完") || message.includes("停用")) || message.includes("尚未開通")) stopLive(message);
			else setLiveMessage(message);
		} finally {
			frameReadingRef.current = false;
		}
	}, [
		commitAnalysis,
		consumeUsage,
		isTrial,
		stopLive,
		usageLimit
	]);
	const startLive = (0, import_react.useCallback)(async () => {
		setAnalysisError("");
		if (trialUnavailable || !liveAnalysisEnabled) return;
		if (!navigator.mediaDevices?.getDisplayMedia) {
			setLiveStatus("error");
			setLiveMessage("此瀏覽器不支援即時監控，請改用電腦版 Chrome");
			return;
		}
		setLiveStatus("starting");
		setLiveMessage("請在 Chrome 視窗選擇 MT 百家的分頁或視窗");
		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					frameRate: {
						ideal: 5,
						max: 8
					},
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				},
				audio: false
			});
			streamRef.current = stream;
			const video = videoRef.current;
			if (!video) throw new Error("無法建立畫面預覽");
			video.srcObject = stream;
			await video.play();
			setSnapshot(null);
			setPrediction(null);
			setStatus("reading");
			setLastDetectedAt("");
			setLiveStatus("monitoring");
			setLiveMessage("監控中，只鎖定標準大路＋下方三路白色格線面板");
			acceptedSnapshotRef.current = null;
			liveRegionRef.current = null;
			pendingStateKeyRef.current = "";
			pendingCountRef.current = 0;
			missingFramesRef.current = 0;
			stream.getVideoTracks()[0]?.addEventListener("ended", () => stopLive("Chrome 已停止分享畫面"), { once: true });
			monitorTimerRef.current = setInterval(() => void inspectLiveFrame(), 650);
			window.setTimeout(() => void inspectLiveFrame(), 250);
		} catch (cause) {
			const stream = streamRef.current;
			streamRef.current = null;
			stream?.getTracks().forEach((track) => track.stop());
			if (videoRef.current) videoRef.current.srcObject = null;
			const message = cause instanceof Error && cause.name === "NotAllowedError" ? "你已取消畫面分享，尚未扣除分析局數" : cause instanceof Error ? cause.message : "目前無法開始即時監控";
			setLiveStatus("error");
			setLiveMessage(message);
			setStatus("idle");
		}
	}, [
		inspectLiveFrame,
		liveAnalysisEnabled,
		stopLive,
		trialUnavailable
	]);
	const analyzeFile = (0, import_react.useCallback)(async (selected, automatic = false) => {
		if (analyzingRef.current || trialUnavailable) return;
		analyzingRef.current = true;
		setAnalysisError("");
		setStatus("reading");
		if (automatic) setPasteMessage("截圖已取得，正在自動分析…");
		try {
			const parsed = await readRoadFromImage(selected);
			if (parsed.markerCount < 6) throw new Error("沒有辨識到指定牌路區，請截取莊／閒問路或大路與下方衍生路");
			await consumeUsage();
			await commitAnalysis(parsed, "upload");
			setStatus("ready");
			if (automatic) setPasteMessage("已完成自動分析，可直接貼上下一局");
		} catch (cause) {
			setStatus("idle");
			setAnalysisError(cause instanceof Error ? cause.message : "目前無法進行分析");
			if (automatic) setPasteMessage("自動分析失敗，請重新截圖貼上");
		} finally {
			analyzingRef.current = false;
		}
	}, [
		commitAnalysis,
		consumeUsage,
		trialUnavailable
	]);
	const chooseFile = (0, import_react.useCallback)((selected, source = "upload") => {
		if (!selected || !selected.type.startsWith("image/")) return;
		if (trialUnavailable) {
			setAnalysisError(trialDisabled ? "此 IP 的免費試用已被管理員停用" : "免費試用次數已用完");
			return;
		}
		if (analyzingRef.current) {
			setPasteMessage("正在分析上一張截圖，請稍後再貼");
			return;
		}
		setPreview(() => {
			if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
			const next = URL.createObjectURL(selected);
			previewUrlRef.current = next;
			return next;
		});
		setStatus("idle");
		setPasteMessage(source === "paste" ? "已從剪貼簿取得截圖" : "已選取截圖");
		analyzeFile(selected, true);
	}, [
		analyzeFile,
		trialDisabled,
		trialUnavailable
	]);
	const loadSample = (0, import_react.useCallback)(async () => {
		if (analyzingRef.current) return;
		analyzingRef.current = true;
		setCaptureMode("upload");
		setAnalysisError("");
		setPasteMessage("正在載入範例牌路…");
		setStatus("reading");
		try {
			const response = await fetch("/analyze/sample-baccarat-road.png");
			if (!response.ok) throw new Error("範例圖片載入失敗");
			const blob = await response.blob();
			const parsed = await readRoadFromImage(new File([blob], "sample-baccarat-road.png", { type: blob.type || "image/png" }));
			if (parsed.markerCount < 6) throw new Error("範例牌路暫時無法辨識");
			if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
			previewUrlRef.current = null;
			setPreview("/sample-baccarat-road.png");
			await commitAnalysis(parsed, "upload");
			setStatus("ready");
			setPasteMessage("範例分析完成；此操作不扣免費試用次數");
		} catch (cause) {
			setStatus("idle");
			setAnalysisError(cause instanceof Error ? cause.message : "目前無法載入範例");
			setPasteMessage("");
		} finally {
			analyzingRef.current = false;
		}
	}, [commitAnalysis]);
	const selectMode = (mode) => {
		if (captureMode === "live" && mode === "upload" && streamRef.current) stopLive();
		setCaptureMode(mode);
		setAnalysisError("");
	};
	(0, import_react.useEffect)(() => {
		const handlePaste = (event) => {
			const pastedImage = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"))?.getAsFile();
			if (!pastedImage) return;
			event.preventDefault();
			if (streamRef.current) stopLive("已切換為截圖分析");
			setCaptureMode("upload");
			chooseFile(pastedImage, "paste");
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, [chooseFile, stopLive]);
	(0, import_react.useEffect)(() => () => {
		if (monitorTimerRef.current) clearInterval(monitorTimerRef.current);
		streamRef.current?.getTracks().forEach((track) => track.stop());
		if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
	}, []);
	const onFile = (event) => chooseFile(event.target.files?.[0]);
	const onDrop = (event) => {
		event.preventDefault();
		setDragging(false);
		chooseFile(event.dataTransfer.files?.[0]);
	};
	const pasteFromClipboard = async () => {
		try {
			if (!navigator.clipboard?.read) throw new Error("Clipboard read unavailable");
			const clipboardItems = await navigator.clipboard.read();
			for (const item of clipboardItems) {
				const imageType = item.types.find((type) => type.startsWith("image/"));
				if (!imageType) continue;
				const blob = await item.getType(imageType);
				const extension = imageType.split("/")[1] || "png";
				chooseFile(new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType }), "paste");
				return;
			}
			setPasteMessage("剪貼簿中沒有圖片");
		} catch {
			setPasteMessage("請直接按 Ctrl + V 貼上截圖");
		}
	};
	const logout = async () => {
		if (streamRef.current) stopLive();
		await fetch("/analyze/api/member/logout", { method: "POST" });
		window.location.replace("/");
	};
	const resultStatus = captureMode === "live" ? !liveAnalysisEnabled ? "尚未開通" : liveStatus === "monitoring" && status === "ready" ? "即時同步" : liveStatus === "monitoring" ? "監控中" : liveStatus === "starting" ? "準備中" : status === "ready" ? "上次結果" : "等待監控" : status === "ready" ? "辨識完成" : status === "reading" ? "辨識中" : "等待截圖";
	const visibleFeedback = learningEnabled ? feedbackTarget ?? activePrediction : null;
	const lineCta = trial && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
		className: "line-cta",
		href: trial.lineUrl,
		target: "_blank",
		rel: "noreferrer",
		onClick: () => trackSupportClick("trial_limit"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			name: "line",
			size: 20
		}), " 聯繫客服"]
	});
	const supportCta = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
		className: "line-cta",
		href: trial?.lineUrl ?? SUPPORT_LINE_URL,
		target: "_blank",
		rel: "noreferrer",
		onClick: () => trackSupportClick("feature_gate"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			name: "line",
			size: 20
		}), " 聯繫客服"]
	});
	const memberExpiry = member?.expiresAt === "9999-12-31" ? "永久有效" : `有效至 ${member?.expiresAt.replaceAll("-", "/")}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "app-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "topbar",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "top-brand",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "https://mt1399.com/",
						target: "_blank",
						rel: "noreferrer",
						"aria-label": "MT1399 首頁",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							className: "mt-brand-logo",
							src: "/analyze/mt1399-logo.png",
							alt: "MT1399",
							width: 560,
							height: 118
						})
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "member-block",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: isTrial ? "MT1399 牌路預測分析" : member?.username }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isTrial ? APP_VERSION : memberExpiry })] }),
						!isTrial && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "quota",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: Math.max(0, usageLimit - usedToday) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"/ ",
								usageLimit,
								" 局"
							] })]
						}),
						isTrial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "top-line-link",
							href: trial?.lineUrl,
							target: "_blank",
							rel: "noreferrer",
							"aria-label": "聯繫官方客服",
							onClick: () => trackSupportClick("header"),
							children: "專人服務"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							"aria-label": "登出",
							onClick: logout,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "logout" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "dashboard",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "hero-copy",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: isTrial ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							"百家樂路圖分析器",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "免費線上看路預測與下三路問路工具" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "免費試用版" })
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							"截圖貼上",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "立即分析牌路" })
						] }) }), isTrial && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "hero-lead",
							children: "上傳手機或電腦牌路截圖，即時分析大路與三條衍生路。不限 MT 真人，亦支援 DG、T9、歐博、W、SA 等採用標準牌路介面的百家樂遊戲。"
						})] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "work-grid",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "panel upload-panel",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "panel-heading",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "01" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: captureMode === "upload" ? "牌路截圖辨識" : "畫面即時辨識" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: captureMode === "live" ? "第一步：開啟百家樂畫面即時分析" : "第一步：上傳百家樂牌路截圖進行即時辨識分析" })] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "secure-pill",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "shield",
											size: 15
										}), " 本機辨識"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "capture-tabs",
									role: "tablist",
									"aria-label": "分析方式",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										role: "tab",
										"aria-selected": captureMode === "upload",
										className: captureMode === "upload" ? "active" : "",
										onClick: () => selectMode("upload"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "paste",
											size: 16
										}), " 截圖貼上"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										role: "tab",
										"aria-selected": captureMode === "live",
										className: captureMode === "live" ? "active" : "",
										onClick: () => selectMode("live"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "monitor",
											size: 16
										}), " 畫面即時分析"]
									})]
								}),
								captureMode === "live" ? !liveAnalysisEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "live-feature-gate",
									role: "status",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "monitor",
											size: 30
										}) }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "目前版本還在測試中" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "畫面即時分析暫未全面開放，如有需要請聯繫 MT1399 申請開通。" }),
										supportCta
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `live-preview ${liveStatus === "monitoring" ? "is-live" : ""}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
												ref: videoRef,
												muted: true,
												playsInline: true,
												autoPlay: true,
												"aria-label": "正在分享的 MT 百家畫面預覽"
											}),
											liveStatus !== "monitoring" && liveStatus !== "starting" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "live-empty",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
														name: "monitor",
														size: 28
													}) }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "選取 MT 百家的即時畫面" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "首次自動定位，之後只分析固定牌路區域" })
												]
											}),
											liveStatus === "starting" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "live-empty",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "spinner large" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "等待 Chrome 畫面授權" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "請在跳出的視窗選擇 MT 百家" })
												]
											}),
											liveStatus === "monitoring" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "live-badge",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), " 即時監控中"]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `live-message ${liveStatus === "error" ? "error" : ""}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: liveMessage }), lastDetectedAt && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["最後更新 ", lastDetectedAt] })]
									}),
									liveStatus === "monitoring" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "stop-live-button",
										type: "button",
										onClick: () => stopLive(),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "stop",
											size: 17
										}), " 停止即時監控"]
									}) : trialUnavailable ? lineCta : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "analyze-button live-start-button",
										type: "button",
										onClick: startLive,
										disabled: liveStatus === "starting",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { name: "monitor" }), " 開始即時監控"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "live-quota-note",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "info",
											size: 15
										}), " 讀取目前分享畫面，不使用範例圖；鎖定後只分析指定位置"]
									})
								] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `dropzone device-${deviceMode} ${dragging ? "dragging" : ""} ${preview ? "has-preview" : ""}`,
										onDragOver: (event) => {
											event.preventDefault();
											setDragging(true);
										},
										onDragLeave: () => setDragging(false),
										onDrop,
										onClick: () => inputRef.current?.click(),
										role: "button",
										tabIndex: 0,
										onKeyDown: (event) => event.key === "Enter" && inputRef.current?.click(),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											ref: inputRef,
											type: "file",
											accept: "image/png,image/jpeg,image/webp",
											onChange: onFile,
											hidden: true
										}), preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: preview,
											alt: "已貼上或選取的牌路截圖預覽"
										}) : deviceMode === "mobile" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "upload-icon",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
													name: "scan",
													size: 30
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "選擇手機截圖" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "從相簿選擇完整牌路圖片，選取後會立即開始分析" })
										] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "paste-shortcut",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Ctrl" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "＋" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "V" })
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "截圖後直接貼上" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "按 Win＋Shift＋S 截取完整牌路，回到本頁按 Ctrl＋V 立即分析" })
										] })]
									}),
									isTrial && !preview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "sample-road-button",
										type: "button",
										onClick: () => void loadSample(),
										disabled: status === "reading",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "沒有截圖？" }), "點此載入範例圖片測試"]
									}),
									!preview && deviceMode === "mobile" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "capture-guide",
										"aria-label": "手機操作教學",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mobile-guide",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "capture-guide-title",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
														name: "scan",
														size: 17
													}) }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "手機操作" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "建議方式" })
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "1" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "在遊戲畫面截取完整牌路，需包含大路與下方三路。" })] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "回到本頁，點選上方「選擇手機截圖」。" })] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "從相簿選擇剛才的截圖，系統就會自動分析。" })] })
											] })]
										})
									}),
									deviceMode === "desktop" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `quick-paste desktop-paste ${pasteMessage ? "has-message" : ""}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: pasteFromClipboard,
											disabled: trialUnavailable || status === "reading",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
												name: "paste",
												size: 17
											}), " 從剪貼簿貼上"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status === "reading" ? "正在辨識牌路…" : pasteMessage || "貼上剛截取的完整牌路圖片" })]
									}),
									trialUnavailable ? lineCta : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "live-quota-note",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											name: "info",
											size: 15
										}), " 截圖貼上後自動分析；成功產生結果才扣 1 局"]
									}),
									preview && !trialUnavailable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "text-button",
										onClick: () => inputRef.current?.click(),
										children: "選擇其他截圖"
									})
								] }),
								trialUnavailable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "trial-ended",
									role: "status",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: trialDisabled ? "此 IP 的免費試用已停用" : "免費試用次數已用完" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "請聯繫官方客服 LINE @mt7777 了解正式版。" })]
								}),
								analysisError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "analysis-error",
									role: "alert",
									children: analysisError
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "panel result-panel",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "panel-heading",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "02" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "牌路訊號整理" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "第二步：查看下三路與下一局牌路推估" })] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `status-pill ${status === "ready" ? "done" : ""}`,
										children: resultStatus
									})]
								}),
								isTrial && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "result-trial-quota",
									"aria-label": `剩餘 ${Math.max(0, usageLimit - usedToday)} / ${usageLimit} 局`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "免費試用剩餘" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [Math.max(0, usageLimit - usedToday), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
											"／",
											usageLimit,
											" 局"
										] })] })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "如需獲取正式版請洽詢官方客服 LINE @mt7777" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: trial?.lineUrl,
											target: "_blank",
											rel: "noreferrer",
											onClick: () => trackSupportClick("result_quota"),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
												name: "chat",
												size: 17
											}), " 聯繫客服"]
										})
									]
								}),
								prediction ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ratio-cards",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ratio-card player",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "閒家｜牌路分配" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [prediction.player.toFixed(1), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "%" })] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${prediction.player}%` } }) }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
												"已辨識大路：",
												stats.player,
												" 閒"
											] })
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ratio-card banker",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "莊家｜牌路分配" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [prediction.banker.toFixed(1), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "%" })] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${prediction.banker}%` } }) }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
												"已辨識大路：",
												stats.banker,
												" 莊"
											] })
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mini-stats",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "辨識範圍" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: prediction.signal })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "有效訊號" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [snapshot?.markerCount ?? 0, " 個"] })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "訊號判讀" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: prediction.strength })] })
									]
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ratio-cards empty",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ratio-card empty",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "尚未辨識" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["—", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "%" })] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: "0%" } }) }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "請上傳截圖開始分析" })
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ratio-card empty",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "尚未辨識" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["—", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "%" })] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: "0%" } }) }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "請上傳截圖開始分析" })
										]
									})]
								}),
								snapshot?.mode === "road-board" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "road-sources",
									"aria-label": "各牌路辨識數量",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["大路 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: snapshot.outcomes.length })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["大眼路 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: snapshot.bigEyeRoad.length })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["小路 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: snapshot.smallRoad.length })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["蟑螂路 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: snapshot.cockroachRoad.length })] })
									]
								}),
								status === "ready" && visibleFeedback && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `learning-feedback ${visibleFeedback.suggestedActual ? "detected" : ""}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "learning-feedback-heading",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "模型自我校準" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
												"已累積 ",
												learningTotal,
												" 局回報"
											] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: visibleFeedback.suggestedActual ? `系統辨識上一局開出「${labels[visibleFeedback.suggestedActual]}」，請確認實際結果` : `目前最高訊號為「${labels[visibleFeedback.predictedSide]}」，開牌後實際開出什麼？` }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "請直接選擇實際結果。系統會自行判斷是否命中；和局會另外記錄，不列入莊閒命中率。" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "learning-feedback-actions",
											children: [
												"B",
												"P",
												"T"
											].map((outcome) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												className: `${outcome === "B" ? "banker" : outcome === "P" ? "player" : "tie"} ${visibleFeedback.suggestedActual === outcome ? "suggested" : ""}`,
												disabled: feedbackSubmitting,
												onClick: () => void submitFeedback(visibleFeedback, outcome),
												children: [
													"開",
													labels[outcome],
													visibleFeedback.suggestedActual === outcome ? "（系統辨識）" : ""
												]
											}, outcome))
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "learning-skip",
											disabled: feedbackSubmitting,
											onClick: () => skipFeedback(visibleFeedback),
											children: "不確定，略過本局"
										})
									]
								}),
								feedbackReceipt && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "learning-receipt",
									role: "status",
									children: feedbackReceipt
								}),
								learningError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "learning-error",
									role: "alert",
									children: learningError
								})
							]
						})]
					}),
					isTrial && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrialGrowthContent, { lineUrl: trial?.lineUrl ?? SUPPORT_LINE_URL })
				]
			}),
			isTrial && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				className: "floating-support-cta",
				href: trial?.lineUrl,
				target: "_blank",
				rel: "noreferrer",
				"aria-label": "聯繫官方客服",
				onClick: () => trackSupportClick("floating_button"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					name: "chat",
					size: 19
				}), " 專人服務"]
			})
		]
	});
}
//#endregion
export { RoadAnalyzer as default };
