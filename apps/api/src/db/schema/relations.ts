import { relations } from "drizzle-orm/relations";
import { leads, leadTasks, employees, regions, teams, assignments, leadEvents, sessions, availabilityChanges, savedViews, leadAudit, messages, enquiries, calls, reminders, qualifications, stageEvents, meetings, proposals, lossRecords, contactSuppressions, outcomeRequests, documentRequests, documents, reportExports, leadOwnershipEvents, allocationBatches, overdueEscalations, callQualityReviews, evidenceAccessLog, teamForecasts, teamTargets, targetAllocations, reviews, mentorships, teamReportExports, managementActions, reportSchedules, teamRequests, activityCorrections, managerForecasts, managerTargets, capacityPlans, leadTransferRequests, sourceRemediations, employeeLifecycleRequests, commercialExceptions, regionalManagementActions, territoryCoveragePlans, regionalTargets, crossManagerTransfers, regionalStaffingPlans, regionalForecasts, regionalEscalations, managerReviews, regionalReportSchedules, nationalManagementActions, nationalTargets, productRuleProposals, nationalForecasts, crossRegionTransfers, crossVerticalReferrals, nationalEscalations, rmReviews, growthInitiatives, nationalReportSchedules, companyTargets, companyForecasts, crossVerticalConflicts, periodReopenRequests, reportingPeriods, criticalOperatingRisks, nmLeadershipReviews, boardReportSchedules, executiveCommitments, financeLedgerEntries, salesFinanceHandoffs, receivableInvoices, bankSettledReceipts, receiptInvoiceMatches, financeReconciliations, refundRequests, incentiveCalculations, incentiveDisputes, forecastFinanceReviews, financePolicies } from './index';

export const leadTasksRelations = relations(leadTasks, ({one, many}) => ({
	lead: one(leads, {
		fields: [leadTasks.leadId],
		references: [leads.id]
	}),
	employee: one(employees, {
		fields: [leadTasks.ownerEmployeeId],
		references: [employees.id]
	}),
	reminders: many(reminders),
	overdueEscalations_recoveryTaskId: many(overdueEscalations, {
		relationName: "overdueEscalations_recoveryTaskId_leadTasks_id"
	}),
	overdueEscalations_taskId: many(overdueEscalations, {
		relationName: "overdueEscalations_taskId_leadTasks_id"
	}),
	callQualityReviews: many(callQualityReviews),
}));

export const leadsRelations = relations(leads, ({one, many}) => ({
	leadTasks: many(leadTasks),
	employee: one(employees, {
		fields: [leads.ownerEmployeeId],
		references: [employees.id]
	}),
	team: one(teams, {
		fields: [leads.teamId],
		references: [teams.id]
	}),
	leadEvents: many(leadEvents),
	leadAudits: many(leadAudit),
	messages: many(messages),
	enquiries_duplicateOf: many(enquiries, {
		relationName: "enquiries_duplicateOf_leads_id"
	}),
	enquiries_publishedLeadId: many(enquiries, {
		relationName: "enquiries_publishedLeadId_leads_id"
	}),
	calls: many(calls),
	qualifications: many(qualifications),
	stageEvents: many(stageEvents),
	meetings: many(meetings),
	proposals: many(proposals),
	lossRecords: many(lossRecords),
	contactSuppressions: many(contactSuppressions),
	outcomeRequests: many(outcomeRequests),
	documentRequests: many(documentRequests),
	documents: many(documents),
	leadOwnershipEvents: many(leadOwnershipEvents),
	overdueEscalations: many(overdueEscalations),
	teamRequests: many(teamRequests),
	commercialExceptions: many(commercialExceptions),
	crossVerticalReferrals: many(crossVerticalReferrals),
	crossVerticalConflicts: many(crossVerticalConflicts),
	salesFinanceHandoffs: many(salesFinanceHandoffs),
	receivableInvoices: many(receivableInvoices),
	refundRequests: many(refundRequests),
}));

