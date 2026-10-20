# OneKVM ZeroTier 扩展

[English](README.md) | 简体中文

在不把 ZeroTier One 加入基础镜像的情况下，将 OneKVM 连接到一个或多个
ZeroTier 网络。扩展提供生命周期控制器和设置页面；上游客户端由
OpenEmbedded 随扩展打包。

> **构建说明：** 本仓库只包含扩展源码。正式软件包由 `onekvm-distro` 中的
> OpenEmbedded（OE）配方统一构建；本仓库不提供独立的正式构建流程。

## 功能

- 加入、查看、离开和移除多个 ZeroTier 网络
- 显示本地节点 ID，以及各网络分配的 IP 地址
- 添加或移除自建 Moon 节点，并查看其稳定端点
- 配置 ZeroTier UDP 端口
- 分别控制托管地址与路由、公共地址范围、默认路由和 DNS 配置
- 使用扩展私有的 ZeroTier home 目录

## 安装与启用

软件包名称是 `onekvm-extension-zerotier`。请通过 OneKVM 发行版的软件包
或镜像安装，然后使用插件管理器控制扩展：

```sh
onekvm-extension enable zerotier
onekvm-extension disable zerotier
```

扩展需要 `tun` 内核模块。

## 配置

打开 **ZeroTier** 扩展页面并填写 16 位十六进制网络 ID。网络在 ZeroTier
控制器中获得授权前可能一直处于等待状态。删除网络条目时，客户端也会离开
该网络。

Moon ID 是 10 位十六进制字符串，同时用作 Seed ID。最多可保存 32 个受管
网络和 32 个 Moon 条目。UDP 端口默认是 `9993`；设为 `0` 时自动选择。

托管地址和路由默认允许；公共地址范围、默认路由和 DNS 配置默认关闭，以
降低 OneKVM 管理连接中断的风险。在只能远程访问的设备上启用这些选项前，
请先确认网络规划。

## 开发

C++20 控制器可以使用 CMake 和 CTest 构建、测试：

```sh
cmake -S . -B build -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

上游 `zerotier-one` 运行时由 OpenEmbedded 另行提供。

## 许可证

本项目使用 GNU General Public License v3.0，完整条款见
[`LICENSE`](LICENSE)。随包提供的 ZeroTier One 运行时及其依赖继续使用
各自的上游许可证。
