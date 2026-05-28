import EagleIdle from "./pieces/EagleIdle.svg?url";
import OwlBlink from "./pieces/OwlBlink.svg?url";
import ToucanIdle from "./pieces/ToucanIdle.svg?url";

export interface TileSprite {
  name: string;
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  duration: number;
}

export const TILE_SPRITES: TileSprite[] = [
  {
    name: "OwlBlink",
    src: OwlBlink,
    frameWidth: 32,
    frameHeight: 32,
    frames: 5,
    duration: 1500,
  },
  {
    name: "EagleIdle",
    src: EagleIdle,
    frameWidth: 32,
    frameHeight: 32,
    frames: 4,
    duration: 960,
  },
  {
    name: "ToucanIdle",
    src: ToucanIdle,
    frameWidth: 32,
    frameHeight: 32,
    frames: 4,
    duration: 1120,
  },
];

export function pickTileSprite(): TileSprite {
  return TILE_SPRITES[Math.floor(Math.random() * TILE_SPRITES.length)];
}