export const employeesRelations = relations(employees, ({many}) => ({
	leadTasks: many(leadTasks),
	assignments: many(assignments),
	leads: many(leads),
	leadEvents: many(leadEvents),
	sessions: many(sessions),
	availabilityChanges: many(availabilityChanges),
	savedViews: many(savedViews),
	leadAudits: many(leadAudit),
	messages: many(messages),
	enquiries: many(enquiries),
	calls: many(calls),
	qualifications: many(qualifications),
	stageEvents: many(stageEvents),
	meetings: many(meetings),
	proposals_actorEmployeeId: many(proposals, {
		relationName: "proposals_actorEmployeeId_employees_id"
	}),
	proposals_approverEmployeeId: many(proposals, {
		relationName: "proposals_approverEmployeeId_employees_id"
	}),
	lossRecords: many(lossRecords),
	contactSuppressions: many(contactSuppressions),
	outcomeRequests_actorEmployeeId: many(outcomeRequests, {
		relationName: "outcomeRequests_actorEmployeeId_employees_id"
	}),
	outcomeRequests_decidedBy: many(outcomeRequests, {
		relationName: "outcomeRequests_decidedBy_employees_id"
	}),
	documentRequests: many(documentRequests),
	documents: many(documents),
	reportExports: many(reportExports),
	leadOwnershipEvents_actorEmployeeId: many(leadOwnershipEvents, {
		relationName: "leadOwnershipEvents_actorEmployeeId_employees_id"
	}),
	leadOwnershipEvents_fromOwnerEmployeeId: many(leadOwnershipEvents, {
		relationName: "leadOwnershipEvents_fromOwnerEmployeeId_employees_id"
	}),
	leadOwnershipEvents_toOwnerEmployeeId: many(leadOwnershipEvents, {
		relationName: "leadOwnershipEvents_toOwnerEmployeeId_employees_id"
	}),
	allocationBatches: many(allocationBatches),
	overdueEscalations_actorEmployeeId: many(overdueEscalations, {
		relationName: "overdueEscalations_actorEmployeeId_employees_id"
	}),
	overdueEscalations_subjectEmployeeId: many(overdueEscalations, {
		relationName: "overdueEscalations_subjectEmployeeId_employees_id"
	}),
	callQualityReviews_actorEmployeeId: many(callQualityReviews, {
		relationName: "callQualityReviews_actorEmployeeId_employees_id"
	}),
	callQualityReviews_subjectEmployeeId: many(callQualityReviews, {
		relationName: "callQualityReviews_subjectEmployeeId_employees_id"
	}),
	evidenceAccessLogs: many(evidenceAccessLog),
	teamForecasts: many(teamForecasts),
	teamTargets: many(teamTargets),
	targetAllocations: many(targetAllocations),
	reviews_employeeId: many(reviews, {
		relationName: "reviews_employeeId_employees_id"
	}),
	reviews_reviewerEmployeeId: many(reviews, {
		relationName: "reviews_reviewerEmployeeId_employees_id"
	}),
	mentorships_grantedBy: many(mentorships, {
		relationName: "mentorships_grantedBy_employees_id"
	}),
	mentorships_internEmployeeId: many(mentorships, {
		relationName: "mentorships_internEmployeeId_employees_id"
	}),
	mentorships_mentorEmployeeId: many(mentorships, {
		relationName: "mentorships_mentorEmployeeId_employees_id"
	}),
	teamReportExports: many(teamReportExports),
	managementActions_managerEmployeeId: many(managementActions, {
		relationName: "managementActions_managerEmployeeId_employees_id"
	}),
	managementActions_ownerEmployeeId: many(managementActions, {
		relationName: "managementActions_ownerEmployeeId_employees_id"
	}),
	managementActions_subjectTlEmployeeId: many(managementActions, {
		relationName: "managementActions_subjectTlEmployeeId_employees_id"
	}),
	reportSchedules: many(reportSchedules),
	teamRequests_actorEmployeeId: many(teamRequests, {
		relationName: "teamRequests_actorEmployeeId_employees_id"
	}),
	teamRequests_decidedBy: many(teamRequests, {
		relationName: "teamRequests_decidedBy_employees_id"
	}),
	teamRequests_subjectEmployeeId: many(teamRequests, {
		relationName: "teamRequests_subjectEmployeeId_employees_id"
	}),
	activityCorrections_actorEmployeeId: many(activityCorrections, {
		relationName: "activityCorrections_actorEmployeeId_employees_id"
	}),
	activityCorrections_decidedBy: many(activityCorrections, {
		relationName: "activityCorrections_decidedBy_employees_id"
	}),
	managerForecasts: many(managerForecasts),
	managerTargets: many(managerTargets),
	capacityPlans: many(capacityPlans),
	leadTransferRequests: many(leadTransferRequests),
	sourceRemediations: many(sourceRemediations),
	employeeLifecycleRequests_employeeId: many(employeeLifecycleRequests, {
		relationName: "employeeLifecycleRequests_employeeId_employees_id"
	}),
	employeeLifecycleRequests_managerEmployeeId: many(employeeLifecycleRequests, {
		relationName: "employeeLifecycleRequests_managerEmployeeId_employees_id"
	}),
	commercialExceptions_decidedByManagerEmployeeId: many(commercialExceptions, {
		relationName: "commercialExceptions_decidedByManagerEmployeeId_employees_id"
	}),
	commercialExceptions_requestedByEmployeeId: many(commercialExceptions, {
		relationName: "commercialExceptions_requestedByEmployeeId_employees_id"
	}),
	regionalManagementActions_ownerEmployeeId: many(regionalManagementActions, {
		relationName: "regionalManagementActions_ownerEmployeeId_employees_id"
	}),
	regionalManagementActions_rmEmployeeId: many(regionalManagementActions, {
		relationName: "regionalManagementActions_rmEmployeeId_employees_id"
	}),
	regionalManagementActions_subjectManagerEmployeeId: many(regionalManagementActions, {
		relationName: "regionalManagementActions_subjectManagerEmployeeId_employees_id"
	}),
	territoryCoveragePlans: many(territoryCoveragePlans),
	regionalTargets: many(regionalTargets),
	crossManagerTransfers_destinationManagerEmployeeId: many(crossManagerTransfers, {
		relationName: "crossManagerTransfers_destinationManagerEmployeeId_employees_id"
	}),
	crossManagerTransfers_rmEmployeeId: many(crossManagerTransfers, {
		relationName: "crossManagerTransfers_rmEmployeeId_employees_id"
	}),
	crossManagerTransfers_sourceManagerEmployeeId: many(crossManagerTransfers, {
		relationName: "crossManagerTransfers_sourceManagerEmployeeId_employees_id"
	}),
	regionalStaffingPlans: many(regionalStaffingPlans),
	regionalForecasts: many(regionalForecasts),
	regionalEscalations_accountableManagerEmployeeId: many(regionalEscalations, {
		relationName: "regionalEscalations_accountableManagerEmployeeId_employees_id"
	}),
	regionalEscalations_rmEmployeeId: many(regionalEscalations, {
		relationName: "regionalEscalations_rmEmployeeId_employees_id"
	}),
	managerReviews_managerEmployeeId: many(managerReviews, {
		relationName: "managerReviews_managerEmployeeId_employees_id"
	}),
	managerReviews_rmEmployeeId: many(managerReviews, {
		relationName: "managerReviews_rmEmployeeId_employees_id"
	}),
	regionalReportSchedules: many(regionalReportSchedules),
	nationalManagementActions_nmEmployeeId: many(nationalManagementActions, {
		relationName: "nationalManagementActions_nmEmployeeId_employees_id"
	}),
	nationalManagementActions_ownerEmployeeId: many(nationalManagementActions, {
		relationName: "nationalManagementActions_ownerEmployeeId_employees_id"
	}),
	nationalManagementActions_subjectRmEmployeeId: many(nationalManagementActions, {
		relationName: "nationalManagementActions_subjectRmEmployeeId_employees_id"
	}),
	nationalTargets: many(nationalTargets),
	productRuleProposals: many(productRuleProposals),
	nationalForecasts: many(nationalForecasts),
	crossRegionTransfers: many(crossRegionTransfers),
	nationalEscalations: many(nationalEscalations),
	rmReviews_nmEmployeeId: many(rmReviews, {
		relationName: "rmReviews_nmEmployeeId_employees_id"
	}),
	rmReviews_rmEmployeeId: many(rmReviews, {
		relationName: "rmReviews_rmEmployeeId_employees_id"
	}),
	growthInitiatives: many(growthInitiatives),
	nationalReportSchedules: many(nationalReportSchedules),
	companyTargets: many(companyTargets),
	companyForecasts: many(companyForecasts),
	crossVerticalConflicts: many(crossVerticalConflicts),
	periodReopenRequests_authorizedByEmployeeId: many(periodReopenRequests, {
		relationName: "periodReopenRequests_authorizedByEmployeeId_employees_id"
	}),
	periodReopenRequests_requestedByEmployeeId: many(periodReopenRequests, {
		relationName: "periodReopenRequests_requestedByEmployeeId_employees_id"
	}),
	criticalOperatingRisks: many(criticalOperatingRisks),
	nmLeadershipReviews_ceoEmployeeId: many(nmLeadershipReviews, {
		relationName: "nmLeadershipReviews_ceoEmployeeId_employees_id"
	}),
	nmLeadershipReviews_nmEmployeeId: many(nmLeadershipReviews, {
		relationName: "nmLeadershipReviews_nmEmployeeId_employees_id"
	}),
	boardReportSchedules: many(boardReportSchedules),
	executiveCommitments: many(executiveCommitments),
	reportingPeriods: many(reportingPeriods),
	financeLedgerEntries_approvedByEmployeeId: many(financeLedgerEntries, {
		relationName: "financeLedgerEntries_approvedByEmployeeId_employees_id"
	}),
	financeLedgerEntries_preparedByEmployeeId: many(financeLedgerEntries, {
		relationName: "financeLedgerEntries_preparedByEmployeeId_employees_id"
	}),
	salesFinanceHandoffs_salesRepEmployeeId: many(salesFinanceHandoffs, {
		relationName: "salesFinanceHandoffs_salesRepEmployeeId_employees_id"
	}),
	salesFinanceHandoffs_verifiedByEmployeeId: many(salesFinanceHandoffs, {
		relationName: "salesFinanceHandoffs_verifiedByEmployeeId_employees_id"
	}),
	receivableInvoices: many(receivableInvoices),
	receiptInvoiceMatches: many(receiptInvoiceMatches),
	financeReconciliations: many(financeReconciliations),
	refundRequests: many(refundRequests),
	incentiveCalculations: many(incentiveCalculations),
	incentiveDisputes_employeeId: many(incentiveDisputes, {
		relationName: "incentiveDisputes_employeeId_employees_id"
	}),
	incentiveDisputes_resolvedByEmployeeId: many(incentiveDisputes, {
		relationName: "incentiveDisputes_resolvedByEmployeeId_employees_id"
	}),
	forecastFinanceReviews: many(forecastFinanceReviews),
	financePolicies_approvedByEmployeeId: many(financePolicies, {
		relationName: "financePolicies_approvedByEmployeeId_employees_id"
	}),
	financePolicies_proposedByEmployeeId: many(financePolicies, {
		relationName: "financePolicies_proposedByEmployeeId_employees_id"
	}),
}));

