// Pure geometry helpers for highlight overlay rect merging.
// No DOM side effects — safe to import from tests and Node.js.

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
	left: number;
	top: number;
	right: number;
	bottom: number;
}

function makeRect(x: number, y: number, w: number, h: number): Rect {
	return { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h };
}

// Two rects are on the same line if they overlap vertically by at least half
// the shorter rect's height. This handles fonts where italic/bold glyphs have
// different ascenders/descenders (e.g. EB Garamond italic vs roman).
export function rectsOnSameLine(aY: number, aB: number, bY: number, bB: number): boolean {
	const overlap = Math.min(aB, bB) - Math.max(aY, bY);
	return overlap >= Math.min(aB - aY, bB - bY) * 0.5;
}

// Merge adjacent rects on the same line into single rects. Uses a stable
// line-reference anchor (the first rect in each line group) to prevent
// cascading merges when italic/bold glyphs extend the accumulated height.
export function mergeOverlayRects(rects: Rect[]): Rect[] {
	const merged: Rect[] = [];
	let x = 0, y = 0, r = 0, b = 0;
	let lineRefY = 0, lineRefB = 0;
	let hasRect = false;

	for (let i = 0; i < rects.length; i++) {
		const rect = rects[i];
		if (!hasRect) {
			x = rect.x; y = rect.y; r = rect.right; b = rect.bottom;
			lineRefY = rect.y; lineRefB = rect.bottom;
			hasRect = true;
		} else if (rectsOnSameLine(lineRefY, lineRefB, rect.y, rect.bottom)) {
			y = Math.min(y, rect.y);
			b = Math.max(b, rect.bottom);
			r = Math.max(r, rect.right);
		} else {
			merged.push(makeRect(x, y, r - x, b - y));
			x = rect.x; y = rect.y; r = rect.right; b = rect.bottom;
			lineRefY = rect.y; lineRefB = rect.bottom;
		}
	}
	if (hasRect) {
		merged.push(makeRect(x, y, r - x, b - y));
	}
	return merged;
}

// Adjust merged per-line rects so adjacent overlays tile with no gaps
// or overlaps.  Each line's height becomes the y-distance to the next
// line (≈ CSS line-height); the last line keeps its glyph-bbox height.
export function tileOverlayRects(rects: Rect[]): Rect[] {
	if (rects.length <= 1) return rects;
	const tiled: Rect[] = [];
	for (let i = 0; i < rects.length; i++) {
		if (i < rects.length - 1) {
			const lineSpacing = rects[i + 1].y - rects[i].y;
			if (lineSpacing > 0 && lineSpacing < rects[i].height * 2) {
				tiled.push(makeRect(rects[i].x, rects[i].y, rects[i].width, lineSpacing));
				continue;
			}
		}
		tiled.push(rects[i]);
	}
	return tiled;
}
