import type { jsPDF } from 'jspdf';
import type { BlockType, Playlist, Project, Song } from './types';
import { BLOCKS, BLOCK_TYPES } from './types';
import { blockHasContent, lineOf, rowsOf, screensOf, tagsOf } from './blocks';
import { sourceLabel } from './source';
import { playlistSongs } from './store';
import { formatDate } from './util';

/**
 * Last-resort paper fallback for when the device dies mid-show.
 * Black ink on white paper — the one artefact here that is deliberately not
 * dark, because it gets printed. Priorities in order: running order,
 * reposition flags, then the codes per song. Legibility over looks.
 */

const M = 14; // page margin, mm
const PAGE_W = 297; // A4 landscape
const PAGE_H = 210;

/**
 * jsPDF's built-in fonts are Latin-1 only: an arrow or em dash comes out as
 * garbage rather than as nothing, which is worse. Transliterate before
 * anything reaches the page.
 */
function ascii(s: string): string {
  return s
    .replace(/[→➡➔]/g, '->')
    .replace(/[←]/g, '<-')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[…]/g, '...')
    .replace(/[·•●]/g, '*')
    .replace(/[▼]/g, 'v')
    // Anything still outside Latin-1 becomes a dot rather than mojibake.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xff]/g, '.');
}

interface TextOpts {
  font?: 'helvetica' | 'courier';
  style?: 'normal' | 'bold';
  size?: number;
  maxW?: number;
  gray?: number;
  align?: 'left' | 'right';
}

/**
 * Draw text at (x, y) and return the y below it. Wraps to `maxW` using the
 * real font metrics, so nothing ever runs off the edge of the page.
 */
function put(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  o: TextOpts = {},
): number {
  const { font = 'helvetica', style = 'normal', size = 11, maxW, gray } = o;
  doc.setFont(font, style).setFontSize(size);
  if (gray !== undefined) doc.setTextColor(gray, gray, gray);

  const clean = ascii(text);
  const lines: string[] = maxW
    ? (doc.splitTextToSize(clean, maxW) as string[])
    : [clean];
  const lh = size * 0.42; // pt -> mm, with leading

  lines.forEach((line, i) => {
    doc.text(line, x, y + i * lh, o.align === 'right' ? { align: 'right' } : undefined);
  });

  if (gray !== undefined) doc.setTextColor(0, 0, 0);
  return y + lines.length * lh;
}

/**
 * jsPDF is loaded on demand. Exporting is a prep-desk action, and nothing
 * that only matters before the show belongs in the boot path of the live view.
 */
export async function exportPlaylistPdf(
  project: Project,
  playlist: Playlist,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const songs = playlistSongs(project, playlist);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  runningOrderPage(doc, project, playlist, songs);
  songs.forEach((song, i) => {
    doc.addPage();
    songPage(doc, song, i, songs);
  });

  const safe = `${project.name}-${playlist.name}-${playlist.date}`
    .replace(/[^a-z0-9-]+/gi, '_')
    .toLowerCase();
  doc.save(`cuecard-${safe}.pdf`);
}

/** Page 1: the whole set at a glance, with every reposition flagged. */
function runningOrderPage(
  doc: jsPDF,
  project: Project,
  playlist: Playlist,
  songs: Song[],
) {
  put(doc, playlist.name, M, M + 6, { size: 22, style: 'bold' });
  put(
    doc,
    `${project.name}  -  ${formatDate(playlist.date)}  -  ${songs.length} songs`,
    M,
    M + 13,
    { size: 11 },
  );
  doc.setDrawColor(180, 180, 180).line(M, M + 17, PAGE_W - M, M + 17);

  const gutter = 12;
  const colW = (PAGE_W - M * 2 - gutter) / 2;
  const colX = [M, M + colW + gutter];
  const perCol = Math.ceil(songs.length / 2);
  const top = M + 26;
  let y = top;

  songs.forEach((song, i) => {
    if (i === perCol) y = top;
    const x = colX[i < perCol ? 0 : 1];

    put(doc, `${i + 1}.`, x, y, { size: 13, style: 'bold' });
    y = put(doc, song.title || 'Untitled', x + 11, y, {
      size: 13,
      style: 'bold',
      maxW: colW - 11,
    });

    if (song.repositionDuring) {
      y = put(doc, `during: ${song.repositionDuring}`, x + 11, y + 1.5, {
        size: 9,
        maxW: colW - 11,
      });
    }
    if (song.repositionAfter) {
      y = put(doc, `AFTER -> ${song.repositionAfter}`, x + 11, y + 1.5, {
        size: 9,
        style: 'bold',
        maxW: colW - 11,
      });
    }
    y += 4;
  });

  footer(doc, 'Running order');
}

