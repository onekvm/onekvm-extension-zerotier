SUMMARY = "OneKVM ZeroTier service extension"
HOMEPAGE = "https://www.zerotier.com/"
LICENSE = "MIT & MPL-2.0"
ONEKVM_ZEROTIER_SOURCE ?= "${UNPACKDIR}/zerotier-one"
LIC_FILES_CHKSUM = "\
    file://LICENSE;md5=4b4d2ea45bb882ef18ae0022ccc1f9ab \
    file://${ONEKVM_ZEROTIER_SOURCE}/LICENSE-MPL.txt;md5=9741c346eef56131163e13b9db1241b3 \
"
PR = "r2"

ZEROTIER_VERSION = "1.16.2"
ONEKVM_COMPONENT_GIT_URI ??= "git://github.com/onekvm/onekvm-extension-zerotier.git;protocol=https;branch=main"
ONEKVM_COMPONENT_SRCREV ??= ""
SRC_URI = "\
    ${ONEKVM_COMPONENT_GIT_URI};name=extension;destsuffix=extension \
    git://github.com/zerotier/ZeroTierOne.git;protocol=https;nobranch=1;name=upstream;destsuffix=zerotier-one \
"
SRCREV_extension = "${ONEKVM_COMPONENT_SRCREV}"
SRCREV_upstream = "fc5c3ec22090b5b2a0f274e863651fe9ca489bf4"
SRCREV_FORMAT = "extension_upstream"
S = "${UNPACKDIR}/extension"

inherit onekvm-extension

DEPENDS += "json-c"

ONEKVM_EXTENSION_ID = "zerotier"
ONEKVM_EXTENSION_API_VERSION = "2"
ONEKVM_EXTENSION_MANIFEST_TEMPLATE = "${S}/manifest.json.in"

PACKAGES = "${PN}-dbg ${PN}-runtime ${PN}"
FILES:${PN} = "\
    ${ONEKVM_EXTENSION_ROOT}/bin/onekvm-zerotier-controller \
    ${ONEKVM_EXTENSION_ROOT}/manifest.json \
    ${ONEKVM_EXTENSION_ROOT}/web \
"
FILES:${PN}-runtime = "\
    ${ONEKVM_EXTENSION_ROOT}/bin/zerotier-one \
    ${ONEKVM_EXTENSION_ROOT}/bin/zerotier-cli \
"
RDEPENDS:${PN} += "${PN}-runtime (= ${EXTENDPKGV})"
RDEPENDS:${PN}:append:onekvm-nanokvm = " onekvm-kernel-module-tun"
INSANE_SKIP:${PN}-dbg += "buildpaths"

do_compile() {
    install -d ${B}/bin
    ${CXX} ${CXXFLAGS} -I${STAGING_INCDIR} \
        ${S}/src/main.cpp ${STAGING_LIBDIR}/libjson-c.a -lm ${LDFLAGS} \
        -o ${B}/bin/onekvm-zerotier-controller

    oe_runmake -C ${ONEKVM_ZEROTIER_SOURCE} one \
        CC="${CC}" CXX="${CXX}" AR="${AR}" \
        CFLAGS="${CFLAGS}" CXXFLAGS="${CXXFLAGS}" LDFLAGS="${LDFLAGS}" \
        DEFS="-DZT_ONE_NO_ROOT_CHECK"
}
do_compile[dirs] = "${B}"

do_install() {
    oe_runmake -C ${S} install \
        CONTROLLER_BINARY=${B}/bin/onekvm-zerotier-controller \
        RUNTIME_BINARY=${ONEKVM_ZEROTIER_SOURCE}/zerotier-one \
        DESTDIR=${D} PREFIX=${ONEKVM_EXTENSION_ROOT} \
        VERSION=${PV} ARCH=${TARGET_ARCH}
}
