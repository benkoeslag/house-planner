# Cabinet Rules

Status: Draft for M2. This document writes out every rule in the cabinet planner prototype ([`prototype/cabinet-planner.html`](prototype/cabinet-planner.html)), so the M2 cabinet engine can carry them over exactly. The engine's tests pin the numbers in [Worked examples](#worked-examples). These numbers came from running the prototype itself on 2026-11-01. Where this document and the prototype disagree, the prototype wins until the owner decides otherwise. Behavior the owner may want changed is listed under [Prototype quirks](#prototype-quirks-to-decide). None of it changes without the owner's say.

How the new app places cabinets on the floor plan (runs, corners, openings, the file format) is proposed in [ADR-003](../decisions/ADR-003-cabinet-runs-and-file-v2.md). This document covers what the cabinets are made of and how a row of them is laid out along one wall.

## Notation

- All lengths are inches. Cut sizes are shown rounded to the nearest 1/32″, or 1/16″ when **Round cut sizes** is set to 1/16″.
- A part is written **length × width × quantity**. Length is the dimension that runs with the grain (for doors and sides, the height).
- `W`, `H`, `D`: cabinet width, height and depth. Depth includes the back.
- `t`: actual box plywood thickness (default 23/32″). `b`: back thickness (1/4″).
- `iw = W − 2t`: inside width. `sd = D − b`: side depth.
- **Band** is edge banding: `1L` is one long edge, `2L2W` all four edges. Unbanded parts have none.
- **Materials:** `box` is the 3/4″ maple plywood, `back` the 1/4″ (backs and drawer bottoms), and `drw` the 1/2″ (drawer box sides, fronts and backs).

## Settings and defaults

All of these are owner-editable in the prototype. In the new app they become project settings (ADR-003).

| Group | Setting | Default |
| --- | --- | --- |
| Materials | Box plywood actual thickness `t` | 23/32″ |
| | Back plywood thickness `b` | 1/4″ |
| | Drawer box stock thickness | 1/2″ |
| | Sheet size, all three materials (length along the grain × width) | 96″ × 48″ |
| | Backs can ignore grain / drawer box parts can ignore grain / all box parts can ignore grain | no / yes / no |
| | Spare 3/4″ sheets to buy | 1 |
| | Saw kerf | 1/8″ |
| | Trim from each sheet edge | 0 |
| Heights | Finished countertop height | 36″ |
| | Countertop thickness | 1 1/2″ |
| | Countertop overhang at exposed ends | 1/8″ |
| | Platform height (2×4 on edge, with shims) | 3 1/2″ |
| | Cut toe kick strips from the 3/4″ maple | yes |
| | Platform setback from box front (toe kick depth) | 3″ |
| | Top of upper cabinets from the floor | 84″ |
| | Upper box height | 30″ |
| Depths (box with back) | Base / upper / tall | 23 7/8″ / 12″ / 24″ |
| Box parts | Front stretcher width / rear nailer width | 4″ / 4″ |
| | Bases get a lower rear nailer too | yes |
| | Tall cabinets get a fixed middle shelf | yes |
| Fronts | Reveal at each cabinet edge | 1/16″ |
| | Gap between fronts | 1/8″ |
| | Gap under the countertop (bases) | 1/8″ |
| | Total vertical reveal, uppers and talls | 1/8″ |
| | Use a pair of doors when wider than | 24″ |
| | Drawer front grain | horizontal |
| Shelves | Set back from the box front / total side clearance | 1/4″ / 1/16″ |
| Drawer boxes | Slide clearance per side | 1/2″ |
| | Box height = front height minus | 1″ |
| | Slide lengths available | 12, 14, 16, 18, 20, 22″ |
| | Bottom groove depth (0 nails the bottom on underneath) | 1/4″ |
| | Bottom clearance in the groove | 1/16″ |
| Output | Pull length (drawing only) | 5″ |
| | Two pulls on drawer fronts wider than | 30″ |
| | Round cut sizes to | 1/32″ |
| Prices (before tax) | 3/4″ / 1/4″ / 1/2″ maple sheet | $110 / $55 / $85 |
| | Edge banding per foot | $0.15 |
| | Hinge / +45° corner hinge / slide pair / pull / shelf pin | $6 / $12 / $20 / $6 / $0.10 |
| | Bumpers per 100 | $6 |
| | Pocket screws 1 1/4″ per 100 / 1″ per 100 | $9 / $9 |
| | Brads per 1000 | $10 |
| | Joining screws 1 1/4″ / drawer front screws 1″ / cabinet screws 3″ / construction screws 3″, per 100 | $8 / $7 / $15 / $12 |
| | Wood glue (16 oz) / shims (bundle) / 2×4×8′ / finish (gallon) | $7 / $5 / $4.50 / $55 |
| | Sandpaper, filler, rags (lump sum) | $40 |
| | Sales tax | 13% |

