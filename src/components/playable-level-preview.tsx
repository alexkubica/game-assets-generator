"use client";

import { useEffect, useRef } from "react";

type SpriteOrientation = "left" | "right";
export type SpriteMotionState = "idle" | "walking" | "jumping";

export type PlayableSpriteStateConfig = {
  id: string;
  imageAssetPath: string;
  cellWidth: number;
  cellHeight: number;
  fps: number;
  frameCount: number;
  scale: number;
  sourceOrientation: SpriteOrientation;
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
};

type Props = {
  spritesByState: Partial<Record<SpriteMotionState, PlayableSpriteStateConfig>>;
};

const LEVEL_WIDTH = 768;
const LEVEL_HEIGHT = 960;
const PLAYER_TARGET_HEIGHT = 72;
const PLAYER_SPEED = 240;
const JUMP_VELOCITY = -640;
const FALL_GRAVITY_MULTIPLIER = 1.18;
const EARLY_RELEASE_GRAVITY_MULTIPLIER = 1.75;
const COYOTE_TIME_MS = 110;
const JUMP_BUFFER_MS = 140;
const PLAYER_SPAWN = { x: 136, y: 160 };
const PLATFORM_LAYOUT = [
  { x: 384, y: 930, width: 720, height: 36 },
  { x: 188, y: 816, width: 184, height: 24 },
  { x: 540, y: 736, width: 208, height: 24 },
  { x: 272, y: 652, width: 204, height: 24 },
  { x: 590, y: 572, width: 194, height: 24 },
  { x: 322, y: 492, width: 214, height: 24 },
  { x: 170, y: 410, width: 176, height: 24 },
  { x: 500, y: 330, width: 214, height: 24 },
  { x: 292, y: 248, width: 194, height: 24 },
  { x: 596, y: 172, width: 188, height: 24 },
] as const;

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

async function loadSpriteSource(
  imageAssetPath: string,
  chromaKeyColor: string | null,
  chromaKeyTolerance: number,
) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Unable to load sprite image for chroma keying."));
    nextImage.src = imageAssetPath;
  });

  if (!chromaKeyColor) {
    return {
      textureSource: imageAssetPath,
      imageWidth: image.width,
      imageHeight: image.height,
    };
  }

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
  return {
    textureSource: canvas.toDataURL("image/png"),
    imageWidth: image.width,
    imageHeight: image.height,
  };
}

