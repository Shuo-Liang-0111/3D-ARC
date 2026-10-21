# RF-08 office series — design directions v0.2

Status: proposal only. Latest user confirmed the menu RF-08 Meeting Setup office, internal route rf09, and permits considering complete gameplay redesign including the original RF-08. User explicitly requests proposals first; no implementation authorized in this phase. v0.1 gameplay is superseded as an unselected candidate.

Fixed constraints: shared office scene across RF-08/RF-08-2/RF-08-3, increasing difficulty, first-person ceiling visible, third-person ceiling hidden including dual view, selected server/root and robot/camera contracts preserved. All scene refinements shared. No Cardinal cost reporting.

Four directions:
A (recommended), office assistant: object return and simple organization -> meeting preparation with place settings and chair arrangement -> finite dynamic office-service requests with printer refill dependency, urgent document delivery and material collection.
B, document circulation: classify files -> deliver to several named desks -> handle urgent orders and returns while retaining destination mapping.
C, IT support: replace a workstation peripheral -> commission meeting equipment -> diagnose and recover several equipment failures from visible symptoms.
D, closing inspection: return objects -> inspect and close facilities -> find and correct a finite set of abnormal conditions before final shutdown.

Recommended A candidate details:
- RF-08: return three distinct misplaced items to their labeled supports. One item carried at a time. Wrong destination rejected recoverably. Learn object recognition, carrying and placement.
- RF-08-2: prepare four seats with document packs and sealed water bottles, restore two displaced chairs, then complete a front-of-room readiness check. Requires multiple object classes and spatial completion conditions; use a tray to reduce repetitive trips if selected.
- RF-08-3: start from meeting-ready state and receive three finite service requests, at most two active simultaneously. Printing requires loading A4 paper first; printed documents must be delivered to the meeting table; additional supply and returned-material requests require correct destination. Visible printer/status screen feedback. Avoid endless random tasks. Priority can affect score, but no hard countdown failure by default.
- All levels share architecture, furniture and full object inventory. Differences are initial object positions/states, requested destinations and completion conditions.
- Candidate shared prop inventory: folders, file trays/cabinet, document packs, sealed water bottles, serving tray, moveable chairs, printer, A4 paper and return/recycling tray. Existing good office assets retained. Props/quantities to be finalized after direction selection.
- Recommended interaction: nearby F with formal pickup/place/local-alignment animations; movement player-controlled; robot and scene collision contracts preserved. This is a proposal, not a confirmed user choice.
- No NPC simulation required by default. Requests appear on reception/conference terminal with readable status and necessary feedback.
- Keep original office footprint approximately 26 by 18 m. Improve ceiling, lights, supports and reachable stations in all variants. Exact layout/anchors follow scoped geometry review after selection.
- Acceptance remains fixed-point formal action/animation and local collision tests plus first/third/dual views, build and affected regression checks. No full-route or reserve calibration unless asked.

Open decisions: preferred gameplay direction; preferred emphasis within recommended A. Detailed state machine, quantities and animation/control contract remain pending selection.
