/**
 * Compile-time guard for `.offline` stubs. Every offline stub ends with:
 *
 *   export type _OnlineParity = SatisfiesOnline<
 *     typeof import('./x.online'),
 *     typeof import('./x.offline')
 *   >;
 *
 * tsc fails when the stub's interface drifts from its online twin (a missing
 * export, an incompatible signature). Purely type-level: Babel erases it
 * before Metro's resolver runs, so offline bundles never see online code.
 */
export type SatisfiesOnline<Online, Offline extends Online> = Offline;
