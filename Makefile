CONTROLLER_BINARY ?= build/onekvm-zerotier-controller
RUNTIME_BINARY ?= build/zerotier-one
PREFIX ?= /usr/local
DESTDIR ?=
VERSION ?= 0.0.0-dev
ARCH ?= unknown

.PHONY: all install

all:

install:
	test -x $(CONTROLLER_BINARY)
	test -x $(RUNTIME_BINARY)
	install -Dm0755 $(CONTROLLER_BINARY) $(DESTDIR)$(PREFIX)/bin/onekvm-zerotier-controller
	install -Dm0755 $(RUNTIME_BINARY) $(DESTDIR)$(PREFIX)/bin/zerotier-one
	ln -s zerotier-one $(DESTDIR)$(PREFIX)/bin/zerotier-cli
	install -Dm0644 web/page.js $(DESTDIR)$(PREFIX)/web/page.js
	install -Dm0644 web/logo.svg $(DESTDIR)$(PREFIX)/web/logo.svg
	install -d $(DESTDIR)$(PREFIX)
	sed -e 's/@ARCH@/$(ARCH)/g' -e 's/@VERSION@/$(VERSION)/g' \
		manifest.json.in >$(DESTDIR)$(PREFIX)/manifest.json
	chmod 0644 $(DESTDIR)$(PREFIX)/manifest.json
