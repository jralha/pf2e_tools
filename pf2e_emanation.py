import streamlit as st
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import ListedColormap
import numpy as np

st.set_page_config(layout="centered", page_title="PF2e Emanation Calculator")

TOKEN_SIZES = {
    "Tiny":       1,
    "Small":      1,
    "Medium":     1,
    "Large":      2,
    "Huge":       3,
    "Gargantuan": 4,
}


def diag_cost(n: int) -> int:
    """PF2e alternating diagonal cost in feet: 5, 10, 5, 10, ..."""
    return (n // 2) * 15 + (n % 2) * 5


def pf2e_distance(i: int, j: int, token_size: int) -> int:
    """
    PF2e grid distance (feet) from a token occupying squares
    [0, token_size-1] × [0, token_size-1] to the square at position (i, j).
    Uses the alternating-diagonal rule: every 2nd diagonal costs 10 ft instead of 5 ft.
    """
    dx = max(0, -i, i - token_size + 1)
    dy = max(0, -j, j - token_size + 1)
    diag = min(dx, dy)
    straight = abs(dx - dy)
    return diag_cost(diag) + straight * 5


def compute_grid(token_size: int, emanation_ft: int):
    """
    Returns token_squares, affected_squares (sets of (i, j) tuples), and grid bounds (lo, hi).
    Token is placed at abstract positions [0, token_size-1] × [0, token_size-1].
    """
    pad = emanation_ft // 5 + 2  # 2 extra squares of padding beyond the emanation
    lo = -pad
    hi = token_size + pad

    token_squares = set()
    affected_squares = set()

    for i in range(lo, hi):
        for j in range(lo, hi):
            if 0 <= i < token_size and 0 <= j < token_size:
                token_squares.add((i, j))
            elif pf2e_distance(i, j, token_size) <= emanation_ft:
                affected_squares.add((i, j))

    return token_squares, affected_squares, lo, hi


def draw_grid(
    size_label: str,
    token_size: int,
    emanation_ft: int,
    token_squares: set,
    affected_squares: set,
    lo: int,
    hi: int,
):
    grid_size = hi - lo

    # Build 2-D array: 0=empty, 1=token, 2=affected
    data = np.zeros((grid_size, grid_size), dtype=int)
    for i, j in token_squares:
        data[j - lo, i - lo] = 1
    for i, j in affected_squares:
        data[j - lo, i - lo] = 2

    # Flip rows so increasing j goes upward (north-up orientation)
    data = data[::-1, :]

    cmap = ListedColormap(["#f0f0f0", "#4472C4", "#ED7D31"])

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.pcolormesh(data, cmap=cmap, vmin=0, vmax=2, edgecolors="#cccccc", linewidth=0.5)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])

    sq_size = token_size * token_size
    ax.set_title(
        f"{size_label} ({token_size}×{token_size}) — {emanation_ft} ft Emanation",
        fontsize=13,
        pad=10,
    )

    patches = [
        mpatches.Patch(facecolor="#4472C4", edgecolor="#555", label=f"Token ({size_label}, {sq_size} sq)"),
        mpatches.Patch(facecolor="#ED7D31", edgecolor="#555", label=f"Emanation ({len(affected_squares)} sq)"),
        mpatches.Patch(facecolor="#f0f0f0", edgecolor="#999", label="Open space"),
    ]
    ax.legend(handles=patches, loc="upper right", fontsize=9, framealpha=0.9)
    ax.text(
        0.5, -0.01,
        "Each square = 5 feet  ·  PF2e alternating-diagonal measurement",
        transform=ax.transAxes,
        ha="center", va="top",
        fontsize=8, color="#777777",
    )

    plt.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# Streamlit UI
# ---------------------------------------------------------------------------

st.title("PF2e Emanation Calculator")
st.caption("Pathfinder 2nd Edition · 5-foot grid · alternating-diagonal distance rule")

col_left, col_right = st.columns([3, 2])

with col_left:
    size_label = st.selectbox(
        "Token Size",
        options=list(TOKEN_SIZES.keys()),
        index=2,  # default: Medium
    )
    emanation_ft = int(
        st.number_input("Emanation (feet)", min_value=5, max_value=120, step=5, value=10)
    )
    include_token = st.checkbox(
        "Include token's own squares in the count",
        value=False,
        help=(
            "PF2e emanations typically include the caster's space. "
            "Enable this to add the token's own squares to the total."
        ),
    )

token_size = TOKEN_SIZES[size_label]
token_squares, affected_squares, lo, hi = compute_grid(token_size, emanation_ft)

token_count = token_size * token_size
total = len(affected_squares) + (token_count if include_token else 0)

with col_right:
    st.metric("Squares Affected", total)
    lines = [f"Emanation area: **{len(affected_squares)}** sq"]
    if include_token:
        lines.append(f"Token: **{token_count}** sq")
    st.caption("  \n".join(lines))

fig = draw_grid(size_label, token_size, emanation_ft, token_squares, affected_squares, lo, hi)
st.pyplot(fig)
plt.close(fig)
