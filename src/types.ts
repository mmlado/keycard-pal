import type { BtcPsbtSummary } from './utils/btcPsbt';

export type EthSignRequest = {
  requestId?: string;
  signData: string;
  dataType: number;
  chainId?: number;
  derivationPath: string;
  address?: string;
  origin?: string;
};

export type BtcPsbtRequest = {
  psbtHex: string;
};

export type BtcSignRequest = {
  requestId: string;
  signDataHex: string;
  dataType: number;
  derivationPath: string;
  address?: string;
  origin?: string;
};

export type ScanResult =
  | { kind: 'eth-sign-request'; request: EthSignRequest }
  | { kind: 'crypto-psbt'; request: BtcPsbtRequest; summary: BtcPsbtSummary }
  | { kind: 'btc-sign-request'; request: BtcSignRequest }
  | { kind: 'unsupported'; type: string }
  | { kind: 'error'; message: string };
