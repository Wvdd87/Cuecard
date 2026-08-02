import type { jsPDF } from 'jspdf';
import type { Playlist, Project, Song } from './types';
import { CARD_LABELS, CARD_LANES, cameraById, pinsInLane, trackBlocks } from './types';
import { playlistSongs } from './store';
import { formatDate } from './util';

/**
 * Last-resort paper fallback for when the device dies mid-show.
 * Black ink on white paper — the one artefact here that is deliberately not
 * dark, because it gets printed. The timeline is spelled out in reading order
 * with its percentages, since a coloured bar is no use under a torch.
 */

const M = 14;
const PAGE_W = 297;
const PAGE_H = 210;

/** jsPDF's built-in fonts are Latin-1 only: transliterate before printing. */
function ascii(s: string): string {
  return s
    .replace(/[→➡➔]/g, '->')
    .replace(/[←]/g, '<-')
    .replace(/[–—]/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[…]/g, '...')
    .replace(/[·•●]/g, '*')
    .replace(/[▼]/g, 'v')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0000-\u00ff]/g, '.');
}

interface TextOpts {
  font?: 'helvetica' | 'courier';
  style?: 'normal' | 'bold';
  size?: number;
  maxW?: number;
  gray?: number;
  align?: 'left' | 'right';
}

function put(doc: jsPDF, text: string, x: number, y: number, o: TextOpts = {}): number {
  const { font = 'helvetica', style = 'normal', size = 11, maxW, gray } = o;
  doc.setFont(font, style).setFontSize(size);
  if (gray !== undefined) doc.setTextColor(gray, gray, gray);

  const clean = ascii(text);
  const lines: string[] = maxW ? (doc.splitTextToSize(clean, maxW) as string[]) : [clean];
  const lh = size * 0.42;
  lines.forEach((line, i) =>
    doc.text(line, x, y + i * lh, o.align === 'right' ? { align: 'right' } : undefined),
  );
  if (gray !== undefined) doc.setTextColor(0, 0, 0);
  return y + lines.length * lh;
}

/**
 * jsPDF is loaded on demand — nothing that only matters before the show
 * belongs in the boot path of the live view.
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
    songPage(doc, project, song, i, songs);
  });

  const safe = `${project.name}-${playlist.name}-${playlist.date}`
    .replace(/[^a-z0-9-]+/gi, '_')
    .toLowerCase();
  doc.save(`cuecard-${safe}.pdf`);
}

function runningOrderPage(
  doc: jsPDF,
  project: Project,
  playlist: Playlist,
  songs: Song[],
) {
  put(doc, playlist.name, M, M + 6, { size: 22, style: 'bold' });
  put(doc, `${project.name}  -  ${formatDate(playlist.date)}  -  ${songs.length} songs`,
    M, M + 13, { size: 11 });
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
      size: 13, style: 'bold', maxW: colW - 11,
    });
    if (song.repositionAfter) {
      const cams = song.repositionAfter.cameras
        .map((id) => cameraById(project, id)?.label ?? id)
        .join(', ');
      y = put(doc, `AFTER -> ${cams ? cams + ': ' : ''}${song.repositionAfter.destination}`,
        x + 11, y + 1.5, { size: 9, style: 'bold', maxW: colW - 11 });
    }
    y += 4;
  });

  footer(doc, 'Running order');
}

function songPage(doc: jsPDF, project: Project, song: Song, i: number, all: Song[]) {
  put(doc, `${i + 1}. ${song.title || 'Untitled'}`, M, M + 8, {
    size: 26, style: 'bold', maxW: PAGE_W - M * 2 - 70,
  });
  put(doc, `next: ${all[i + 1]?.title ?? 'END OF SET'}`, PAGE_W - M, M + 8, {
    size: 10, align: 'right',
  });
  doc.setDrawColor(160, 160, 160).line(M, M + 12, PAGE_W - M, M + 12);

  let y = M + 21;
  const w = PAGE_W - M * 2;

  // Milestones in lane order, each with where it falls in the song.
  for (const lane of CARD_LANES) {
    const pins = pinsInLane(song, lane);
    if (pins.length === 0) continue;
    put(doc, CARD_LABELS[lane].toUpperCase(), M, y, {
      size: 8.5, style: 'bold', gray: 90,
    });
    y += 5.5;
    for (const pin of pins) {
      const d = pin.cardData;
      const at = `${Math.round(pin.positionPercent)}%`.padStart(4, ' ');
      let body = '';
      if (lane === 'first_shots') {
        body = project.cameras
          .map((c) => (d.shots?.[c.id] ? `${c.id} ${d.shots[c.id]}` : null))
          .filter(Boolean)
          .join('   ');
      } else if (lane === 'note') {
        body = d.text ?? '';
      } else {
        const cam = cameraById(project, d.camera)?.id ?? d.camera ?? '';
        body = `${cam} ${d.destination ?? d.text ?? ''}`.trim();
      }
      y = put(doc, `${at}  ${body}`, M, y, {
        font: 'courier', style: 'bold', size: 12, maxW: w,
      });
      y += 1.5;
    }
    y += 4;
  }

  // Screen tracks, in reading order with their share of the song.
  for (const t of project.tracks) {
    const blocks = trackBlocks(song, t.id);
    if (blocks.length === 0) continue;
    put(doc, t.name.toUpperCase(), M, y, { size: 8.5, style: 'bold', gray: 90 });
    y += 5.5;
    const line = blocks
      .map((b) => `${b.label || '-'} ${Math.round(b.widthPercent)}%`)
      .join('  >  ');
    y = put(doc, line, M, y, { font: 'courier', style: 'bold', size: 12, maxW: w });
    y += 5;
  }

  if (song.repositionAfter) {
    const cams = song.repositionAfter.cameras
      .map((id) => cameraById(project, id)?.label ?? id)
      .join(', ');
    banner(doc, Math.min(y + 4, PAGE_H - M - 20),
      'AFTER THIS SONG - REPOSITION BEFORE NEXT',
      `${cams ? cams + ': ' : ''}${song.repositionAfter.destination}`);
  }

  footer(doc, `${i + 1} / ${all.length}`);
}

function banner(doc: jsPDF, y: number, kicker: string, text: string): number {
  const w = PAGE_W - M * 2;
  doc.setFont('helvetica', 'bold').setFontSize(14);
  const lines = doc.splitTextToSize(ascii(text), w - 8) as string[];
  const h = 9 + lines.length * 6;
  doc.setFillColor(20, 20, 20).rect(M, y - 5, w, h, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(7.5);
  doc.text(kicker, M + 4, y);
  doc.setFontSize(14);
  lines.forEach((l, i) => doc.text(l, M + 4, y + 7.5 + i * 6));
  doc.setTextColor(0, 0, 0);
  return y + h + 4;
}

function footer(doc: jsPDF, right: string) {
  put(doc, 'cuecard - paper fallback', M, PAGE_H - 6, { size: 8, gray: 140 });
  put(doc, right, PAGE_W - M, PAGE_H - 6, { size: 8, gray: 140, align: 'right' });
}
