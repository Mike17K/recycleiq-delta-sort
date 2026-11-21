# Business case (indicative)

Throughput comes from the simulation (10 simulated minutes, seed 1, default scene settings). Costs and wages are **assumptions, not quotes**: replace them with supplier prices and local wages.

## Scenarios

| | single-line | twin-lines |
|---|---|---|
| Layout | 1 belt, 3 delta robots, 3 AMRs, 2 containers | 2 belts, 12 delta robots, 5 AMRs, 3 containers |
| Items arriving / min (sim) | 99 | 514 |
| **Items sorted / min (sim)** | **80** | **337** |
| Missed to residue | 8% | 29% (AMRs and containers saturate at this input rate) |
| Manual pickers replaced (at 35 picks/min each) | 2.3 | 9.6 |
| **Labour hours saved / day** (2 shifts, 15 h) | **34 h** | **144 h** |
| **Labour hours saved / year** (250 days) | **8,500 h** | **36,000 h** |
| **Wage saving / year** (at EUR 15/h loaded) | **EUR 128k** | **EUR 541k** |
| Maintenance (5% of capex / year) | EUR 19k | EUR 58k |
| **Net saving / year** | **EUR 109k** | **EUR 483k** |
| **Capex (BOM below)** | **EUR 382k** | **EUR 1,163k** |
| **Payback** | **3.5 years** | **2.4 years** |

## Bill of materials (EUR)

| Item | Unit | single-line | twin-lines |
|---|---|---|---|
| Delta robot with gripper | 55k | 3 = 165k | 12 = 660k |
| Conveyor line | 4k / m | 5.4 m = 22k | 16.6 m = 66k |
| Bin station (carousel, 2 bins, sensors) | 3k | 7 = 21k | 14 = 42k |
| AMR (bin hauler) | 30k | 3 = 90k | 5 = 150k |
| Big container | 4k | 2 = 8k | 3 = 12k |
| Subtotal equipment | | 306k | 930k |
| Vision, PLC, safety, integration (+25%) | | 76k | 233k |
| **Total capex** | | **382k** | **1,163k** |

## Assumptions

- One manual picker sorts 35 items/min; a delta robot cell sorts faster, so robots are sized to the line, not to people.
- 2 shifts x 7.5 h x 250 days = 3,750 productive hours per station per year.
- Loaded labour cost EUR 15/h. AMR bin hauling also replaces some forklift time, which is not counted here.
- Vision and real grip success are outside the simulation (item types are given); real throughput will be lower.
- Not counted: energy, floor space, downtime, spare parts, financing, and the value of recovered material.
