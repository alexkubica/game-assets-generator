export type JobStatus =
  | "queued"
  | "generating"
  | "downloading"
  | "extracting"
  | "ready"
  | "failed"
  | "expired";

export type VideoProvider = "xai-grok-imagine-video";
export type VideoAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";
export type VideoResolution = "480p" | "720p";
export type SpriteSourceType = "generated" | "uploaded";
export type EntityLifecycleState = "active" | "archived";
export type SpriteMotionState = "idle" | "walking" | "jumping";

export interface EntityAuditFields {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface JobFrame {
  number: number;
  fileName: string;
  assetPath: string;
}

export interface JobSpritesheet {
  filePath: string;
  assetPath: string;
  frameCount: number;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  exportedAt: string;
}

export interface JobManifest {
  jobId: string;
  projectId: string | null;
  sourceJobId: string | null;
  provider: VideoProvider;
  prompt: string;
  title: string;
  duration: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  status: JobStatus;
  sourceImagePath: string;
  sourceImageAssetPath: string;
  sourceImageMimeType: string;
  videoPath: string | null;
  videoAssetPath: string | null;
  requestId: string | null;
  frames: JobFrame[];
  selectedFrameNumbers: number[];
  spritesheet: JobSpritesheet | null;
  derivedSpriteIds: string[];
  previewFps: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface JobsListResponse {
  jobs: JobManifest[];
}

export interface JobResponse {
  job: JobManifest;
}

export interface SpriteAsset {
  spriteId: string;
  projectId: string | null;
  sourceSpriteId: string | null;
  sourceType: SpriteSourceType;
  title: string;
  imagePath: string;
  imageAssetPath: string;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  cellWidth: number;
  cellHeight: number;
  playbackFps: number;
  frameCount: number;
  selectedFrameNumbers: number[];
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
  gifPath: string | null;
  gifAssetPath: string | null;
  gifExportedAt: string | null;
  originalJobId: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface SpritesListResponse {
  sprites: SpriteAsset[];
}

export interface TesterStateOverride {
  assetKey: string | null;
  fps: number | null;
  scale: number | null;
  sourceOrientation: "left" | "right" | null;
}

export interface TesterAssetOverride {
  chromaKeyColor: string | null;
  chromaKeyTolerance: number;
}

export interface TesterSetup {
  setupId: string;
  projectId: string | null;
  title: string;
  defaultAssetKey: string;
  defaultFps: number;
  defaultScale: number;
  defaultOrientation: "left" | "right";
  states: Record<SpriteMotionState, TesterStateOverride>;
  assetOverrides: Record<string, TesterAssetOverride>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface TesterSetupsListResponse {
  setups: TesterSetup[];
}

export interface TesterSetupResponse {
  setup: TesterSetup;
}

export type BillingChangeOrigin =
  | "INVALID_ORIGIN"
  | "PURCHASE"
  | "SPEND"
  | "REFUND"
  | "MANUAL"
  | "AUTO_PURCHASE";

export type BillingTopupStatus =
  | "INVALID_STATUS"
  | "TO_GENERATE_INVOICE"
  | "FAILED_TO_GEMNERATE_INVOICE"
  | "TO_CHARGE"
  | "FAILED_TO_CHARGE"
  | "SUCCEEDED";

export type BillingPaymentProcessorKind = "UNKNOWN" | "STRIPE" | "CHECKOUT" | "EXTERNAL" | "MANUAL";

export interface BillingMoney {
  val: string;
}

export interface BillingPaymentProcessor {
  kind: BillingPaymentProcessorKind;
  externalParty?: string;
  externalInvoiceId?: string;
}

export interface BillingBalanceChange {
  teamId: string;
  changeOrigin: BillingChangeOrigin;
  topupStatus?: BillingTopupStatus;
  amount: BillingMoney;
  invoiceId?: string;
  invoiceNumber?: string;
  createTime?: string;
  spendBpKeyYear?: number;
  spendBpKeyMonth?: number;
  createTs?: string;
  paymentProcessor?: BillingPaymentProcessor;
}

export interface BillingBalanceResponse {
  changes: BillingBalanceChange[];
  total: BillingMoney;
}

export interface BillingUsageDataPoint {
  timestamp: string;
  values: number[];
}

export interface BillingUsageTimeSeries {
  group: string[];
  groupLabels: string[];
  dataPoints: BillingUsageDataPoint[];
}

export interface BillingUsageResponse {
  timeSeries: BillingUsageTimeSeries[];
  limitReached: boolean;
}

export interface BillingUsageHistoryPoint {
  timestamp: string;
  usd: number;
}

export interface BillingUsageBreakdownItem {
  label: string;
  usd: number;
}