export const teamsRelations = relations(teams, ({one, many}) => ({
	region: one(regions, {
		fields: [teams.regionId],
		references: [regions.id]
	}),
	assignments: many(assignments),
	leads: many(leads),
	leadOwnershipEvents: many(leadOwnershipEvents),
	allocationBatches: many(allocationBatches),
	teamForecasts: many(teamForecasts),
	teamTargets: many(teamTargets),
	managementActions: many(managementActions),
	teamRequests: many(teamRequests),
	leadTransferRequests_destinationTeamId: many(leadTransferRequests, {
		relationName: "leadTransferRequests_destinationTeamId_teams_id"
	}),
	leadTransferRequests_sourceTeamId: many(leadTransferRequests, {
		relationName: "leadTransferRequests_sourceTeamId_teams_id"
	}),
	employeeLifecycleRequests: many(employeeLifecycleRequests),
	crossManagerTransfers_destinationTeamId: many(crossManagerTransfers, {
		relationName: "crossManagerTransfers_destinationTeamId_teams_id"
	}),
	crossManagerTransfers_sourceTeamId: many(crossManagerTransfers, {
		relationName: "crossManagerTransfers_sourceTeamId_teams_id"
	}),
	bankSettledReceipts: many(bankSettledReceipts),
}));

export const regionsRelations = relations(regions, ({many}) => ({
	teams: many(teams),
	regionalManagementActions: many(regionalManagementActions),
	territoryCoveragePlans: many(territoryCoveragePlans),
	regionalTargets: many(regionalTargets),
	regionalStaffingPlans: many(regionalStaffingPlans),
	regionalForecasts: many(regionalForecasts),
	regionalEscalations: many(regionalEscalations),
	regionalReportSchedules: many(regionalReportSchedules),
	nationalManagementActions: many(nationalManagementActions),
	crossRegionTransfers_destinationRegionId: many(crossRegionTransfers, {
		relationName: "crossRegionTransfers_destinationRegionId_regions_id"
	}),
	crossRegionTransfers_sourceRegionId: many(crossRegionTransfers, {
		relationName: "crossRegionTransfers_sourceRegionId_regions_id"
	}),
}));

export const assignmentsRelations = relations(assignments, ({one, many}) => ({
	employee: one(employees, {
		fields: [assignments.employeeId],
		references: [employees.id]
	}),
	team: one(teams, {
		fields: [assignments.teamId],
		references: [teams.id]
	}),
	leadOwnershipEvents: many(leadOwnershipEvents),
}));

