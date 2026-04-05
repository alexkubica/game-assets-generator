"use client";

import { useEffect, useRef } from "react";

type Props = {
  imageAssetPath: string;
  spriteId: string;
  cellWidth: number;
  cellHeight: number;
  fps: number;
  frameCount: number;
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

async function buildChromaKeyedDataUrl(
  imageAssetPath: string,
  chromaKeyColor: string | null,
  chromaKeyTolerance: number,
) {
  if (!chromaKeyColor) {
    return imageAssetPath;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Unable to load sprite image for chroma keying."));
    nextImage.src = imageAssetPath;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create a canvas context for chroma keying.");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { r, g, b } = hexToRgb(chromaKeyColor);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const red = imageData.data[index]!;
    const green = imageData.data[index + 1]!;
    const blue = imageData.data[index + 2]!;
    const distance = Math.sqrt((red - r) ** 2 + (green - g) ** 2 + (blue - b) ** 2);

    if (distance <= chromaKeyTolerance) {
      imageData.data[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function PhaserSpritePlayer({
  imageAssetPath,
  spriteId,
  cellWidth,
  cellHeight,
  fps,
  frameCount,
  chromaKeyColor,
  chromaKeyTolerance,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let destroyed = false;
    let game: { destroy: (removeCanvas: boolean, noReturn?: boolean) => void } | null = null;

    async function mount() {
      const PhaserModule = await import("phaser");

      if (destroyed || !containerRef.current) {
        return;
      }

      const Phaser = PhaserModule.default;
      const textureKey = `sprite-${spriteId}`;
      const animationKey = `anim-${spriteId}`;
      const textureSource = await buildChromaKeyedDataUrl(
        imageAssetPath,
        chromaKeyColor,
        chromaKeyTolerance,
      );

      if (destroyed || !containerRef.current) {
        return;
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 420,
        height: 420,
        transparent: true,
        scene: {
          preload() {
            this.load.spritesheet(textureKey, textureSource, {
              frameWidth: cellWidth,
              frameHeight: cellHeight,
            });
          },
          create() {
            const frameTotal = Math.max(frameCount, 1);

            this.anims.create({
              key: animationKey,
              frames: this.anims.generateFrameNumbers(textureKey, {
                start: 0,
                end: Math.max(frameTotal - 1, 0),
              }),
              frameRate: fps,
              repeat: -1,
            });

            const sprite = this.add.sprite(210, 210, textureKey, 0);
            const scale = Math.min(300 / cellWidth, 300 / cellHeight);

            sprite.setScale(scale);
            sprite.play(animationKey);
          },
        },
        backgroundColor: "rgba(0,0,0,0)",
      });
    }

    void mount();

    return () => {
      destroyed = true;
      game?.destroy(true);
    };
  }, [
    cellHeight,
    cellWidth,
    chromaKeyColor,
    chromaKeyTolerance,
    fps,
    frameCount,
    imageAssetPath,
    spriteId,
  ]);

  return <div ref={containerRef} className="h-[420px] w-full overflow-hidden rounded-[1.75rem]" />;
}
