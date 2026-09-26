"""Logistic regression L2 via Newton/IRLS, murni stdlib.

Sengaja sederhana: sedikit parameter, deterministik, cepat di-refit, dan
probabilitasnya bisa diukur kalibrasinya out-of-sample.
"""

import math
from typing import List, Sequence


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def solve(a: List[List[float]], b: List[float]) -> List[float]:
    """Eliminasi Gauss dengan partial pivoting. a dan b disalin."""
    n = len(b)
    m = [row[:] + [b[k]] for k, row in enumerate(a)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[piv][col]) < 1e-15:
            raise ZeroDivisionError("Matriks singular")
        m[col], m[piv] = m[piv], m[col]
        for r in range(col + 1, n):
            factor = m[r][col] / m[col][col]
            if factor:
                for k in range(col, n + 1):
                    m[r][k] -= factor * m[col][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (m[r][n] - sum(m[r][k] * x[k] for k in range(r + 1, n))) / m[r][r]
    return x


class LogisticModel:
    def __init__(self, l2: float = 1.0, max_iter: int = 25, tol: float = 1e-8):
        self.l2 = l2
        self.max_iter = max_iter
        self.tol = tol
        self.mean: List[float] = []
        self.std: List[float] = []
        self.w: List[float] = []

    def _z(self, x: Sequence[float]) -> List[float]:
        return [1.0] + [(v - m) / s for v, m, s in zip(x, self.mean, self.std)]

    def fit(self, X: List[Sequence[float]], y: List[int]) -> "LogisticModel":
        if not X or len(X) != len(y):
            raise ValueError("X/y kosong atau panjang berbeda")
        n, d = len(X), len(X[0])
        self.mean = [sum(r[k] for r in X) / n for k in range(d)]
        self.std = []
        for k in range(d):
            var = sum((r[k] - self.mean[k]) ** 2 for r in X) / n
            self.std.append(math.sqrt(var) if var > 1e-24 else 1.0)
        Z = [self._z(r) for r in X]
        dim = d + 1
        w = [0.0] * dim
        for _ in range(self.max_iter):
            grad = [0.0] * dim
            hess = [[0.0] * dim for _ in range(dim)]
            for z, yi in zip(Z, y):
                p = _sigmoid(sum(a * b for a, b in zip(w, z)))
                g = p - yi
                s = max(p * (1.0 - p), 1e-12)
                for a in range(dim):
                    grad[a] += g * z[a]
                    sza = s * z[a]
                    row = hess[a]
                    for b in range(a, dim):
                        row[b] += sza * z[b]
            for a in range(dim):
                for b in range(a):
                    hess[a][b] = hess[b][a]
            hess[0][0] += 1e-9
            for a in range(1, dim):          # intercept tidak di-regularisasi
                grad[a] += self.l2 * w[a]
                hess[a][a] += self.l2
            step = solve(hess, grad)
            w = [wi - si for wi, si in zip(w, step)]
            if max(abs(si) for si in step) < self.tol:
                break
        self.w = w
        return self

    def predict_proba(self, x: Sequence[float]) -> float:
        if not self.w:
            raise RuntimeError("Model belum di-fit")
        return _sigmoid(sum(a * b for a, b in zip(self.w, self._z(x))))