export const leadEventsRelations = relations(leadEvents, ({one}) => ({
	employee: one(employees, {
		fields: [leadEvents.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [leadEvents.leadId],
		references: [leads.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	employee: one(employees, {
		fields: [sessions.employeeId],
		references: [employees.id]
	}),
}));

export const availabilityChangesRelations = relations(availabilityChanges, ({one}) => ({
	employee: one(employees, {
		fields: [availabilityChanges.employeeId],
		references: [employees.id]
	}),
}));

export const savedViewsRelations = relations(savedViews, ({one}) => ({
	employee: one(employees, {
		fields: [savedViews.employeeId],
		references: [employees.id]
	}),
}));

export const leadAuditRelations = relations(leadAudit, ({one}) => ({
	employee: one(employees, {
		fields: [leadAudit.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [leadAudit.leadId],
		references: [leads.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	employee: one(employees, {
		fields: [messages.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [messages.leadId],
		references: [leads.id]
	}),
}));

export const enquiriesRelations = relations(enquiries, ({one}) => ({
	employee: one(employees, {
		fields: [enquiries.createdBy],
		references: [employees.id]
	}),
	lead_duplicateOf: one(leads, {
		fields: [enquiries.duplicateOf],
		references: [leads.id],
		relationName: "enquiries_duplicateOf_leads_id"
	}),
	lead_publishedLeadId: one(leads, {
		fields: [enquiries.publishedLeadId],
		references: [leads.id],
		relationName: "enquiries_publishedLeadId_leads_id"
	}),
}));

export const callsRelations = relations(calls, ({one, many}) => ({
	employee: one(employees, {
		fields: [calls.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [calls.leadId],
		references: [leads.id]
	}),
	callQualityReviews: many(callQualityReviews),
	activityCorrections: many(activityCorrections),
}));

export const remindersRelations = relations(reminders, ({one}) => ({
	leadTask: one(leadTasks, {
		fields: [reminders.taskId],
		references: [leadTasks.id]
	}),
}));

export const qualificationsRelations = relations(qualifications, ({one}) => ({
	employee: one(employees, {
		fields: [qualifications.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [qualifications.leadId],
		references: [leads.id]
	}),
}));

export const stageEventsRelations = relations(stageEvents, ({one}) => ({
	employee: one(employees, {
		fields: [stageEvents.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [stageEvents.leadId],
		references: [leads.id]
	}),
}));

export const meetingsRelations = relations(meetings, ({one}) => ({
	employee: one(employees, {
		fields: [meetings.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [meetings.leadId],
		references: [leads.id]
	}),
}));

export const proposalsRelations = relations(proposals, ({one}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [proposals.actorEmployeeId],
		references: [employees.id],
		relationName: "proposals_actorEmployeeId_employees_id"
	}),
	employee_approverEmployeeId: one(employees, {
		fields: [proposals.approverEmployeeId],
		references: [employees.id],
		relationName: "proposals_approverEmployeeId_employees_id"
	}),
	lead: one(leads, {
		fields: [proposals.leadId],
		references: [leads.id]
	}),
}));

export const lossRecordsRelations = relations(lossRecords, ({one}) => ({
	employee: one(employees, {
		fields: [lossRecords.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [lossRecords.leadId],
		references: [leads.id]
	}),
}));

export const contactSuppressionsRelations = relations(contactSuppressions, ({one}) => ({
	employee: one(employees, {
		fields: [contactSuppressions.createdBy],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [contactSuppressions.leadId],
		references: [leads.id]
	}),
}));

export const outcomeRequestsRelations = relations(outcomeRequests, ({one}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [outcomeRequests.actorEmployeeId],
		references: [employees.id],
		relationName: "outcomeRequests_actorEmployeeId_employees_id"
	}),
	employee_decidedBy: one(employees, {
		fields: [outcomeRequests.decidedBy],
		references: [employees.id],
		relationName: "outcomeRequests_decidedBy_employees_id"
	}),
	lead: one(leads, {
		fields: [outcomeRequests.leadId],
		references: [leads.id]
	}),
}));

export const documentRequestsRelations = relations(documentRequests, ({one, many}) => ({
	employee: one(employees, {
		fields: [documentRequests.actorEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [documentRequests.leadId],
		references: [leads.id]
	}),
	documents: many(documents),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	lead: one(leads, {
		fields: [documents.leadId],
		references: [leads.id]
	}),
	documentRequest: one(documentRequests, {
		fields: [documents.requestId],
		references: [documentRequests.id]
	}),
	employee: one(employees, {
		fields: [documents.uploadedBy],
		references: [employees.id]
	}),
}));

export const reportExportsRelations = relations(reportExports, ({one}) => ({
	employee: one(employees, {
		fields: [reportExports.employeeId],
		references: [employees.id]
	}),
}));

export const leadOwnershipEventsRelations = relations(leadOwnershipEvents, ({one}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [leadOwnershipEvents.actorEmployeeId],
		references: [employees.id],
		relationName: "leadOwnershipEvents_actorEmployeeId_employees_id"
	}),
	team: one(teams, {
		fields: [leadOwnershipEvents.actorTeamId],
		references: [teams.id]
	}),
	assignment: one(assignments, {
		fields: [leadOwnershipEvents.assignmentId],
		references: [assignments.id]
	}),
	employee_fromOwnerEmployeeId: one(employees, {
		fields: [leadOwnershipEvents.fromOwnerEmployeeId],
		references: [employees.id],
		relationName: "leadOwnershipEvents_fromOwnerEmployeeId_employees_id"
	}),
	lead: one(leads, {
		fields: [leadOwnershipEvents.leadId],
		references: [leads.id]
	}),
	employee_toOwnerEmployeeId: one(employees, {
		fields: [leadOwnershipEvents.toOwnerEmployeeId],
		references: [employees.id],
		relationName: "leadOwnershipEvents_toOwnerEmployeeId_employees_id"
	}),
}));

export const allocationBatchesRelations = relations(allocationBatches, ({one}) => ({
	employee: one(employees, {
		fields: [allocationBatches.actorEmployeeId],
		references: [employees.id]
	}),
	team: one(teams, {
		fields: [allocationBatches.actorTeamId],
		references: [teams.id]
	}),
}));

export const overdueEscalationsRelations = relations(overdueEscalations, ({one}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [overdueEscalations.actorEmployeeId],
		references: [employees.id],
		relationName: "overdueEscalations_actorEmployeeId_employees_id"
	}),
	lead: one(leads, {
		fields: [overdueEscalations.leadId],
		references: [leads.id]
	}),
	leadTask_recoveryTaskId: one(leadTasks, {
		fields: [overdueEscalations.recoveryTaskId],
		references: [leadTasks.id],
		relationName: "overdueEscalations_recoveryTaskId_leadTasks_id"
	}),
	employee_subjectEmployeeId: one(employees, {
		fields: [overdueEscalations.subjectEmployeeId],
		references: [employees.id],
		relationName: "overdueEscalations_subjectEmployeeId_employees_id"
	}),
	leadTask_taskId: one(leadTasks, {
		fields: [overdueEscalations.taskId],
		references: [leadTasks.id],
		relationName: "overdueEscalations_taskId_leadTasks_id"
	}),
}));

export const callQualityReviewsRelations = relations(callQualityReviews, ({one, many}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [callQualityReviews.actorEmployeeId],
		references: [employees.id],
		relationName: "callQualityReviews_actorEmployeeId_employees_id"
	}),
	call: one(calls, {
		fields: [callQualityReviews.callId],
		references: [calls.id]
	}),
	leadTask: one(leadTasks, {
		fields: [callQualityReviews.coachingTaskId],
		references: [leadTasks.id]
	}),
	employee_subjectEmployeeId: one(employees, {
		fields: [callQualityReviews.subjectEmployeeId],
		references: [employees.id],
		relationName: "callQualityReviews_subjectEmployeeId_employees_id"
	}),
	evidenceAccessLogs: many(evidenceAccessLog),
}));

