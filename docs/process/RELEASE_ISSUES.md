# Release issue ledger

| ID | Journey | Observed failure / evidence | Owner | First failing test | Retest | Status |
|---|---|---|---|---|---|---|
| P0-01 | HR -> SA -> first login | EMP-035 pending; its human approval and first-login result are not yet observed. Technical flow verified using synthetic test employees. Immutable EMP ID and SA-chosen permanent username are distinct. | Builder | Browser journey required | Focused API tests pass; operational decision pending | OPEN |
| P0-02 | SA roster / placement | Four-vertical operational roster, supervisor and team selector were not reconciled against the same environment. | Builder | Browser + API snapshot required | Desktop/mobile browser compares every team, REL, and caller row to live API; 2/2 pass | CLOSED |
| P0-03 | Data Entry -> caller | Bulk round robin, priority ordering, and team/vertical isolation need one end-to-end staging check. | Builder | Browser + API/DB checks required | Pending | OPEN |
| P0-04 | Deployment readiness | No database-backed readiness route or demonstrated backup/restore and VPS staging rehearsal. | DevOps + Builder | Staging smoke/restore required | Pending | OPEN |
| P0-05 | Release evidence | Requirements graph refresh reports stale fingerprints for Manager, Regional, National, CEO, CFO, Super Admin, and HR execution records. Reverify relevant release journeys before relying on prior PASS claims. | QA Lead | Fresh evidence integrity check required | Pending | OPEN |

Add a row for each newly reproduced defect. Preserve an audit trail: close with evidence, do not delete rows.
