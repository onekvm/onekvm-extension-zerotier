# OneKVM ZeroTier 扩展

[English](README.md) | 简体中文

> **构建说明：** 本仓库只包含扩展源码。扩展统一由 `onekvm-distro` 中的
> OpenEmbedded（OE）配方构建和打包；本仓库不提供独立的正式构建流程。

本仓库包含 ZeroTier One 的 OneKVM 生命周期控制器和设置页面。上游客户端
不进入 OneKVM 基础镜像，而是作为扩展私有运行时由 OpenEmbedded 提供。

扩展使用自己的 ZeroTier home 目录，可管理多个网络，显示分配的地址和
本地节点 ID，并在设置中删除网络后自动离开该网络。默认路由、公共地址
范围和 DNS 管理默认关闭，以保护 KVM 管理连接。设置页面也支持配置 Moon
节点和 UDP 端口。
