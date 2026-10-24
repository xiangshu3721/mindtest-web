export interface CloudPendingItem {
  reportId: string;
  clientSubmissionId: string;
  linkSecret: string;
  ownerToken: string;
  orderKey: string;
  payload: unknown;
  attempts: number;
  nextAt: number;
  lastError: string;
}

export interface CloudLinkItem {
  reportId: string;
  reportUrl: string;
  status: string;
  byteSize?: number;
}

export function backoffMs(attempt: number): number;
export function buildShareUrl(base: string, reportId: string, linkSecret: string): string;
export function createCloudStore(storage: Storage): {
  pending(): CloudPendingItem[];
  savePending(items: CloudPendingItem[]): void;
  upsertPending(item: CloudPendingItem): void;
  removePending(reportId: string): void;
  owners(): Record<string, string>;
  saveOwner(reportId: string, ownerToken: string): void;
  links(): Record<string, CloudLinkItem>;
  saveLink(key: string, link: CloudLinkItem): void;
  forgetLink(key: string): void;
};
export function createSubmissionIds(cryptoObj?: Crypto): {
  reportId: string;
  clientSubmissionId: string;
  linkSecret: string;
  ownerToken: string;
};
export function gateSubmit(input: { agreed: boolean; endpoint: string; nickname: string }): { ok: boolean; reason: string };
export function isoShanghai(date: Date): string;
export function resolveEndpoint(locationLike: object, config?: object): string;
export function resolveReportBase(locationLike: object, config?: object): string;