/** One page per song: big title, the codes, and the repositions boxed. */
function songPage(doc: jsPDF, song: Song, i: number, all: Song[]) {
  put(doc, `${i + 1}. ${song.title || 'Untitled'}`, M, M + 8, {
    size: 26,
    style: 'bold',
    maxW: PAGE_W - M * 2 - 70,
  });
  put(doc, `next: ${all[i + 1]?.title ?? 'END OF SET'}`, PAGE_W - M, M + 8, {
    size: 10,
    align: 'right',
  });
  doc.setDrawColor(160, 160, 160).line(M, M + 12, PAGE_W - M, M + 12);

  let y = M + 21;
  if (song.repositionDuring) {
    y = banner(doc, y, 'MOVE DURING THIS SONG', song.repositionDuring);
  }

  const gutter = 12;
  const colW = (PAGE_W - M * 2 - gutter) / 2;
  const left = M;
  const right = M + colW + gutter;

  /*
   * Paper ignores the screen template deliberately. The grid exists to put
   * things where the operator's eye already is; on a sheet held under a torch
   * that buys nothing, and dropping a block because it wasn't placed on screen
   * would lose information exactly when this page is the last resort. So:
   * every block the song has, in library order, balanced across two columns.
   */
  const filled = BLOCK_TYPES.filter((b) => blockHasContent(song, b));
  const half = Math.ceil(filled.length / 2);

  let ly = y;
  let ry = y;
  filled.forEach((block, n) => {
    const first = n < half;
    const x = first ? left : right;
    const at = first ? ly : ry;
    const end = list(doc, x, at, colW, BLOCKS[block].label.toUpperCase(), pdfRows(song, block));
    if (first) ly = end;
    else ry = end;
  });

  if (song.repositionAfter) {
    banner(
      doc,
      Math.min(Math.max(ly, ry) + 4, PAGE_H - M - 20),
      'AFTER THIS SONG - REPOSITION BEFORE NEXT',
      song.repositionAfter,
    );
  }

  footer(doc, `${i + 1} / ${all.length}`);
}

function list(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  heading: string,
  rows: string[],
): number {
  if (rows.length === 0) return y;

  put(doc, heading, x, y, { size: 8.5, style: 'bold', gray: 90 });
  y += 5.5;

  // Courier so the camera column lines up down the page.
  rows.forEach((r) => {
    if (y > PAGE_H - M - 8) return;
    y = put(doc, r, x, y, { font: 'courier', style: 'bold', size: 14, maxW: w });
    y += 1.5;
  });
  return y + 5;
}

function banner(doc: jsPDF, y: number, kicker: string, text: string): number {
  const w = PAGE_W - M * 2;
  doc.setFont('helvetica', 'bold').setFontSize(14);
  const lines = doc.splitTextToSize(ascii(text), w - 8) as string[];
  const h = 9 + lines.length * 6;

  doc.setFillColor(20, 20, 20).rect(M, y - 5, w, h, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold').setFontSize(7.5);
  doc.text(kicker, M + 4, y);
  doc.setFontSize(14);
  lines.forEach((l, i) => doc.text(l, M + 4, y + 7.5 + i * 6));
  doc.setTextColor(0, 0, 0);

  return y + h + 4;
}

function footer(doc: jsPDF, right: string) {
  put(doc, 'cuecard - paper fallback', M, PAGE_H - 6, { size: 8, gray: 140 });
  put(doc, right, PAGE_W - M, PAGE_H - 6, {
    size: 8,
    gray: 140,
    align: 'right',
  });
}

/** A block rendered as printable lines, whatever shape it is. */
function pdfRows(song: Song, block: BlockType): string[] {
  switch (BLOCKS[block].kind) {
    case 'rows':
      return rowsOf(song.blocks, block).map(
        // Courier keeps the camera column aligned down the page.
        (r) => `${(r.a || '-').padEnd(4, ' ')}${r.b}${r.c ? `   (${r.c})` : ''}`,
      );
    case 'tags':
      return tagsOf(song.blocks, block);
    case 'line':
      return [lineOf(song.blocks, block)];
    case 'screens':
      // Paper spells the timeline out left to right; a coloured bar is no use
      // under a torch, but "LED L: 04 > 03 > 04" is.
      return screensOf(song.blocks, block).map((r) => {
        const seq = r.segments
          .map((sg) => sourceLabel(sg.source))
          .join(' > ');
        return `${(r.screen || '-').padEnd(8, ' ')}${seq}`;
      });
  }
}