export function PlayableLevelPreview({ spritesByState }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusShellRef = useRef<HTMLDivElement | null>(null);
  const pressedKeysRef = useRef({
    left: false,
    right: false,
    jumpHeld: false,
    jumpQueuedAt: 0,
    resetQueued: false,
  });
  const spriteDependencyKey = JSON.stringify(spritesByState);

  useEffect(() => {
    const focusShell = focusShellRef.current;

    if (!focusShell) {
      return;
    }

    const handlePointerDown = () => {
      focusShell.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          pressedKeysRef.current.left = true;
          event.preventDefault();
          break;
        case "ArrowRight":
          pressedKeysRef.current.right = true;
          event.preventDefault();
          break;
        case "ArrowUp":
        case " ":
        case "Spacebar":
          if (!event.repeat) {
            pressedKeysRef.current.jumpHeld = true;
            pressedKeysRef.current.jumpQueuedAt = performance.now();
          }
          event.preventDefault();
          break;
        case "r":
        case "R":
          if (!event.repeat) {
            pressedKeysRef.current.resetQueued = true;
          }
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          pressedKeysRef.current.left = false;
          event.preventDefault();
          break;
        case "ArrowRight":
          pressedKeysRef.current.right = false;
          event.preventDefault();
          break;
        case "ArrowUp":
        case " ":
        case "Spacebar":
          pressedKeysRef.current.jumpHeld = false;
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    const clearPressedKeys = () => {
      pressedKeysRef.current.left = false;
      pressedKeysRef.current.right = false;
      pressedKeysRef.current.jumpHeld = false;
      pressedKeysRef.current.jumpQueuedAt = 0;
      pressedKeysRef.current.resetQueued = false;
    };

    focusShell.focus();
    focusShell.addEventListener("pointerdown", handlePointerDown);
    focusShell.addEventListener("keydown", handleKeyDown);
    focusShell.addEventListener("keyup", handleKeyUp);
    focusShell.addEventListener("blur", clearPressedKeys);

    return () => {
      focusShell.removeEventListener("pointerdown", handlePointerDown);
      focusShell.removeEventListener("keydown", handleKeyDown);
      focusShell.removeEventListener("keyup", handleKeyUp);
      focusShell.removeEventListener("blur", clearPressedKeys);
    };
  }, [spriteDependencyKey]);

  useEffect(() => {
    if (!containerRef.current || !focusShellRef.current) {
      return;
    }

    const fallbackSprite = spritesByState.walking ?? spritesByState.idle ?? spritesByState.jumping ?? null;

    if (!fallbackSprite) {
      return;
    }

    const resolvedSprites: Record<SpriteMotionState, PlayableSpriteStateConfig> = {
      idle: spritesByState.idle ?? spritesByState.walking ?? spritesByState.jumping ?? fallbackSprite,
      walking: spritesByState.walking ?? spritesByState.idle ?? spritesByState.jumping ?? fallbackSprite,
      jumping: spritesByState.jumping ?? spritesByState.walking ?? spritesByState.idle ?? fallbackSprite,
    };
    let destroyed = false;
    let game: { destroy: (removeCanvas: boolean, noReturn?: boolean) => void } | null = null;

    async function mount() {
      const PhaserModule = await import("phaser");

      if (destroyed || !containerRef.current) {
        return;
      }

      const Phaser = PhaserModule.default;
      const platformTextureKey = "tester-platform";
      const stateEntries = await Promise.all(
        (Object.entries(resolvedSprites) as [SpriteMotionState, PlayableSpriteStateConfig][]).map(
          async ([state, sprite]) => {
            const textureKey = `tester-sprite-${state}-${sprite.id}`;
            const animationKey = `tester-anim-${state}-${sprite.id}`;
            const loadedSource = await loadSpriteSource(
              sprite.imageAssetPath,
              sprite.chromaKeyColor,
              sprite.chromaKeyTolerance,
            );

            return [
              state,
              {
                ...sprite,
                cellWidth:
                  sprite.frameCount <= 1 && sprite.cellWidth <= 1
                    ? loadedSource.imageWidth
                    : sprite.cellWidth,
                cellHeight:
                  sprite.frameCount <= 1 && sprite.cellHeight <= 1
                    ? loadedSource.imageHeight
                    : sprite.cellHeight,
                textureKey,
                animationKey,
                textureSource: loadedSource.textureSource,
              },
            ] as const;
          },
        ),
      );

      if (destroyed || !containerRef.current) {
        return;
      }

      const stateSprites = Object.fromEntries(stateEntries) as Record<
        SpriteMotionState,
        PlayableSpriteStateConfig & {
          textureKey: string;
          animationKey: string;
          textureSource: string;
        }
      >;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: LEVEL_WIDTH,
        height: LEVEL_HEIGHT,
        backgroundColor: "#0f1b35",
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 1400 },
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: LEVEL_WIDTH,
          height: LEVEL_HEIGHT,
        },
        scene: {
          preload() {
            for (const sprite of Object.values(stateSprites)) {
              this.load.spritesheet(sprite.textureKey, sprite.textureSource, {
                frameWidth: sprite.cellWidth,
                frameHeight: sprite.cellHeight,
              });
            }
          },
          create() {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x9fb0ce, 1);
            graphics.fillRoundedRect(0, 0, 64, 16, 5);
            graphics.lineStyle(2, 0xdce7ff, 0.35);
            graphics.strokeRoundedRect(0, 0, 64, 16, 5);
            graphics.generateTexture(platformTextureKey, 64, 16);
            graphics.destroy();

            const background = this.add.graphics();
            background.fillGradientStyle(0x0d1930, 0x172747, 0x0f1b35, 0x13223f, 1);
            background.fillRect(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
            background.lineStyle(1, 0x8fa1c4, 0.08);

            for (let x = 0; x <= LEVEL_WIDTH; x += 48) {
              background.moveTo(x, 0);
              background.lineTo(x, LEVEL_HEIGHT);
            }

            for (let y = 0; y <= LEVEL_HEIGHT; y += 48) {
              background.moveTo(0, y);
              background.lineTo(LEVEL_WIDTH, y);
            }

            background.strokePath();
            background.lineStyle(1, 0xa2b2d2, 0.04);

            for (let x = 24; x <= LEVEL_WIDTH; x += 48) {
              background.moveTo(x, 0);
              background.lineTo(x, LEVEL_HEIGHT);
            }

            for (let y = 24; y <= LEVEL_HEIGHT; y += 48) {
              background.moveTo(0, y);
              background.lineTo(LEVEL_WIDTH, y);
            }

            background.strokePath();

            const title = this.add.text(48, 40, "Playable Level", {
              fontFamily: "monospace",
              fontSize: "26px",
              color: "#f6f9ff",
            });
            title.setAlpha(0.92);

            const instructions = this.add.text(
              48,
              LEVEL_HEIGHT - 146,
              "Arrow keys move\nUp or Space jumps\nR resets the level\nSprite mirrors against its source orientation",
              {
                fontFamily: "monospace",
                fontSize: "22px",
                color: "#d6e0f4",
                align: "left",
                lineSpacing: 8,
              },
            );
            instructions.setAlpha(0.84);

            const platforms = this.physics.add.staticGroup();

            for (const platform of PLATFORM_LAYOUT) {
              const sprite = platforms
                .create(platform.x, platform.y, platformTextureKey)
                .setDisplaySize(platform.width, platform.height);
              const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
              body.updateFromGameObject();
              body.checkCollision.down = false;
              body.checkCollision.left = false;
              body.checkCollision.right = false;
            }

            for (const sprite of Object.values(stateSprites)) {
              const frameTotal = Math.max(sprite.frameCount, 1);

              if (!this.anims.exists(sprite.animationKey)) {
                this.anims.create({
                  key: sprite.animationKey,
                  frames: this.anims.generateFrameNumbers(sprite.textureKey, {
                    start: 0,
                    end: Math.max(frameTotal - 1, 0),
                  }),
                  frameRate: sprite.fps,
                  repeat: -1,
                });
              }
            }

            const initialSprite = stateSprites.idle;
            const player = this.physics.add.sprite(
              PLAYER_SPAWN.x,
              PLAYER_SPAWN.y,
              initialSprite.textureKey,
              0,
            );
            player.setCollideWorldBounds(true);
            player.setBounce(0);
            player.setDragX(1800);
            player.setMaxVelocity(PLAYER_SPEED, 900);

            this.physics.add.collider(player, platforms);
            this.physics.world.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
            this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
            let facingDirection: SpriteOrientation = "right";
            let activeState: SpriteMotionState = "idle";
            let lastGroundedAt = performance.now();

            function applySpriteState(nextState: SpriteMotionState) {
              if (activeState === nextState) {
                return;
              }

              activeState = nextState;
              const sprite = stateSprites[nextState];
              const spriteScale = (PLAYER_TARGET_HEIGHT / Math.max(sprite.cellHeight, 1)) * sprite.scale;
              player.setTexture(sprite.textureKey, 0);
              player.setScale(spriteScale);
              player.setSize(sprite.cellWidth * 0.52, sprite.cellHeight * 0.88);
              player.setOffset(sprite.cellWidth * 0.24, sprite.cellHeight * 0.12);
              player.play(sprite.animationKey, true);
            }

            function resetPlayer() {
              player.setPosition(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
              player.setVelocity(0, 0);
              player.setAcceleration(0, 0);
              activeState = "walking";
              applySpriteState("idle");
              facingDirection = initialSprite.sourceOrientation === "left" ? "left" : "right";
              player.setFlipX(initialSprite.sourceOrientation === "left");
              lastGroundedAt = performance.now();
              pressedKeysRef.current.jumpHeld = false;
              pressedKeysRef.current.jumpQueuedAt = 0;
            }

            resetPlayer();
            const handleReset = () => resetPlayer();
            window.addEventListener("level-tester-reset", handleReset as EventListener);

            this.events.on("update", () => {
              const now = performance.now();
              const wantsLeft = pressedKeysRef.current.left;
              const wantsRight = pressedKeysRef.current.right;
              const jumpQueuedRecently =
                pressedKeysRef.current.jumpQueuedAt > 0 && now - pressedKeysRef.current.jumpQueuedAt <= JUMP_BUFFER_MS;
              const wantsReset = pressedKeysRef.current.resetQueued;
              const body = player.body as Phaser.Physics.Arcade.Body;
              const isGrounded = body.blocked.down || body.touching.down;

              pressedKeysRef.current.resetQueued = false;

              if (isGrounded) {
                lastGroundedAt = now;
              }

              if (wantsReset) {
                resetPlayer();
                return;
              }

              if (wantsLeft && !wantsRight) {
                player.setVelocityX(-PLAYER_SPEED);
                facingDirection = "left";
              } else if (wantsRight && !wantsLeft) {
                player.setVelocityX(PLAYER_SPEED);
                facingDirection = "right";
              } else {
                player.setVelocityX(0);
              }

              const canUseCoyoteJump = now - lastGroundedAt <= COYOTE_TIME_MS;

              if (jumpQueuedRecently && canUseCoyoteJump) {
                player.setVelocityY(JUMP_VELOCITY);
                pressedKeysRef.current.jumpQueuedAt = 0;
                lastGroundedAt = -Infinity;
              }

              if (!isGrounded) {
                if (body.velocity.y > 0) {
                  body.setGravityY(1400 * (FALL_GRAVITY_MULTIPLIER - 1));
                } else if (!pressedKeysRef.current.jumpHeld) {
                  body.setGravityY(1400 * (EARLY_RELEASE_GRAVITY_MULTIPLIER - 1));
                } else {
                  body.setGravityY(0);
                }
              } else {
                body.setGravityY(0);
              }

              const nextState: SpriteMotionState = !isGrounded
                ? "jumping"
                : Math.abs(body.velocity.x) > 12
                  ? "walking"
                  : "idle";
              applySpriteState(nextState);

              const shouldMirror =
                (stateSprites[activeState].sourceOrientation === "left" && facingDirection === "right") ||
                (stateSprites[activeState].sourceOrientation === "right" && facingDirection === "left");

              player.setFlipX(shouldMirror);
            });

            this.events.once("shutdown", () => {
              window.removeEventListener("level-tester-reset", handleReset as EventListener);
            });
          },
        },
      });
    }

    void mount();

    return () => {
      destroyed = true;
      game?.destroy(true);
    };
  }, [spriteDependencyKey, spritesByState]);

  if (!spritesByState.walking && !spritesByState.idle && !spritesByState.jumping) {
    return (
      <div className="flex aspect-[4/5] min-h-[420px] w-full items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-card/40 px-6 text-center text-sm text-muted-foreground">
        Pick at least one sprite or uploaded input image for the tester, then try it in the level.
      </div>
    );
  }

  return (
    <div
      ref={focusShellRef}
      tabIndex={0}
      className="overflow-hidden rounded-[2rem] border border-border/70 bg-[#0f1b35] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div ref={containerRef} className="aspect-[4/5] min-h-[360px] w-full" />
    </div>
  );
}
