"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type Props = {
  assetPath: string;
  mimeType: string;
  imageWidth: number;
  imageHeight: number;
  cellWidth: number;
  cellHeight: number;
  frameCount: number;
  selectedFrameNumbers?: number[];
  fps: number;
  animate: boolean;
  alt: string;
  className?: string;
};

function isRenderableSpritesheet({
  imageWidth,
  imageHeight,
  cellWidth,
  cellHeight,
  frameCount,
}: Pick<Props, "imageWidth" | "imageHeight" | "cellWidth" | "cellHeight" | "frameCount">) {
  return (
    frameCount > 1 &&
    cellWidth > 0 &&
    cellHeight > 0 &&
    imageWidth >= cellWidth &&
    imageHeight >= cellHeight &&
    imageWidth % cellWidth === 0 &&
    imageHeight % cellHeight === 0
  );
}

export function SpritePreviewTile({
  assetPath,
  mimeType,
  imageWidth,
  imageHeight,
  cellWidth,
  cellHeight,
  frameCount,
  selectedFrameNumbers,
  fps,
  animate,
  alt,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldAnimateSheet =
    animate && mimeType !== "image/gif" && isRenderableSpritesheet({ imageWidth, imageHeight, cellWidth, cellHeight, frameCount });

  useEffect(() => {
    if (!shouldAnimateSheet || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let cancelled = false;
    let frameIndex = 0;
    let intervalId: number | null = null;
    const image = new window.Image();
    image.crossOrigin = "anonymous";

    const drawFrame = () => {
      if (cancelled) {
        return;
      }

      const columns = Math.max(Math.floor(imageWidth / cellWidth), 1);
      const selectedFrameIndex =
        selectedFrameNumbers && selectedFrameNumbers.length > 0
          ? Math.max((selectedFrameNumbers[frameIndex] ?? 1) - 1, 0)
          : frameIndex;
      const sourceX = (selectedFrameIndex % columns) * cellWidth;
      const sourceY = Math.floor(selectedFrameIndex / columns) * cellHeight;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        cellWidth,
        cellHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const cycleLength =
        selectedFrameNumbers && selectedFrameNumbers.length > 0 ? selectedFrameNumbers.length : Math.max(frameCount, 1);
      frameIndex = (frameIndex + 1) % cycleLength;
    };

    image.onload = () => {
      if (cancelled) {
        return;
      }

      drawFrame();
      intervalId = window.setInterval(drawFrame, Math.max(Math.round(1000 / Math.max(fps, 1)), 40));
    };
    image.src = assetPath;

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [assetPath, cellHeight, cellWidth, fps, frameCount, imageHeight, imageWidth, selectedFrameNumbers, shouldAnimateSheet]);

  if (shouldAnimateSheet) {
    return (
      <canvas
        ref={canvasRef}
        width={cellWidth}
        height={cellHeight}
        aria-label={alt}
        className={className}
      />
    );
  }

  return (
    <Image
      src={assetPath}
      alt={alt}
      width={Math.max(imageWidth, 1)}
      height={Math.max(imageHeight, 1)}
      unoptimized
      className={className}
    />
  );
}
