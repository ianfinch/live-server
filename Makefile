SHELL := bash
.DEFAULT_GOAL := all

.PHONY: all
all: 
	cat $(CURDIR)/config/live-server.json | sed "s|__BASE__|$(CURDIR)|" > $(HOME)/.live-server.json
