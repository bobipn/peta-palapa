"""Fractional Kelly untuk taruhan dua hasil (menang W, kalah L), setelah biaya."""


def kelly_binary(p: float, win: float, loss: float) -> float:
    """f* = p/L - (1-p)/W. Maksimalkan p*log(1+fW) + (1-p)*log(1-fL).

    Dikembalikan >= 0 (long-only). W dan L adalah besaran return positif.
    """
    if win <= 0 or loss <= 0 or not 0.0 <= p <= 1.0:
        return 0.0
    return max(0.0, p / loss - (1.0 - p) / win)


def target_position(p: float, win: float, loss: float, cost: float,
                    kelly_fraction: float, max_position: float) -> float:
    """Posisi target sebagai fraksi ekuitas, sudah dipotong fraksi Kelly & batas.

    `cost` dikurangkan dari sisi menang dan ditambahkan ke sisi kalah, sehingga
    edge yang tidak bertahan terhadap biaya menghasilkan posisi nol.
    """
    w_net = win - cost
    l_net = loss + cost
    if w_net <= 0:
        return 0.0
    f = kelly_fraction * kelly_binary(p, w_net, l_net)
    return min(max_position, f)
