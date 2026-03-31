import { describe, it, expect } from 'vitest';
import { rectsOnSameLine, mergeOverlayRects, tileOverlayRects, Rect } from './highlighter-rects';

const R = (x: number, y: number, w: number, h: number): Rect =>
	({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h });

describe('rectsOnSameLine', () => {
	it('identical rects → same line', () => {
		expect(rectsOnSameLine(100, 120, 100, 120)).toBe(true);
	});

	it('italic with slight offset → same line', () => {
		expect(rectsOnSameLine(100, 120, 97, 124)).toBe(true);
	});

	it('large italic metric difference → same line', () => {
		expect(rectsOnSameLine(100, 120, 95, 128)).toBe(true);
	});

	it('different lines with normal spacing → not same line', () => {
		expect(rectsOnSameLine(100, 120, 126, 146)).toBe(false);
	});

	it('different lines with tight spacing → not same line', () => {
		expect(rectsOnSameLine(100, 120, 122, 142)).toBe(false);
	});

	it('no vertical overlap → not same line', () => {
		expect(rectsOnSameLine(100, 120, 200, 220)).toBe(false);
	});
});

describe('mergeOverlayRects', () => {
	it('empty input → empty output', () => {
		expect(mergeOverlayRects([])).toEqual([]);
	});

	it('single rect → returned as-is', () => {
		const result = mergeOverlayRects([R(10, 100, 500, 20)]);
		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(10);
		expect(result[0].width).toBe(500);
	});

	it('normal text: same-line rects merge into one', () => {
		const result = mergeOverlayRects([
			R(10, 100, 100, 20),
			R(110, 100, 80, 20),
			R(190, 100, 200, 20),
		]);
		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(10);
		expect(result[0].right).toBe(390);
		expect(result[0].y).toBe(100);
		expect(result[0].height).toBe(20);
	});

	it('multi-line text: separate rect per line', () => {
		const result = mergeOverlayRects([
			R(10, 100, 500, 20),
			R(10, 126, 500, 20),
			R(10, 152, 300, 20),
		]);
		expect(result).toHaveLength(3);
		expect(result[0].y).toBe(100);
		expect(result[1].y).toBe(126);
		expect(result[2].y).toBe(152);
	});

	it('italic on same line: merges despite different y/h', () => {
		const result = mergeOverlayRects([
			R(10, 100, 100, 20),
			R(110, 97, 60, 24),
			R(170, 100, 200, 20),
		]);
		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(10);
		expect(result[0].right).toBe(370);
		expect(result[0].y).toBe(97);
		expect(result[0].bottom).toBe(121);
	});

	it('bold+italic combined: merges on same line', () => {
		const result = mergeOverlayRects([
			R(10, 100, 80, 20),
			R(90, 98, 70, 23),
			R(160, 96, 50, 26),
			R(210, 100, 100, 20),
		]);
		expect(result).toHaveLength(1);
		expect(result[0].y).toBe(96);
		expect(result[0].bottom).toBe(122);
	});

	it('EB Garamond italic: no cascading merge across lines', () => {
		const result = mergeOverlayRects([
			R(10, 100, 100, 20),
			R(110, 90, 60, 38),
			R(170, 100, 200, 20),
			R(10, 126, 500, 20),
		]);
		expect(result).toHaveLength(2);
		expect(result[0].x).toBe(10);
		expect(result[0].right).toBe(370);
		expect(result[0].y).toBe(90);
		expect(result[1].x).toBe(10);
		expect(result[1].y).toBe(126);
		expect(result[1].height).toBe(20);
	});

	it('multiple italic words across lines: each line merges independently', () => {
		const result = mergeOverlayRects([
			R(10, 100, 80, 20),
			R(90, 97, 50, 24),
			R(140, 100, 300, 20),
			R(10, 130, 100, 20),
			R(110, 127, 40, 24),
			R(150, 130, 200, 20),
		]);
		expect(result).toHaveLength(2);
		expect(result[0].right).toBe(440);
		expect(result[1].right).toBe(350);
	});

	it('adjacent highlights: independent merge calls stay independent', () => {
		const fullParagraph = mergeOverlayRects([
			R(10, 100, 500, 20),
			R(10, 126, 500, 20),
			R(10, 152, 300, 20),
		]);
		const textSelection = mergeOverlayRects([
			R(200, 126, 150, 20),
		]);
		expect(fullParagraph).toHaveLength(3);
		expect(textSelection).toHaveLength(1);
		expect(textSelection[0].x).toBe(200);
		expect(textSelection[0].width).toBe(150);
	});
});

describe('tileOverlayRects', () => {
	it('empty → empty', () => {
		expect(tileOverlayRects([])).toEqual([]);
	});

	it('single rect → unchanged', () => {
		const result = tileOverlayRects([R(10, 100, 500, 25)]);
		expect(result).toHaveLength(1);
		expect(result[0].height).toBe(25);
	});

	it('Garamond-like: shrinks height to line spacing (no overlap)', () => {
		// glyph bbox 25px but line spacing 21.6px
		const result = tileOverlayRects([
			R(10, 100, 500, 25),
			R(10, 121.6, 500, 25),
			R(10, 143.2, 300, 25),
		]);
		expect(result).toHaveLength(3);
		expect(result[0].height).toBeCloseTo(21.6);
		expect(result[1].height).toBeCloseTo(21.6);
		expect(result[2].height).toBe(25); // last line keeps glyph bbox
	});

	it('System-font-like: grows height to line spacing (no gap)', () => {
		// glyph bbox 19px but line spacing 28.8px
		const result = tileOverlayRects([
			R(10, 100, 500, 19),
			R(10, 128.8, 500, 19),
			R(10, 157.6, 300, 19),
		]);
		expect(result).toHaveLength(3);
		expect(result[0].height).toBeCloseTo(28.8);
		expect(result[1].height).toBeCloseTo(28.8);
		expect(result[2].height).toBe(19);
	});

	it('skips tiling when gap exceeds 2x height', () => {
		const result = tileOverlayRects([
			R(10, 100, 500, 20),
			R(10, 200, 500, 20),
		]);
		expect(result[0].height).toBe(20);
		expect(result[1].height).toBe(20);
	});

	it('preserves x and width', () => {
		const result = tileOverlayRects([
			R(50, 100, 400, 25),
			R(50, 121, 400, 25),
		]);
		expect(result[0].x).toBe(50);
		expect(result[0].width).toBe(400);
	});
});