export const evidenceAccessLogRelations = relations(evidenceAccessLog, ({one}) => ({
	employee: one(employees, {
		fields: [evidenceAccessLog.actorEmployeeId],
		references: [employees.id]
	}),
	callQualityReview: one(callQualityReviews, {
		fields: [evidenceAccessLog.reviewId],
		references: [callQualityReviews.id]
	}),
}));

export const teamForecastsRelations = relations(teamForecasts, ({one}) => ({
	employee: one(employees, {
		fields: [teamForecasts.actorEmployeeId],
		references: [employees.id]
	}),
	team: one(teams, {
		fields: [teamForecasts.teamId],
		references: [teams.id]
	}),
}));

export const teamTargetsRelations = relations(teamTargets, ({one, many}) => ({
	employee: one(employees, {
		fields: [teamTargets.createdBy],
		references: [employees.id]
	}),
	team: one(teams, {
		fields: [teamTargets.teamId],
		references: [teams.id]
	}),
	targetAllocations: many(targetAllocations),
}));

export const targetAllocationsRelations = relations(targetAllocations, ({one}) => ({
	employee: one(employees, {
		fields: [targetAllocations.employeeId],
		references: [employees.id]
	}),
	teamTarget: one(teamTargets, {
		fields: [targetAllocations.targetId],
		references: [teamTargets.id]
	}),
}));

export const reviewsRelations = relations(reviews, ({one}) => ({
	employee_employeeId: one(employees, {
		fields: [reviews.employeeId],
		references: [employees.id],
		relationName: "reviews_employeeId_employees_id"
	}),
	employee_reviewerEmployeeId: one(employees, {
		fields: [reviews.reviewerEmployeeId],
		references: [employees.id],
		relationName: "reviews_reviewerEmployeeId_employees_id"
	}),
}));

export const mentorshipsRelations = relations(mentorships, ({one}) => ({
	employee_grantedBy: one(employees, {
		fields: [mentorships.grantedBy],
		references: [employees.id],
		relationName: "mentorships_grantedBy_employees_id"
	}),
	employee_internEmployeeId: one(employees, {
		fields: [mentorships.internEmployeeId],
		references: [employees.id],
		relationName: "mentorships_internEmployeeId_employees_id"
	}),
	employee_mentorEmployeeId: one(employees, {
		fields: [mentorships.mentorEmployeeId],
		references: [employees.id],
		relationName: "mentorships_mentorEmployeeId_employees_id"
	}),
}));

export const teamReportExportsRelations = relations(teamReportExports, ({one}) => ({
	employee: one(employees, {
		fields: [teamReportExports.actorEmployeeId],
		references: [employees.id]
	}),
}));

export const managementActionsRelations = relations(managementActions, ({one}) => ({
	employee_managerEmployeeId: one(employees, {
		fields: [managementActions.managerEmployeeId],
		references: [employees.id],
		relationName: "managementActions_managerEmployeeId_employees_id"
	}),
	employee_ownerEmployeeId: one(employees, {
		fields: [managementActions.ownerEmployeeId],
		references: [employees.id],
		relationName: "managementActions_ownerEmployeeId_employees_id"
	}),
	employee_subjectTlEmployeeId: one(employees, {
		fields: [managementActions.subjectTlEmployeeId],
		references: [employees.id],
		relationName: "managementActions_subjectTlEmployeeId_employees_id"
	}),
	team: one(teams, {
		fields: [managementActions.teamId],
		references: [teams.id]
	}),
}));

export const reportSchedulesRelations = relations(reportSchedules, ({one}) => ({
	employee: one(employees, {
		fields: [reportSchedules.ownerEmployeeId],
		references: [employees.id]
	}),
}));

export const teamRequestsRelations = relations(teamRequests, ({one}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [teamRequests.actorEmployeeId],
		references: [employees.id],
		relationName: "teamRequests_actorEmployeeId_employees_id"
	}),
	employee_decidedBy: one(employees, {
		fields: [teamRequests.decidedBy],
		references: [employees.id],
		relationName: "teamRequests_decidedBy_employees_id"
	}),
	lead: one(leads, {
		fields: [teamRequests.leadId],
		references: [leads.id]
	}),
	employee_subjectEmployeeId: one(employees, {
		fields: [teamRequests.subjectEmployeeId],
		references: [employees.id],
		relationName: "teamRequests_subjectEmployeeId_employees_id"
	}),
	team: one(teams, {
		fields: [teamRequests.teamId],
		references: [teams.id]
	}),
}));

export const activityCorrectionsRelations = relations(activityCorrections, ({one}) => ({
	employee_actorEmployeeId: one(employees, {
		fields: [activityCorrections.actorEmployeeId],
		references: [employees.id],
		relationName: "activityCorrections_actorEmployeeId_employees_id"
	}),
	call: one(calls, {
		fields: [activityCorrections.callId],
		references: [calls.id]
	}),
	employee_decidedBy: one(employees, {
		fields: [activityCorrections.decidedBy],
		references: [employees.id],
		relationName: "activityCorrections_decidedBy_employees_id"
	}),
}));

export const managerForecastsRelations = relations(managerForecasts, ({one}) => ({
	employee: one(employees, {
		fields: [managerForecasts.managerEmployeeId],
		references: [employees.id]
	}),
}));

export const managerTargetsRelations = relations(managerTargets, ({one}) => ({
	employee: one(employees, {
		fields: [managerTargets.managerEmployeeId],
		references: [employees.id]
	}),
}));

export const capacityPlansRelations = relations(capacityPlans, ({one}) => ({
	employee: one(employees, {
		fields: [capacityPlans.managerEmployeeId],
		references: [employees.id]
	}),
}));

export const leadTransferRequestsRelations = relations(leadTransferRequests, ({one}) => ({
	team_destinationTeamId: one(teams, {
		fields: [leadTransferRequests.destinationTeamId],
		references: [teams.id],
		relationName: "leadTransferRequests_destinationTeamId_teams_id"
	}),
	employee: one(employees, {
		fields: [leadTransferRequests.managerEmployeeId],
		references: [employees.id]
	}),
	team_sourceTeamId: one(teams, {
		fields: [leadTransferRequests.sourceTeamId],
		references: [teams.id],
		relationName: "leadTransferRequests_sourceTeamId_teams_id"
	}),
}));

