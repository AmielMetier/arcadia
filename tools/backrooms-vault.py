#!/usr/bin/env python3
"""Brouille une image pour The Backrooms (même clé que backrooms/view/vault.js).
Usage : python3 tools/backrooms-vault.py <image> <backrooms/data/eN.bin>  (relancer sur un .bin le remet en image)"""
import re, sys
key = bytes(int(x) for x in re.search(r"Uint8Array\(\[([\d,]+)\]\)", open("backrooms/view/vault.js").read()).group(1).split(","))
b = open(sys.argv[1], "rb").read()
open(sys.argv[2], "wb").write(bytes(x ^ key[i % 32] for i, x in enumerate(b)))
