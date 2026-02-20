import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

const SIZE = 1080;
const BG = { r: 18, g: 18, b: 22 };
const TEXT_COLOR = '#ffffff';
const ACCENT_COLOR = '#78c8b4';

@Injectable()
export class LevelImageService {
  async createLevelImageBuffer(level: number): Promise<Buffer> {
    const svg = `
      <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="38%" text-anchor="middle" dy="0.25em" font-family="Arial, sans-serif" font-size="52" fill="${TEXT_COLOR}">Твой уровень</text>
        <text x="50%" y="62%" text-anchor="middle" dy="0.25em" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="${ACCENT_COLOR}">${level} / 100</text>
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
