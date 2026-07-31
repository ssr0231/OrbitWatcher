"""
backend/generate_figures.py
Run this after benchmark.py completes.

Usage:
    python backend/generate_figures.py

Requires:
    benchmark_scalability.json
    benchmark_completeness.json
    pipeline_timing.json
    (all saved to project root by benchmark.py and run_pipeline_timed)
"""

import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

plt.rcParams.update({
    "font.family":    "serif",
    "font.size":      11,
    "axes.titlesize": 12,
    "axes.labelsize": 11,
    "legend.fontsize":10,
    "figure.dpi":     150,
    "axes.grid":      True,
    "grid.alpha":     0.3,
    "grid.linestyle": "--",
})

# ── Load data ──────────────────────────────────────────────
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load(filename):
    path = os.path.join(base, filename)
    if not os.path.exists(path):
        print(f"ERROR: {filename} not found. Run benchmark.py first.")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)

scale  = load("benchmark_scalability.json")
comp   = load("benchmark_completeness.json")
timing = load("pipeline_timing.json")

ns      = [r["n"]          for r in scale]
bf_ms   = [r["bf_ms_mean"] for r in scale]
kd_ms   = [r["kd_ms_mean"] for r in scale]
speedup = [r["speedup"]    for r in scale]

# ── Figure 1: Runtime vs n (log-log) ──────────────────────
fig, ax = plt.subplots(figsize=(7, 5))

ax.loglog(ns, bf_ms, "r-o", linewidth=2, markersize=7,
          label="Brute-Force O(n²)")
ax.loglog(ns, kd_ms, "g-s", linewidth=2, markersize=7,
          label="Altitude-Stratified k-d Tree")

ns_arr   = np.array(ns, dtype=float)
ref_n2   = bf_ms[0] * (ns_arr / ns[0]) ** 2
ref_nlogn= kd_ms[0] * (ns_arr / ns[0]) * np.log2(ns_arr / ns[0] + 1)

ax.loglog(ns_arr, ref_n2,     "r--", alpha=0.3, linewidth=1.2, label="O(n²) reference")
ax.loglog(ns_arr, ref_nlogn,  "g--", alpha=0.3, linewidth=1.2, label="O(n log n) reference")

ax.set_xlabel("Number of Satellites (n)")
ax.set_ylabel("Runtime (ms)")
ax.set_title("Fig. 1 — Conjunction Screening Runtime vs Catalog Size")
ax.legend(loc="upper left")
ax.xaxis.set_major_formatter(ticker.FuncFormatter(lambda x,_: f"{int(x):,}"))
ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x,_: f"{x:,.0f}"))
plt.tight_layout()
plt.savefig(os.path.join(base, "fig1_runtime_scaling.pdf"), bbox_inches="tight")
plt.savefig(os.path.join(base, "fig1_runtime_scaling.png"), bbox_inches="tight", dpi=200)
print("Saved: fig1_runtime_scaling.pdf / .png")
plt.close()

# ── Figure 2: Speedup vs n ────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
ax.plot(ns, speedup, "b-o", linewidth=2, markersize=7)

max_sp  = max(speedup)
max_idx = speedup.index(max_sp)
ax.annotate(f"{max_sp:,.0f}×",
            xy=(ns[max_idx], max_sp),
            xytext=(-60, -20),
            textcoords="offset points",
            fontsize=10,
            arrowprops=dict(arrowstyle="->", color="black"))

ax.set_xlabel("Number of Satellites (n)")
ax.set_ylabel("Speedup Factor (×)")
ax.set_title("Fig. 2 — k-d Tree Speedup over Brute-Force")
ax.xaxis.set_major_formatter(ticker.FuncFormatter(lambda x,_: f"{int(x):,}"))
ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x,_: f"{x:,.0f}×"))
plt.tight_layout()
plt.savefig(os.path.join(base, "fig2_speedup.pdf"), bbox_inches="tight")
plt.savefig(os.path.join(base, "fig2_speedup.png"), bbox_inches="tight", dpi=200)
print("Saved: fig2_speedup.pdf / .png")
plt.close()

# ── Figure 3: Detection completeness vs threshold ─────────
thresholds   = [r["threshold_km"] for r in comp]
completeness = [r["completeness"] for r in comp]
bf_counts    = [r["bf_pairs"]     for r in comp]

fig, ax1 = plt.subplots(figsize=(6, 4))
color1 = "steelblue"
ax1.plot(thresholds, completeness, "o-",
         color=color1, linewidth=2, markersize=8)
ax1.set_xlabel("Screening Threshold (km)")
ax1.set_ylabel("Detection Completeness (%)", color=color1)
ax1.tick_params(axis="y", labelcolor=color1)
ax1.set_ylim([98.5, 100.2])
ax1.invert_xaxis()

ax2 = ax1.twinx()
color2 = "tomato"
ax2.bar(thresholds, bf_counts, width=3, alpha=0.25,
        color=color2, label="Pairs (brute-force)")
ax2.set_ylabel("Conjunction Pairs Found", color=color2)
ax2.tick_params(axis="y", labelcolor=color2)
ax1.set_title("Fig. 3 — Detection Completeness vs Screening Threshold")
plt.tight_layout()
plt.savefig(os.path.join(base, "fig3_completeness.pdf"), bbox_inches="tight")
plt.savefig(os.path.join(base, "fig3_completeness.png"), bbox_inches="tight", dpi=200)
print("Saved: fig3_completeness.pdf / .png")
plt.close()

# ── Figure 4: Pipeline stage breakdown ────────────────────
stages = ["TLE Parse\n+Store", "SGP4\nPropagation",
          "Conjunction\nScreening", "Maneuver\nGeneration"]
times  = [
    timing.get("tle_store_ms",        0),
    timing.get("sgp4_propagation_ms", 0),
    timing.get("screening_ms",        0),
    timing.get("maneuver_ms",         0),
]
colors = ["#5b9bd5", "#ed7d31", "#a9d18e", "#ffc000"]

fig, ax = plt.subplots(figsize=(7, 4))
bars = ax.bar(stages, times, color=colors, edgecolor="white",
              linewidth=0.8, width=0.55)

for bar, t in zip(bars, times):
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 2,
            f"{t:.1f} ms",
            ha="center", va="bottom", fontsize=10, fontweight="bold")

total = sum(times)
n_sats = timing.get("n_propagated", 10303)
ax.set_xlabel("Pipeline Stage")
ax.set_ylabel("Execution Time (ms)")
ax.set_title(
    f"Fig. 4 — Pipeline Stage Latency Breakdown\n"
    f"(n={n_sats:,} satellites, total={total:.1f} ms, network excluded)"
)
ax.set_ylim(0, max(times) * 1.25)
plt.tight_layout()
plt.savefig(os.path.join(base, "fig4_pipeline_breakdown.pdf"), bbox_inches="tight")
plt.savefig(os.path.join(base, "fig4_pipeline_breakdown.png"), bbox_inches="tight", dpi=200)
print("Saved: fig4_pipeline_breakdown.pdf / .png")
plt.close()

# ── Summary ────────────────────────────────────────────────
print()
print("=" * 56)
print("  FIGURES COMPLETE — USE THESE IN YOUR PAPER")
print("=" * 56)
print(f"  n range:          {ns[0]:,} – {ns[-1]:,} satellites")
print(f"  Max speedup:      {max(speedup):,.0f}×  at n={ns[speedup.index(max(speedup))]:,}")
print(f"  Min completeness: {min(completeness):.3f}%")
print(f"  Pipeline total:   {total:.1f} ms  (network excluded)")
print("=" * 56)