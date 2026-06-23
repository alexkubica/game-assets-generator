export const DATA_DIR = "data";
export const JOBS_DIR = "data/jobs";
export const SPRITES_DIR = "data/sprites";
export const DEFAULT_PROVIDER = "xai-grok-imagine-video";
export const DEFAULT_PREVIEW_FPS = 30;
export const DEFAULT_VIDEO_DURATION = 1;
export const DEFAULT_VIDEO_ASPECT_RATIO = "1:1";
export const DEFAULT_VIDEO_RESOLUTION = "480p";
export const DEFAULT_SPRITE_CELL_WIDTH = 64;
export const DEFAULT_SPRITE_CELL_HEIGHT = 64;
export const DEFAULT_SPRITE_PLAYBACK_FPS = 30;

export const VIDEO_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;
export const VIDEO_RESOLUTIONS = ["480p", "720p"] as const;
