# OneKVM ZeroTier extension

English | [简体中文](README.zh-CN.md)

> **Build note:** This repository contains extension sources only. The
> extension is built and packaged by the OpenEmbedded recipes in
> `onekvm-distro`; this repository does not provide a standalone release build.

This repository contains the OneKVM lifecycle controller and settings page for
ZeroTier One. The upstream client is deliberately excluded from the OneKVM
base image and is supplied with the extension by OpenEmbedded.

The plugin owns a private ZeroTier home directory. It tracks multiple networks
managed by the settings page, reports their assigned addresses and the local
node ID, and leaves a network when its entry is removed. Default-route,
public-range, and DNS management are off by default to protect the KVM
management connection.
