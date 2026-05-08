Totally fair question — this flow is a little subtle, but yes, they all end up hitting the same edit endpoint.

Short answer: yes. Inline edits and active/inactive toggles both call scheduleAPI.editSchedule, which posts to /schedule/edit.

Here’s the call chain:

Inline edit: ScheduleTable calls onUpdate → handleInlineUpdate → scheduleAPI.editSchedule in src/_payroll/schedule/PayrollSchedule.tsx.

Toggle active/inactive: ScheduleTable calls onToggleStatus → handleToggleScheduleStatus → performStatusUpdate → scheduleAPI.editSchedule in src/_payroll/schedule/PayrollSchedule.tsx.

Toggle inactive → active also opens the modal, and the modal submit uses scheduleAPI.editSchedule in src/_payroll/schedule/ScheduleModal.tsx.


Files to check:

src/_payroll/schedule/PayrollSchedule.tsx
src/_payroll/schedule/ScheduleTable.tsx
src/_payroll/schedule/ScheduleModal.tsx
src/_payroll/schedule/schedule-api.ts
If you want different APIs for inline edits vs status changes, we’d add new methods in src/_payroll/schedule/schedule-api.ts and wire them in. Want me to split those?