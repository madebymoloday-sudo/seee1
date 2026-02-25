import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

const SIZE = 1080;
const BG = { r: 250, g: 250, b: 252 };
const LABEL_COLOR = '#6b7280';
const NUMBER_COLOR = '#000000';

@Injectable()
export class LevelImageService {
  async createLevelImageBuffer(level: number): Promise<Buffer> {
    const svg = `
      <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="35%" text-anchor="middle" dy="0.25em" font-family="Arial, sans-serif" font-size="48" fill="${LABEL_COLOR}">Seee</text>
        <text x="50%" y="52%" text-anchor="middle" dy="0.25em" font-family="Arial, sans-serif" font-size="36" fill="${LABEL_COLOR}">Твой уровень</text>
        <text x="50%" y="72%" text-anchor="middle" dy="0.25em" font-family="Arial, sans-serif" font-size="140" font-weight="bold" fill="${NUMBER_COLOR}">${level}</text>
        <text x="50%" y="85%" text-anchor="middle" dy="0.25em" font-family="Arial, sans-serif" font-size="32" fill="${LABEL_COLOR}">из 100</text>
      </svg>
    `;
    return sharp({
      create: {
        width: SIZE,
        height: SIZE,
        channels: 3,
        background: BG,
      },
    })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }
}
