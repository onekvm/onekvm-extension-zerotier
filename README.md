# OneKVM ZeroTier Extension

English | [简体中文](README.zh-CN.md)

Connect OneKVM to one or more ZeroTier networks without adding ZeroTier One to
the base image. The extension provides the lifecycle controller and settings
page, while OpenEmbedded packages the upstream client with the extension.

> **Build note:** This repository contains extension sources only. Release
> packages are built by the OpenEmbedded recipes in `onekvm-distro`; this
> repository does not provide a standalone release build.

## Features

- Join, inspect, leave, and remove multiple ZeroTier networks
- Show the local node ID and IP addresses assigned by each network
- Add and remove self-hosted Moon nodes and inspect their stable endpoints
- Configure the ZeroTier UDP port
- Control managed addresses and routes, public ranges, the default route, and
  DNS acceptance independently
- Keep the ZeroTier home directory private to the extension

## Install and enable

The package name is `onekvm-extension-zerotier`. Install it through your
OneKVM distribution package or image, then manage it with the plugin manager:

```sh
onekvm-extension enable zerotier
onekvm-extension disable zerotier
```

The extension requires the `tun` kernel module.

## Configuration

Open the **ZeroTier** extension page and enter a 16-digit hexadecimal network
ID. The network may remain pending until it is authorized in your ZeroTier
controller. Removing an entry also makes the client leave that network.

Moon IDs are 10 hexadecimal digits and also act as seed IDs. Up to 32 managed
networks and 32 Moon entries can be stored. The UDP port defaults to `9993`;
use `0` for automatic selection.

Managed addresses and routes are allowed by default. Public address ranges,
the default route, and DNS configuration are disabled by default to reduce the
risk of disrupting the OneKVM management connection. Review these options
before enabling them on a remote-only device.

## Development

The C++20 controller can be built and tested with CMake and CTest:

```sh
cmake -S . -B build -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

The upstream `zerotier-one` runtime is supplied separately by OpenEmbedded.

## License

This project is licensed under the GNU General Public License v3.0. See
[`LICENSE`](LICENSE). The packaged ZeroTier One runtime and dependencies retain
their respective upstream licenses.
