"""Potong 12 tile penuh dari screenshot grid profil Instagram ke folder img/.

Pemakaian:  python3 crop_tiles.py screenshot.png

Garis pemisah grid (gelap, 3-4 px) dideteksi otomatis. Bagian atas tiap tile
dipangkas supaya ikon pin/reel di pojok kanan atas ikut terbuang.
Foto tidak disimpan di repo karena repo ini publik; jalankan skrip ini dulu
sebelum render.
"""
import os
import sys

import numpy as np
from PIL import Image

NAMES = ['00-ayam-songkem', '01-brownies-kukus', '02-nasi-kuning', '03-telur-ceplok',
         '04-pindang-tongkol', '05-spring-roll', '06-capcay', '07-ayam-suwir',
         '08-udang-pete', '09-ikan-nila', '10-soft-cookies', '11-creamy-meatballs']


def runs(idx):
    groups = []
    for i in idx:
        if groups and i - groups[-1][-1] <= 1:
            groups[-1].append(i)
        else:
            groups.append([i])
    return [(g[0], g[-1]) for g in groups]


def main(path):
    im = Image.open(path).convert('RGB')
    lum = np.asarray(im).astype(int).mean(axis=2)
    H, W = lum.shape
    col_sep = runs([i for i in range(W) if lum[int(H * .18):int(H * .93), i].mean() < 40])
    row_sep = runs([i for i in range(int(H * .1), H) if lum[i, int(W * .04):int(W * .96)].mean() < 40])
    thin = [r for r in row_sep if r[1] - r[0] <= 6]
    if len(col_sep) != 2 or len(thin) < 3:
        sys.exit('Grid tidak terdeteksi; pastikan screenshot grid profil mode gelap.')
    lefts = [0, col_sep[0][1] + 1, col_sep[1][1] + 1]
    tw = col_sep[0][0] - 1                               # tile width, 1 px margin from the separator
    head = [r for r in row_sep if r[1] < thin[0][0]]     # dark tab area above row 1
    tops = [head[-1][1] + 1] + [r[1] + 1 for r in thin][:3]
    trim, th = round(tw * 92 / 425), round(tw * 470 / 425)
    os.makedirs('img', exist_ok=True)
    k = 0
    for top in tops:
        for left in lefts:
            im.crop((left, top + trim, left + tw, top + trim + th)).save(f'img/{NAMES[k]}.jpg', quality=95)
            k += 1
    print(f'{k} tile disimpan ke img/ ({tw}x{th} px)')


if __name__ == '__main__':
    main(sys.argv[1])