export const sourceRemediationsRelations = relations(sourceRemediations, ({one}) => ({
	employee: one(employees, {
		fields: [sourceRemediations.managerEmployeeId],
		references: [employees.id]
	}),
}));

export const employeeLifecycleRequestsRelations = relations(employeeLifecycleRequests, ({one}) => ({
	employee_employeeId: one(employees, {
		fields: [employeeLifecycleRequests.employeeId],
		references: [employees.id],
		relationName: "employeeLifecycleRequests_employeeId_employees_id"
	}),
	employee_managerEmployeeId: one(employees, {
		fields: [employeeLifecycleRequests.managerEmployeeId],
		references: [employees.id],
		relationName: "employeeLifecycleRequests_managerEmployeeId_employees_id"
	}),
	team: one(teams, {
		fields: [employeeLifecycleRequests.proposedTeamId],
		references: [teams.id]
	}),
}));

export const commercialExceptionsRelations = relations(commercialExceptions, ({one}) => ({
	employee_decidedByManagerEmployeeId: one(employees, {
		fields: [commercialExceptions.decidedByManagerEmployeeId],
		references: [employees.id],
		relationName: "commercialExceptions_decidedByManagerEmployeeId_employees_id"
	}),
	lead: one(leads, {
		fields: [commercialExceptions.leadId],
		references: [leads.id]
	}),
	employee_requestedByEmployeeId: one(employees, {
		fields: [commercialExceptions.requestedByEmployeeId],
		references: [employees.id],
		relationName: "commercialExceptions_requestedByEmployeeId_employees_id"
	}),
}));

export const regionalManagementActionsRelations = relations(regionalManagementActions, ({one}) => ({
	employee_ownerEmployeeId: one(employees, {
		fields: [regionalManagementActions.ownerEmployeeId],
		references: [employees.id],
		relationName: "regionalManagementActions_ownerEmployeeId_employees_id"
	}),
	region: one(regions, {
		fields: [regionalManagementActions.regionId],
		references: [regions.id]
	}),
	employee_rmEmployeeId: one(employees, {
		fields: [regionalManagementActions.rmEmployeeId],
		references: [employees.id],
		relationName: "regionalManagementActions_rmEmployeeId_employees_id"
	}),
	employee_subjectManagerEmployeeId: one(employees, {
		fields: [regionalManagementActions.subjectManagerEmployeeId],
		references: [employees.id],
		relationName: "regionalManagementActions_subjectManagerEmployeeId_employees_id"
	}),
}));

export const territoryCoveragePlansRelations = relations(territoryCoveragePlans, ({one}) => ({
	region: one(regions, {
		fields: [territoryCoveragePlans.regionId],
		references: [regions.id]
	}),
	employee: one(employees, {
		fields: [territoryCoveragePlans.rmEmployeeId],
		references: [employees.id]
	}),
}));

export const regionalTargetsRelations = relations(regionalTargets, ({one}) => ({
	region: one(regions, {
		fields: [regionalTargets.regionId],
		references: [regions.id]
	}),
	employee: one(employees, {
		fields: [regionalTargets.rmEmployeeId],
		references: [employees.id]
	}),
}));

export const crossManagerTransfersRelations = relations(crossManagerTransfers, ({one}) => ({
	employee_destinationManagerEmployeeId: one(employees, {
		fields: [crossManagerTransfers.destinationManagerEmployeeId],
		references: [employees.id],
		relationName: "crossManagerTransfers_destinationManagerEmployeeId_employees_id"
	}),
	team_destinationTeamId: one(teams, {
		fields: [crossManagerTransfers.destinationTeamId],
		references: [teams.id],
		relationName: "crossManagerTransfers_destinationTeamId_teams_id"
	}),
	employee_rmEmployeeId: one(employees, {
		fields: [crossManagerTransfers.rmEmployeeId],
		references: [employees.id],
		relationName: "crossManagerTransfers_rmEmployeeId_employees_id"
	}),
	employee_sourceManagerEmployeeId: one(employees, {
		fields: [crossManagerTransfers.sourceManagerEmployeeId],
		references: [employees.id],
		relationName: "crossManagerTransfers_sourceManagerEmployeeId_employees_id"
	}),
	team_sourceTeamId: one(teams, {
		fields: [crossManagerTransfers.sourceTeamId],
		references: [teams.id],
		relationName: "crossManagerTransfers_sourceTeamId_teams_id"
	}),
}));

export const regionalStaffingPlansRelations = relations(regionalStaffingPlans, ({one}) => ({
	region: one(regions, {
		fields: [regionalStaffingPlans.regionId],
		references: [regions.id]
	}),
	employee: one(employees, {
		fields: [regionalStaffingPlans.rmEmployeeId],
		references: [employees.id]
	}),
}));

export const regionalForecastsRelations = relations(regionalForecasts, ({one}) => ({
	region: one(regions, {
		fields: [regionalForecasts.regionId],
		references: [regions.id]
	}),
	employee: one(employees, {
		fields: [regionalForecasts.rmEmployeeId],
		references: [employees.id]
	}),
}));

export const regionalEscalationsRelations = relations(regionalEscalations, ({one}) => ({
	employee_accountableManagerEmployeeId: one(employees, {
		fields: [regionalEscalations.accountableManagerEmployeeId],
		references: [employees.id],
		relationName: "regionalEscalations_accountableManagerEmployeeId_employees_id"
	}),
	region: one(regions, {
		fields: [regionalEscalations.regionId],
		references: [regions.id]
	}),
	employee_rmEmployeeId: one(employees, {
		fields: [regionalEscalations.rmEmployeeId],
		references: [employees.id],
		relationName: "regionalEscalations_rmEmployeeId_employees_id"
	}),
}));

export const managerReviewsRelations = relations(managerReviews, ({one}) => ({
	employee_managerEmployeeId: one(employees, {
		fields: [managerReviews.managerEmployeeId],
		references: [employees.id],
		relationName: "managerReviews_managerEmployeeId_employees_id"
	}),
	employee_rmEmployeeId: one(employees, {
		fields: [managerReviews.rmEmployeeId],
		references: [employees.id],
		relationName: "managerReviews_rmEmployeeId_employees_id"
	}),
}));

