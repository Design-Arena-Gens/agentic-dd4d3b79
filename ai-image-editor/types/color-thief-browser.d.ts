declare module "color-thief-browser" {
  type Palette = number[][];

  export default class ColorThief {
    getColor(image: HTMLImageElement, quality?: number): number[];
    getPalette(image: HTMLImageElement, colorCount?: number, quality?: number): Palette;
  }
}