Prices accept cents. Setting values must be positive numbers. Trim, groove depth, bottom clearance, countertop gap, kick setback, shelf clearance, shelf setback and countertop overhang may also be 0.

**Derived heights:**

- Base box height = countertop height − countertop thickness − platform height. This is 31″ by default.
- Tall box height = upper top − platform height. This is 80 1/2″ by default.

## Cabinet types

| Type | Id prefix | Row | Default width | Height and depth |
| --- | --- | --- | --- | --- |
| Base, doors | B | base | 24″ | base box height, base depth |
| Base, drawers | B | base | 18″ | same |
| Base, drawer + doors | B | base | 24″ | same |
| Base, blind corner | B | base | 42″ | same |
| Upper | U | upper | 30″ | upper height, upper depth |
| Upper, blind corner | U | upper | 30″ | same |
| Upper, diagonal corner | U | the corner | 24″ along each wall | same |
| Tall | T | full height | 24″ | tall box height, tall depth |
| Shelf (open shelf between gables) | S | upper | 36″ | depth 24″, shelf height 72″ |
| Open space or appliance | O | depends on its kind | 24″ | see [Open spaces](#open-spaces-and-appliances) |
| Custom part (for example a finished end panel) | P | base, or full height if longer than countertop height + 2″ | 24 23/32″ | length 34 1/2″ |

- **Ids** are the prefix plus a count in list order, for example B1, B2, U1. In the prototype they renumber when the list changes.
- **Overrides:** any cabinet's height or depth can be overridden.
- **Other fields:**
  - name
  - doors (auto, none, one hinged left, one hinged right, or a pair)
  - shelf count
  - drawer count (1 to 8) and top drawer front height (default 6″)
  - false front (the sink base)
  - tall door rows (1 or 2) and lower door height
  - blind side and corner filler width (default 3″)
  - blind corner top (drawer, false front, or none)
  - swap hinge side
  - gables (uppers), with gable depth and height
  - top board (shelf)
  - wall, position mode, snap side and align target
- **Custom parts only:** material, quantity and banding.

## Parts for each cabinet

### Boxes

Every box except the diagonal corner upper gets:

- **Side:** `H × sd × 2`, band 1L.
- **Back:** `H × W × 1` in back material, unbanded, glued and nailed on flush.

The rest depends on the type:

- **Base:** Bottom `iw × sd × 1`, band 1L.
  - Front stretcher `iw × 4 × 1`, band 1L, laid flat at the top front.
  - Rear nailer `iw × 4`, unbanded, on edge: 2 if bases get a lower nailer (top and bottom of the back), otherwise 1.
  - The top is open.
- **Upper and blind upper:** Top / bottom `iw × sd × 2`, band 1L. Rear nailer `iw × 4 × 2`, unbanded.
- **Tall:** Top / bottom `iw × sd × 2`, band 1L.
  - Fixed shelf `iw × sd × 1`, band 1L, if talls get one.
  - Rear nailer `iw × 4`: 3 with the fixed shelf, otherwise 2.

A cabinet is refused (marked a problem, no parts) when its width, height or depth is missing or not positive. It is also refused when `iw ≤ 2` or `sd ≤ 2`.

### Doors

- Front width `fw = W − 2 × edge reveal`.
- **Door count:** on automatic, a cabinet wider than the pair threshold (24″) gets a pair, otherwise one door hinged on the left. A pair's doors are each `(fw − front gap) / 2` wide.
- **Door part:** `door height × door width × count`, band all four edges. Door grain always runs vertically.
- **Hinges per door:** 2 up to 40″ tall, 3 up to 60″, 4 up to 80″, 5 above.
- Each door gets 1 pull.
- **Warnings:**
  - a single door wider than 24″ (the code tests 24.01″) ("consider a pair")
  - pair doors narrower than 8″ each ("consider a single door")
  - no height left for doors (a problem)

**Door heights by type:**

- **Bases:** doors run from the bottom of the box to `H − countertop gap` (the "front top"), less any drawer above.
- **Uppers:** one door row, starting `vertical reveal / 2` above the box bottom and `H − vertical reveal` tall.
- **Tall, 1 row:** doors `H − vertical reveal` tall.
- **Tall, 2 rows:**
  - Lower doors are the lower door height. This defaults to base box height − countertop gap, so they line up with the base doors.
  - Upper doors are `H − vertical reveal − lower − front gap`.

### Drawer fronts and drawer boxes

- **Drawer front:** `fw × front height × 1`, band all four edges. If drawer grain is vertical, it is listed as `front height × fw` instead.
- **Pulls:** a drawer front gets 2 pulls if wider than 30″, otherwise 1.
- **False front:** same size, marked fixed in place. Its pulls are counted separately as false-front pulls. It gets no drawer box and no slides.

**Drawer box for each real drawer:**

- **Box height:** `front height − 1″`, rounded **down** to 1/16″. Under 2″ is a problem.
- **Box width:** `inside width − 2 × slide clearance`. The inside width is `iw`, except in a blind corner.
- **Depth:**
  - The longest available slide no longer than `sd − t − 1/4″`.
  - If none fits, it is a problem.
  - One slide pair of that length is counted.
- **Drawer box side:** `depth × box height × 2`, drawer stock, may ignore grain.
- **Drawer box front/back:** `(box width − 2 × drawer stock) × box height × 2`, drawer stock, fits between the sides.
- **Drawer bottom:** in back material, may always ignore grain.
  - With a groove: `(box width − 2 × drawer stock + 2 × groove − bottom clearance) × (depth − 2 × drawer stock + 2 × groove − bottom clearance)`.
  - With no groove: `box width × depth`, nailed underneath.

### Base cabinet layouts

- **Doors:** doors fill the front top. 1 adjustable shelf by default.
- **Drawers:**
  - `n` fronts share `front top − (n − 1) × front gap`.
  - With more than one drawer and a top front height set, the top front is that height and the rest split what remains equally. Otherwise all `n` are equal.
  - Any front under 3″ is a problem.
  - Fronts stack from the top down, a front gap apart.
- **Drawer + doors:**
  - The top front is the top front height (default 6″): a drawer, or a false front for a sink base.
  - Doors fill from the bottom to `front top − top front − front gap`.
  - 1 adjustable shelf by default.

### Adjustable shelves

- **Part:** `(iw − shelf clearance) × (sd − shelf setback) × count`, band 1L, 4 shelf pins each.
- **Default counts:**
  - bases: 1
  - uppers and blind uppers: 1 up to 24″ tall, 2 up to 36″, 3 above
  - tall: 4
  - drawer bases: none
- **Warning:** when `iw > 32″`, about sag under heavy dishes. It suggests a hardwood front strip, a divider, or splitting the cabinet.

### Base blind corner

The blind end goes toward the corner. On the left wall that is the right end as you face the wall, and on the right wall the left end.

Let `F` = filler width (default 3″) and `gap` = front gap.

- **Blind length** `blindX = base depth + t + F`.
  - The blind panel covers `blindW = blindX − gap/2`.
  - The door gets `dw = W − blindX − gap/2 − edge reveal`.
  - A door under 9″ is a problem. The message suggests a width of at least `ceil(blindX + 12.5)`.
- **Blind panel:** `front top × blindW × 1`, band all four edges, screwed over the blind end.
- **Top drawer or false front** (default: drawer):
  - A front of the top front height and `dw` wide, over the door.
  - The drawer box uses inside width `W − t − blindX`.
  - A drawer also adds:
    - **Drawer shelf** `(W − blindX) × sd × 1`, band 1L, under the drawer.
    - **Drawer partition** `(H − t − drawer front bottom + gap/2) × (sd − t) × 1`, band 1L. It sits on the drawer shelf `blindX` from the blind end and carries the slide.
- **Door:** `door height × dw × 1`, band all four, hinged on the end away from the corner (swappable). The door height is the front top, less the top front and a gap if there is one.
- **Corner filler:** `front top × F × 1`, unbanded. It goes on the first cabinet of the other wall.
- **Filler cleat:** `front top × 3″ × 1`, unbanded, glued behind the filler.
- 1 adjustable shelf by default.
- **Where the other wall's bases start:** `y0 = D + t + F` from the corner.
- **Shopping list:** an optional blind corner pull-out per base blind corner, with its door width to check.

### Upper blind corner

Same as the base blind corner, using upper depth and these heights:

- `blindX = upper depth + t + F`.
- Fronts start `vertical reveal / 2` up and are `H − vertical reveal` tall.
- There is no drawer.
- The blind panel, door, filler and cleat are all `H − vertical reveal` long.
- Shelves default as for uppers.
- The other wall's uppers start at `y0 = D + t + F`.

### Diagonal corner upper

`L` is the length along each wall (its "width", default 24″). `d` is the depth and `H` the height. It needs `L ≥ d + 2t + 4″`, or it is a problem.

- **Corner side:** `H × (d + t − b) × 2`, band 1L. The front edge is beveled 45°, with the long point on the inside face.
- **Corner top / bottom:** `(L − t − b) × (L − t − b) × 2`.
  - It is cut square, then one corner is cut off `clip = L − d − 2t` along each edge.
  - Only the cut edge is banded: banding length `clip × √2` each.
- **Rear nailer:**
  - `(L − t − b) × 4 × 2` for the first back.
  - `(L − 2t − b) × 4 × 2` for the second back, butting the first.
- **Back:** `H × L × 1` (first wall, full length) and `H × (L − b) × 1` (second wall, butting the first).
- **Corner shelf** (default count as uppers):
  - Square side `(L − t − b) − shelf clearance / 2`.
  - Corner cut `clip − shelf clearance / 2 + shelf setback × √2` along each edge.
  - The cut edge is banded. 4 pins each.
- **Door:** `(H − vertical reveal) × (√2 × (L − d) − 2t) × 1`, band all four. It is hung on +45° angled hinges (count by height as usual).
- **Front width along the diagonal:** `√2 × (L − d)`.
- **Where uppers start:** uppers on both walls start `L` from the corner.

### Upper gables

An upper with gables gets:

- **Upper gable:** `gable height × gable depth × 2`, band 1L, one on each end with the top flush with the uppers.
- **Defaults:** gable height = upper height. Gable depth = upper depth + t, so it stands proud of the doors.
- **Width on the wall:** the cabinet then takes `W + 2t` along the wall.

### Tall cabinet

Box as above, with doors in 1 or 2 rows (default 2) and 4 adjustable shelves by default.

### Open shelf

For open shelving between gables, for example over the fridge:

- **Shelf board:** `(W − 1/16″) × depth × 1`, band 1L, at the shelf height (default 72″) on pins or cleats.
- **Top board (optional):** `W × depth × 1`, band 1L, between the gable tops at the upper top height.
  - A warning appears if the shelf is within 4″ of the top board.
- 4 shelf pins.
- **Width:** the space between the gables.

### Open spaces and appliances

- **No parts.** They only hold space on the wall.
- **Heights:**
  - dishwasher or base open space: countertop height − countertop thickness
  - upper open space: upper height
  - floor-to-top open space: upper top
  - fridge: 70″
- **Rows:** a fridge is full height but does not block the uppers above it.
- **Fridge clearance:** an upper over a fridge whose bottom is less than 1″ above the fridge gets a warning.

### Custom parts

- **Part:** `length × width × quantity` in the chosen material with the chosen banding.
- **Grain:** follows that material's "can ignore grain" setting for backs and drawer stock.
- **On a wall:** it takes up `material thickness × quantity` along the wall. It is full height if longer than countertop height + 2″, otherwise in the base row.

### Fronts and pulls in drawings

- **Doors:** the pull is on the side away from the hinge, 1 3/4″ in from the edge.
  - Vertically: near the top for base doors, near the bottom for upper doors, centered for single-row talls.
  - In two-row talls, the lower row's pull is near the top and the upper row's near the bottom.
  - Pulls are drawn the pull length long.
- **Drawer and false fronts:** pulls are centered. Two pulls sit at 1/4 and 3/4 of the width when the front is wider than 30″.
- **Blind panels** have no pull.

## Wall layout

The prototype has two walls meeting at one inside corner: the left wall (156″) and the right wall (128″). It measures every position from that corner along each wall. "Left" and "right" are as you face the wall. On the right wall the corner is on your left; on the left wall it is on your right.

### Rows and where they start

- **Rows:** bases, open spaces in the base row, and short custom parts are in the **base row**. Talls, fridges and full-height parts are **full height** and also block the uppers. Uppers, blind uppers and open shelves are in the **upper row**.
- **The corner wall setting:** "Corner cabinets belong to" (default: right wall) picks the wall whose cabinets run into the corner.
- **Base row start:**
  - On the wall that holds the base blind corner (or, with none, the corner wall), the base row starts at 0.
  - On the other wall it starts at the blind corner's `y0`, or `base depth + t` with no blind corner.
- **Upper row start:**
  - With a diagonal corner upper, uppers start at `L` on both walls.
  - With an upper blind corner, they start at 0 on its wall and at its `y0` on the other.
  - Otherwise they start at 0 on the corner wall and `upper depth + t` on the other.

### Stove and window

- **Stove:** set by its wall, distance from the corner, and width (default left wall, 56″, 30″).
  - The base row is blocked from `stove start − countertop overhang` to `stove end + countertop overhang`.
  - The cabinets beside the stove sit back by the overhang, so the countertop edges land exactly on the stove space.
- **Window:** set by its wall, distance from the corner, and width (default right wall, 69 5/8″, 29 7/8″). It blocks the upper row.
- **Past the wall end:** a stove or window that runs past the end of its wall is a problem.

### Position modes

Each cabinet on a wall has a mode:

- **In list order** (default): it flows.
- **Fixed, centered on the window:** a problem if there is no window on that wall.
- **Fixed, centered on the stove:** a problem if there is no stove on that wall.
- **Fixed, right after the fixed piece above it in the list:** a problem if there is none.
- **Fixed, at a distance from the corner:** 0 is allowed.
- **Fixed, lined up with a base cabinet** (uppers): pick the base by name and the side (left, right, or center as faced). Lined-up pieces are fixed. If the base is not on the same wall, it is a problem.

**Width on the wall:** a cabinet's width on the wall is its width, or `W + 2t` with gables. A diagonal corner's width is its diagonal.

**Problems with fixed pieces:**

- starting inside the corner space (before the row start)
- overlapping the stove or window
- overlapping another fixed piece

### Flowing cabinets

1. Cabinets in list order start where the previous one ended. The first starts at the row start.
2. A flowing cabinet that would overlap the stove, the window or a full-height piece jumps past it.
3. Fixed pieces are hard stops. A flowing cabinet that runs into one is a problem, with the overlap in inches. It does not jump past.

### Snapping and the leftover gap

Between any two **anchors** there is exactly one leftover gap. The anchors are:

- the corner
- each fixed piece
- the stove, the window or a full-height piece
- the end of the wall

The flowing cabinets in each stretch are packed around it:

- **Snap left / snap right** (as faced): pulls a cabinet tight to whatever is on that side and puts the gap on its other side.
  - Every cabinet before the last one that snaps toward the corner sits on the corner side.
  - Every cabinet from the first one that snaps away from the corner on sits on the far side.
  - If a cabinet snaps away but a later one snaps toward the corner, toward the corner wins, with a warning.
- **Automatic** (default): uses "Leftover space goes" (default: at the corner).
  - At the corner: cabinets pack against the next anchor away from the corner, so spare inches collect at the corner as hidden installation room.
  - Next to the fixed pieces: cabinets pack toward the corner.
  - Past the last anchor, cabinets always pack toward the corner and leave the open wall at the end.
- **Too full:** a stretch whose cabinets are wider than the stretch is left in flow order and not packed. Its overlap problems are reported.

### Gaps and checks

- **Holes:** every hole in a row, from the row start up to the end of the last piece, is reported as a gap.
  - A gap at the row start is the corner spare. It is a warning only if over 3″. The message suggests adding a cabinet `gap − 1/2″` wide, rounded to 1/8″, or widening the one next to the corner.
  - Any other gap is a warning that suggests a filler strip or a width change.
- **Running past the wall end:** a problem, with the overrun in inches. This applies to bases and uppers.
- **Base blind corner:**
  - It must be the first base cabinet on its wall. Otherwise it is a problem.
  - If it sits more than `base depth − 3″` from the corner, its blind end no longer reaches behind the other wall's cabinets. That is a problem.
- **Upper blind corner:** the same checks, with the limit `upper depth − 2″`.
- **Both corner uppers:** a diagonal corner upper and an upper blind corner together are a problem.
- **Sink:** the sink base is the drawer + doors cabinet with a false front. On the window's wall, if its center is more than 1/32″ off the window center, there is a warning. The message says which cabinets to make narrower or wider, by how much, or to change the corner filler.

## Countertop

For each wall:

1. Take the base row's cabinets, dishwashers and base open spaces, and custom parts in the base row. Also take the corner span from 0 to the base row start.
2. Merge pieces that are within 3″ of each other into continuous runs. This bridges small gaps, panels and the corner space.
3. Each run gets the end overhang (1/8″) at both exposed ends. There is no overhang at the corner (position 0) or within 1/2″ of a full-height piece. A fridge does not count as full height here.
4. The shopping list gives each run's length, rounded to 1/16″.

## Toe kick and platform

**Toe kick strips** (when cut from the maple):

- For each wall, take the base cabinets and talls (not open spaces or panels), merged where within 1″ of each other.
- Each run is one strip, platform height wide (3 1/2″).
- A run longer than `sheet length − 2 × trim − 1″` is split into equal pieces.
- Strips are noted "cut to fit on site".

**Shopping list:** the toe kick length is the total width of all base cabinets and talls, in feet.

**Platform 2×4s:**

- For each merged run of length `L`:
  - rails `2L`
  - cross pieces `c = ceil(L / 16) + 1`, each `max(0, base depth − kick setback − 3)` long
- Boards = `ceil(total length × 1.1 / 96)`.

## Cut list

- **Grain:** a part may ignore grain if any of these is true:
  - its type always may (drawer bottoms, and drawer box parts or backs when those settings are on)
  - it is a 3/4″ part and "all box parts can ignore grain" is on
  - the owner ticked it in the cut list
- **Grain per line:** the per-part choice is stored by `material | name | rounded length | rounded width`.
- **"Ignore grain on hidden parts":** one button ticks every hidden part type:
  - rear nailers and front stretchers
  - filler cleats
  - drawer partitions and drawer shelves
  - backs and drawer bottoms
  - drawer box sides, fronts and backs
- **Grouping:** identical parts are grouped. The key is material, name, rounded length, rounded width, banding (long, short, extra) and the grain choice. Each group lists its quantity, the cabinets it comes from, and its notes.
- **Order:** groups are sorted by material (3/4″, 1/4″, 1/2″), then part type in this order:
  1. Side, Corner side, Upper gable
  2. Bottom, Top / bottom, Corner top / bottom
  3. Fixed shelf, Drawer shelf, Drawer partition
  4. Front stretcher, Rear nailer
  5. Adjustable shelf, Corner shelf
  6. Door, Drawer front, False front
  7. Blind panel, Corner filler, Filler cleat
  8. Toe kick
  9. Back
  10. Drawer box side, Drawer box front/back, Drawer bottom

  Within a type they sort by name, then longer first, then wider first.
- **Numbers:** groups are numbered 1, 2, 3… in that order. The numbers label parts on the sheet layouts.
- **Banding:** the length is `Σ (long edges × L + short edges × W + extra) × qty`. It is bought as `ceil(length × 1.1 / 12)` feet.

## Sheet layouts

### Quick layout (always shown)

This is rip-first strip packing, per material, on a sheet of `length − 2 × trim` by `width − 2 × trim`, with the kerf between every cut.

1. Expand each group into single parts. A part that may ignore grain is turned so its long side runs along the sheet, if it fits.
2. Sort by width, widest first, then by length.
3. For each part:
   1. Find the strip it fits in (by width, and by length still free) with the least width wasted. Use it if the waste is at most `max(1 1/2″, 1/4 × part width)`.
   2. Otherwise open a new strip on the first sheet with room, using the narrower orientation.
   3. Otherwise use the best strip anyway.
   4. Otherwise start a new sheet.
4. A part that fits no sheet is a problem. The message names it and suggests splitting it or letting it ignore grain.
5. Each sheet reports its yield: parts area / full sheet area.

### Optimizer (on demand)

The owner starts it with a button and an effort (time budget). It runs in a background worker, so the page stays responsive.

**Strategies:** each try alternates between two three-stage guillotine packers: rip strips, crosscut segments, rip parts within a segment.

- **Strategy 1:** place each part into the best existing segment, then the best existing strip, then a new strip, then a new sheet. Waste tolerances decide when a fit is good enough.
- **Strategy 2:**
  1. Build whole strips first, filling each strip's length.
  2. Then put strips on sheets by best fit, widest first, with a little noise.

**Tries:**

- **Deterministic first:** 5 sort keys × 4 tolerance pairs × 2 strategies. The sort keys are:
  - width
  - length
  - area
  - long side
  - perimeter
- **Then random tries** until the time runs out: random key, tolerances, noise and orientation flips. The random numbers use a fixed seed, so a run can be repeated.
- **Score:** `sheets × 10⁹ + area used on the last sheet`. Fewer sheets wins, then the emptiest last sheet, which leaves the biggest leftover.

**Accepting the result:**

- A result is kept only if it uses no more sheets than the quick layout and the earlier optimized result.
- It is stored with a signature: sheet size, kerf, trim, and each group's number, size, quantity and grain choice. When anything changes, the page says "changed since you optimized" and shows the quick layout.
- The status shows how many layouts were tried and the area-based lower bound `ceil(parts area / usable sheet area)`.

### Cut steps

Each sheet lists its cuts in order:

- **"Rip a strip N″ wide"**, then numbered crosscuts:
  - **"Crosscut L″"**, with "rip to W″ wide" or "trim to L″ long" when the part is smaller than the strip or segment.
  - Repeated identical crosscuts are merged ("Crosscut 3 pieces at L″").
  - A segment holding several parts reads "Crosscut L″, then rip that piece into N", followed by its parts.
- **Leftovers:** a leftover over 2″ at the end of a strip, or along the sheet edge, is shown with its size.

## Materials, counts and cost

### Sheets and banding

- **Sheets:** the sheets in the shown layout (optimized if current, otherwise quick). The 3/4″ maple also gets the spare sheets.
- **Plywood total:** the sum of sheets × price, rounded to the dollar.
- **Edge banding:** as in the [cut list](#cut-list).

### Hardware

- **Hinges:** 2 to 5 per door by height. Angled hinges are for the diagonal door.
- **Slides:** pairs, by length.
- **Pulls:** door pulls, drawer pulls (2 on fronts over 30″) and false-front pulls.
- **Shelf pins:** 4 per adjustable, corner or open shelf.

### Consumables

Counts marked "+10%" are `ceil(count × 1.1)`. In the pocket screw formulas, `W` is the part's width (its second dimension), which is the length of the joint.

| Item | Count |
| --- | --- |
| Pocket screws 1 1/4″ (+10%) | For each Bottom, Top / bottom, Front stretcher, Rear nailer, Fixed shelf, Drawer shelf, Drawer partition, Corner top / bottom and Top board: `qty × 2 × max(2, ceil(W / 7))` |
| Pocket screws 1″ (+10%) | For each Drawer box front/back: `qty × 2 × max(2, ceil(W / 4))` |
| Brads 1″ (+10%) | `ceil(Σ backs qty × 2 × (L + W) / 4)` (every 4″ around each back) |
| Joining screws 1 1/4″ (+10%) | `4 × (cabinets − 1) + 6 × filler cleats + 6 × placed custom parts + 4 × upper gables`. Cabinets exclude custom parts, open spaces and shelves. |
| Drawer front screws 1″ (+10%) | `4 × drawers + 2 × false fronts` |
| Wood glue | `max(1, ceil(cabinets / 6))` bottles, 0 with no cabinets |
| Bumpers | `2 × (doors + drawers + false fronts)` |
| 2×4×8′ | see [Toe kick and platform](#toe-kick-and-platform) |
| Construction screws 3″ (+10%) | `4 × cross pieces + 10 × runs` |
| Cabinet screws 3″ (+10%) | `2 × rear nailers + 2 × placed custom parts` |
| Shims | `max(1, ceil(cabinets / 6))` bundles, 0 with no cabinets |
| Finish | `max(1, ceil(3/4″ area in sq ft × 2 faces × 3 coats / 450))` gallons, 0 with no parts. Set the price to 0 for prefinished plywood. |
| Sandpaper, filler, rags | one lump sum |

### Cost

- **Each line:** for items sold in packs (per 100 or per 1000), packs = `ceil(count / pack)`. Each line's cost is packs (or count) × price.
- **Tax:** the line's cost × tax rate. Each line shows subtotal, tax and total.
- **Grand total:** the sum of all lines, plus tax.
- **Display:** money is shown to the cent.

## Worked examples

These come from the prototype with all defaults. The engine's golden tests must reproduce them. Sizes are rounded to 1/32″.

**24″ base, doors:**

- Side 31 × 23 5/8 × 2 (1L)
- Bottom 22 9/16 × 23 5/8 × 1 (1L)
- Front stretcher 22 9/16 × 4 × 1 (1L)
- Rear nailer 22 9/16 × 4 × 2
- Back 31 × 24 × 1
- Door 30 7/8 × 23 7/8 × 1 (all)
- Adjustable shelf 22 1/2 × 23 3/8 × 1 (1L)
- Hardware: 2 hinges, 1 pull, 4 pins.

**18″ base, 3 drawers, 6″ top front:**

- Box as above with 16 9/16″ inside parts and an 18″ wide back.
- Drawer fronts 17 7/8 × 6 × 1 and 17 7/8 × 12 5/16 × 2.
- Drawer box sides 22 × 5 × 2 and 22 × 11 5/16 × 4.
- Drawer box front/back 14 9/16 × 5 × 2 and 14 9/16 × 11 5/16 × 4.
- Drawer bottoms 15 × 21 7/16 × 3.
- Hardware: three 22″ slide pairs, 3 pulls.

**36″ sink base (drawer + doors, false front):**

- Bottom, stretcher and nailers 34 9/16″.
- False front 35 7/8 × 6 × 1.
- Doors 24 3/4 × 17 7/8 × 2.
- Shelf 34 1/2 × 23 3/8 × 1, with a sag warning.
- Hardware: 4 hinges, 2 pulls and 2 false-front pulls.

**42″ base blind corner on the left wall, 3″ filler, top drawer:**

- `blindX = 27 19/32`
- Blind panel 30 7/8 × 27 17/32 × 1
- Drawer front 14 9/32 × 6 × 1
- Drawer box sides 22 × 5 × 2 and front/back 11 11/16 × 5 × 2
- Drawer bottom 12 1/8 × 21 7/16 × 1
- Drawer shelf 14 13/32 × 23 5/8 × 1
- Drawer partition 5 15/32 × 22 29/32 × 1
- Door 24 3/4 × 14 9/32 × 1
- Corner filler and filler cleat 30 7/8 × 3 × 1 each
- Shelf 40 1/2 × 23 3/8 × 1
- The other wall's bases start at 27 19/32.

**30″ upper:**

- Side 30 × 11 3/4 × 2
- Top / bottom 28 9/16 × 11 3/4 × 2
- Rear nailer 28 9/16 × 4 × 2
- Back 30 × 30 × 1
- Doors 29 7/8 × 14 7/8 × 2
- Shelves 28 1/2 × 11 1/2 × 2
- Hardware: 4 hinges, 8 pins.

**30″ × 18″ upper with gables:**

- Doors 17 7/8 × 14 7/8 × 2
- 1 shelf
- Upper gable 30 × 12 23/32 × 2
- Width on the wall 31 7/16

**30″ upper blind corner on the right wall:**

- `blindX = 15 23/32`
- Blind panel 29 7/8 × 15 21/32 × 1
- Door 29 7/8 × 14 5/32 × 1
- Corner filler and cleat 29 7/8 × 3 × 1 each

**24″ diagonal corner upper:**

- Corner side 30 × 12 15/32 × 2
- Corner top / bottom 23 1/32 × 23 1/32 × 2, with the cut edge banded 14 15/16
- Rear nailers 23 1/32 × 4 × 2 and 22 5/16 × 4 × 2
- Backs 30 × 24 and 30 × 23 3/4
- Corner shelf 23 × 23 × 2, with the cut edge banded 15 13/32
- Door 29 7/8 × 15 17/32 × 1
- Hardware: 2 angled hinges, 8 pins
- Diagonal width 16.9706

**24″ tall:**

- Side 80 1/2 × 23 3/4 × 2
- Top / bottom and fixed shelf 22 9/16 × 23 3/4
- Rear nailer × 3
- Back 80 1/2 × 24
- Lower door 30 7/8 × 23 7/8
- Upper door 49 3/8 × 23 7/8
- Shelves 22 1/2 × 23 1/2 × 4
- Hardware: 5 hinges.

**36″ open shelf with top board:** shelf board 35 15/16 × 24, top board 36 × 24.

The 22″ slide in these examples is the longest slide no longer than 23 5/8 − 23/32 − 1/4 = 22 21/32″. This example is for a 23 7/8″ base depth.

**Starter kitchen** (the prototype's example list, which follows the owner's SketchUp layout):

- **Left wall:**
  - Bases: B1 blind corner 0 to 42, B2 42 to 55 7/8, stove space, B3 86 1/8 to 104 1/8.
  - Uppers: diagonal corner U1, U2 24 1/32 to 55 9/32 (with a 1/32″ corner spare), U3 over the stove fixed at 55 9/32 to 86 23/32, U4 to 116 23/32.
- **Right wall:**
  - Bases: B4 27 5/8 to 45 5/8 (1/32″ corner spare), B5 to 66 9/16, sink base B6 fixed on the window 66 9/16 to 102 9/16, dishwasher to 126 9/16, end panel to 127 9/32.
  - Uppers: U5 24 5/8 to 54 5/8, U6 to 69 5/8, window, U7 99 1/2 to 126 1/2.
- **Countertops:** left 56″ and 18 1/4″, right 127 7/16″.
- **Toe kick strips:** 55 7/8″, 18″ and 74 15/16″.
- **Quick layout:** 11 sheets of 3/4″ (12 with the spare), 4 of 1/4″, 2 of 1/2″.
- **Hardware:** 32 hinges, 2 angled hinges, nine 22″ slide pairs, 28 pulls, 68 shelf pins, 370 ft of banding.
- **Consumables:** 291 and 97 pocket screws, 426 brads, 75 joining screws, 42 front screws, 3 glue, 54 bumpers, 7 2×4s, 95 construction screws, 64 cabinet screws, 3 shims, 5 gal finish.
- **Total:** subtotal $2,812.80, tax $365.66, total **$3,178.46**.

## Prototype quirks to decide

Each item here is how the prototype behaves today. Package 2 keeps it that way unless the owner decides otherwise.

1. **Corner countertop counted twice.** Both walls' countertop runs start at the corner, so the corner square (about base depth each way) is in both lengths. A proposed fix: the corner wall's top runs into the corner, and the other wall's top starts at the base depth.
2. **The toe kick behind the corner is listed.** The strip on the blind corner's wall starts at the corner, although the part behind the other wall's cabinets is hidden. It is cut to fit, so this only costs a little plywood.
3. **The toe kick in the shopping list uses widths, not runs.** It totals cabinet widths, while the cut list uses merged runs.
4. **The shelf sag warning uses the inside width** (over 32″), not the shelf length (1/16″ shorter).
5. **The sink is found by type.** "The sink base" is any drawer + doors cabinet with a false front.
6. **Fridge height is fixed at 70″.**
7. **Ids are not stable.** They renumber when the list order changes. The new app needs stable ids for saved files and for "line up with B1".
8. **One kitchen, two walls.** The prototype has one inside corner and a left and right wall, with one stove and one window. ADR-003 proposes how this generalizes to any wall in the plan.