export const regionalReportSchedulesRelations = relations(regionalReportSchedules, ({one}) => ({
	region: one(regions, {
		fields: [regionalReportSchedules.regionId],
		references: [regions.id]
	}),
	employee: one(employees, {
		fields: [regionalReportSchedules.rmEmployeeId],
		references: [employees.id]
	}),
}));

export const nationalManagementActionsRelations = relations(nationalManagementActions, ({one}) => ({
	employee_nmEmployeeId: one(employees, {
		fields: [nationalManagementActions.nmEmployeeId],
		references: [employees.id],
		relationName: "nationalManagementActions_nmEmployeeId_employees_id"
	}),
	employee_ownerEmployeeId: one(employees, {
		fields: [nationalManagementActions.ownerEmployeeId],
		references: [employees.id],
		relationName: "nationalManagementActions_ownerEmployeeId_employees_id"
	}),
	region: one(regions, {
		fields: [nationalManagementActions.regionId],
		references: [regions.id]
	}),
	employee_subjectRmEmployeeId: one(employees, {
		fields: [nationalManagementActions.subjectRmEmployeeId],
		references: [employees.id],
		relationName: "nationalManagementActions_subjectRmEmployeeId_employees_id"
	}),
}));

export const nationalTargetsRelations = relations(nationalTargets, ({one}) => ({
	employee: one(employees, {
		fields: [nationalTargets.nmEmployeeId],
		references: [employees.id]
	}),
}));

export const productRuleProposalsRelations = relations(productRuleProposals, ({one}) => ({
	employee: one(employees, {
		fields: [productRuleProposals.nmEmployeeId],
		references: [employees.id]
	}),
}));

export const nationalForecastsRelations = relations(nationalForecasts, ({one}) => ({
	employee: one(employees, {
		fields: [nationalForecasts.nmEmployeeId],
		references: [employees.id]
	}),
}));

export const crossRegionTransfersRelations = relations(crossRegionTransfers, ({one}) => ({
	region_destinationRegionId: one(regions, {
		fields: [crossRegionTransfers.destinationRegionId],
		references: [regions.id],
		relationName: "crossRegionTransfers_destinationRegionId_regions_id"
	}),
	employee: one(employees, {
		fields: [crossRegionTransfers.nmEmployeeId],
		references: [employees.id]
	}),
	region_sourceRegionId: one(regions, {
		fields: [crossRegionTransfers.sourceRegionId],
		references: [regions.id],
		relationName: "crossRegionTransfers_sourceRegionId_regions_id"
	}),
}));

export const crossVerticalReferralsRelations = relations(crossVerticalReferrals, ({one}) => ({
	lead: one(leads, {
		fields: [crossVerticalReferrals.receivingLeadId],
		references: [leads.id]
	}),
}));

export const nationalEscalationsRelations = relations(nationalEscalations, ({one}) => ({
	employee: one(employees, {
		fields: [nationalEscalations.nmEmployeeId],
		references: [employees.id]
	}),
}));

export const rmReviewsRelations = relations(rmReviews, ({one}) => ({
	employee_nmEmployeeId: one(employees, {
		fields: [rmReviews.nmEmployeeId],
		references: [employees.id],
		relationName: "rmReviews_nmEmployeeId_employees_id"
	}),
	employee_rmEmployeeId: one(employees, {
		fields: [rmReviews.rmEmployeeId],
		references: [employees.id],
		relationName: "rmReviews_rmEmployeeId_employees_id"
	}),
}));

