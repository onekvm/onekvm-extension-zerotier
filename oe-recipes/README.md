# OpenEmbedded layer

This layer packages the ZeroTier extension for OneKVM. The integrating distro
must set `ONEKVM_COMPONENT_SRCREV`; the ZeroTierOne revision remains
independently pinned. The layer supports `wrynose` and depends on `onekvm`.
