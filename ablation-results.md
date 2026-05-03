# Ablation Benchmark Results

## Test Setup
- Hard mode (8s time limit), 3 positions
- Each row = one optimization **disabled** (rest enabled)
- Baseline = all 5 new optimizations enabled

## Results

| Config | Init Depth | Init Nodes | Init NPS | Mid Depth | Mid Nodes | Mid NPS |
|--------|-----------|------------|----------|-----------|-----------|---------|
| **BASELINE (all ON)** | **9** | **219,260** | **56,583** | **11** | **301,557** | **89,139** |
| Disable SEE ordering | 9 | 305,418 | 59,933 | **9 (-2)** | 193,210 | 90,075 |
| Disable SEE PVS pruning | 9 | 162,610 | 52,608 | 11 | 545,618 | 87,762 |
| Disable SEE Q-search pruning | **8 (-1)** | 239,951 | 59,586 | **10 (-1)** | 300,963 | 87,693 |
| Disable Reverse Futility | **8 (-1)** | 111,906 | 55,702 | **10 (-1)** | 268,658 | 79,532 |
| Disable Singular Extension | 9 | 219,246 | 54,675 | **12 (+1)** | 358,098 | 86,896 |
| Disable Q-search check moves | **10 (+1)** | 365,186 | 60,252 | **10 (-1)** | 778,797 | 96,781 |
| Disable Eval Enhancement | 9 | 360,991 | 66,863 | 11 | 497,684 | 96,264 |

## Analysis

### Clearly Beneficial (disabling hurts depth):
1. **SEE ordering**: Midgame depth 11→9 when disabled. Huge win.
2. **SEE Q-search pruning**: Both positions lose 1 depth when disabled.
3. **Reverse Futility Pruning**: Both positions lose 1 depth when disabled.

### Mixed/Neutral:
4. **SEE PVS pruning**: Same depth but midgame nodes nearly double (301K→546K). Helps efficiency.
5. **Eval Enhancement**: Same depth but NPS drops 56K→67K (faster per node without it), nodes increase 219K→361K. The richer eval prunes more effectively.

### Potentially Harmful:
6. **Singular Extension**: Midgame depth 11→12 when disabled! The verification search costs more than the extension saves.
7. **Q-search check moves**: Opening depth 9→10 when disabled! Searching check moves in quiescence expands the tree significantly, costing depth despite finding more tactics.