export const growthInitiativesRelations = relations(growthInitiatives, ({one}) => ({
	employee: one(employees, {
		fields: [growthInitiatives.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const nationalReportSchedulesRelations = relations(nationalReportSchedules, ({one}) => ({
	employee: one(employees, {
		fields: [nationalReportSchedules.nmEmployeeId],
		references: [employees.id]
	}),
}));

export const companyTargetsRelations = relations(companyTargets, ({one}) => ({
	employee: one(employees, {
		fields: [companyTargets.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const companyForecastsRelations = relations(companyForecasts, ({one}) => ({
	employee: one(employees, {
		fields: [companyForecasts.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const crossVerticalConflictsRelations = relations(crossVerticalConflicts, ({one}) => ({
	lead: one(leads, {
		fields: [crossVerticalConflicts.awardedLeadId],
		references: [leads.id]
	}),
	employee: one(employees, {
		fields: [crossVerticalConflicts.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const periodReopenRequestsRelations = relations(periodReopenRequests, ({one}) => ({
	employee_authorizedByEmployeeId: one(employees, {
		fields: [periodReopenRequests.authorizedByEmployeeId],
		references: [employees.id],
		relationName: "periodReopenRequests_authorizedByEmployeeId_employees_id"
	}),
	reportingPeriod: one(reportingPeriods, {
		fields: [periodReopenRequests.periodId],
		references: [reportingPeriods.id]
	}),
	employee_requestedByEmployeeId: one(employees, {
		fields: [periodReopenRequests.requestedByEmployeeId],
		references: [employees.id],
		relationName: "periodReopenRequests_requestedByEmployeeId_employees_id"
	}),
}));

export const reportingPeriodsRelations = relations(reportingPeriods, ({one, many}) => ({
	periodReopenRequests: many(periodReopenRequests),
	employee: one(employees, {
		fields: [reportingPeriods.certifiedByEmployeeId],
		references: [employees.id]
	}),
	financeLedgerEntries: many(financeLedgerEntries),
	receivableInvoices: many(receivableInvoices),
	financeReconciliations: many(financeReconciliations),
	incentiveCalculations: many(incentiveCalculations),
}));

export const criticalOperatingRisksRelations = relations(criticalOperatingRisks, ({one}) => ({
	employee: one(employees, {
		fields: [criticalOperatingRisks.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const nmLeadershipReviewsRelations = relations(nmLeadershipReviews, ({one}) => ({
	employee_ceoEmployeeId: one(employees, {
		fields: [nmLeadershipReviews.ceoEmployeeId],
		references: [employees.id],
		relationName: "nmLeadershipReviews_ceoEmployeeId_employees_id"
	}),
	employee_nmEmployeeId: one(employees, {
		fields: [nmLeadershipReviews.nmEmployeeId],
		references: [employees.id],
		relationName: "nmLeadershipReviews_nmEmployeeId_employees_id"
	}),
}));

export const boardReportSchedulesRelations = relations(boardReportSchedules, ({one}) => ({
	employee: one(employees, {
		fields: [boardReportSchedules.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const executiveCommitmentsRelations = relations(executiveCommitments, ({one}) => ({
	employee: one(employees, {
		fields: [executiveCommitments.ceoEmployeeId],
		references: [employees.id]
	}),
}));

export const financeLedgerEntriesRelations = relations(financeLedgerEntries, ({one, many}) => ({
	employee_approvedByEmployeeId: one(employees, {
		fields: [financeLedgerEntries.approvedByEmployeeId],
		references: [employees.id],
		relationName: "financeLedgerEntries_approvedByEmployeeId_employees_id"
	}),
	reportingPeriod: one(reportingPeriods, {
		fields: [financeLedgerEntries.periodId],
		references: [reportingPeriods.id]
	}),
	employee_preparedByEmployeeId: one(employees, {
		fields: [financeLedgerEntries.preparedByEmployeeId],
		references: [employees.id],
		relationName: "financeLedgerEntries_preparedByEmployeeId_employees_id"
	}),
	financeLedgerEntry: one(financeLedgerEntries, {
		fields: [financeLedgerEntries.reversalLinkedEntryId],
		references: [financeLedgerEntries.id],
		relationName: "financeLedgerEntries_reversalLinkedEntryId_financeLedgerEntries_id"
	}),
	financeLedgerEntries: many(financeLedgerEntries, {
		relationName: "financeLedgerEntries_reversalLinkedEntryId_financeLedgerEntries_id"
	}),
}));

export const salesFinanceHandoffsRelations = relations(salesFinanceHandoffs, ({one}) => ({
	lead: one(leads, {
		fields: [salesFinanceHandoffs.leadId],
		references: [leads.id]
	}),
	employee_salesRepEmployeeId: one(employees, {
		fields: [salesFinanceHandoffs.salesRepEmployeeId],
		references: [employees.id],
		relationName: "salesFinanceHandoffs_salesRepEmployeeId_employees_id"
	}),
	employee_verifiedByEmployeeId: one(employees, {
		fields: [salesFinanceHandoffs.verifiedByEmployeeId],
		references: [employees.id],
		relationName: "salesFinanceHandoffs_verifiedByEmployeeId_employees_id"
	}),
}));

export const receivableInvoicesRelations = relations(receivableInvoices, ({one, many}) => ({
	employee: one(employees, {
		fields: [receivableInvoices.assignedCollectionAgentId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [receivableInvoices.leadId],
		references: [leads.id]
	}),
	reportingPeriod: one(reportingPeriods, {
		fields: [receivableInvoices.periodId],
		references: [reportingPeriods.id]
	}),
	receiptInvoiceMatches: many(receiptInvoiceMatches),
}));

export const bankSettledReceiptsRelations = relations(bankSettledReceipts, ({one, many}) => ({
	team: one(teams, {
		fields: [bankSettledReceipts.clarificationTeamId],
		references: [teams.id]
	}),
	receiptInvoiceMatches: many(receiptInvoiceMatches),
	refundRequests: many(refundRequests),
}));

export const receiptInvoiceMatchesRelations = relations(receiptInvoiceMatches, ({one}) => ({
	employee: one(employees, {
		fields: [receiptInvoiceMatches.allocatedByEmployeeId],
		references: [employees.id]
	}),
	receivableInvoice: one(receivableInvoices, {
		fields: [receiptInvoiceMatches.invoiceId],
		references: [receivableInvoices.id]
	}),
	bankSettledReceipt: one(bankSettledReceipts, {
		fields: [receiptInvoiceMatches.receiptId],
		references: [bankSettledReceipts.id]
	}),
}));

export const financeReconciliationsRelations = relations(financeReconciliations, ({one}) => ({
	employee: one(employees, {
		fields: [financeReconciliations.frozenByEmployeeId],
		references: [employees.id]
	}),
	reportingPeriod: one(reportingPeriods, {
		fields: [financeReconciliations.periodId],
		references: [reportingPeriods.id]
	}),
}));

export const refundRequestsRelations = relations(refundRequests, ({one}) => ({
	employee: one(employees, {
		fields: [refundRequests.authorizedByEmployeeId],
		references: [employees.id]
	}),
	lead: one(leads, {
		fields: [refundRequests.leadId],
		references: [leads.id]
	}),
	bankSettledReceipt: one(bankSettledReceipts, {
		fields: [refundRequests.originalReceiptId],
		references: [bankSettledReceipts.id]
	}),
}));

export const incentiveCalculationsRelations = relations(incentiveCalculations, ({one, many}) => ({
	employee: one(employees, {
		fields: [incentiveCalculations.approvedByEmployeeId],
		references: [employees.id]
	}),
	reportingPeriod: one(reportingPeriods, {
		fields: [incentiveCalculations.periodId],
		references: [reportingPeriods.id]
	}),
	incentiveDisputes: many(incentiveDisputes),
}));

export const incentiveDisputesRelations = relations(incentiveDisputes, ({one}) => ({
	incentiveCalculation: one(incentiveCalculations, {
		fields: [incentiveDisputes.calculationId],
		references: [incentiveCalculations.id]
	}),
	employee_employeeId: one(employees, {
		fields: [incentiveDisputes.employeeId],
		references: [employees.id],
		relationName: "incentiveDisputes_employeeId_employees_id"
	}),
	employee_resolvedByEmployeeId: one(employees, {
		fields: [incentiveDisputes.resolvedByEmployeeId],
		references: [employees.id],
		relationName: "incentiveDisputes_resolvedByEmployeeId_employees_id"
	}),
}));

export const forecastFinanceReviewsRelations = relations(forecastFinanceReviews, ({one}) => ({
	employee: one(employees, {
		fields: [forecastFinanceReviews.concurredByEmployeeId],
		references: [employees.id]
	}),
}));

export const financePoliciesRelations = relations(financePolicies, ({one}) => ({
	employee_approvedByEmployeeId: one(employees, {
		fields: [financePolicies.approvedByEmployeeId],
		references: [employees.id],
		relationName: "financePolicies_approvedByEmployeeId_employees_id"
	}),
	employee_proposedByEmployeeId: one(employees, {
		fields: [financePolicies.proposedByEmployeeId],
		references: [employees.id],
		relationName: "financePolicies_proposedByEmployeeId_employees_id"
	}),
}));