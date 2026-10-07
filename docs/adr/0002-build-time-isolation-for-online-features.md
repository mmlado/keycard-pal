# 0002. Online-only features are isolated at build time

Date: 2026-05-06

The offline Android flavor promises more than "network code is not used": online
features such as ENS and WalletConnect, with their RPC clients, endpoint strings,
settings screens and packages, must be absent from the offline APK and its
JavaScript bundle. So shared code imports a `.online` boundary module, and the
offline bundle resolves that import to a matching `.offline` stub during Metro
resolution; the offline artifact holds no online module, endpoint string, online
settings route or online-only dependency. Runtime gating on
`BuildConfig.INTERNET_ENABLED` would still ship the code and the strings, so it
stays acceptable only for small branches inside code both builds share. The
build-time boundary gives a reviewer an artifact to inspect and CI something to
scan for forbidden markers.

## Consequences

- Each online feature needs a boundary module and an offline stub, and the
  Metro and Gradle bundling needs explicit build-mode wiring.
- The bundle guard scripts must gain a marker whenever an online feature adds a
  new module or endpoint string.
- Reconsider if the offline flavor goes away or Metro gains a first-class
  flavor mechanism.
