import { differenceInDays, addDays, isAfter, isBefore, parseISO, isValid } from 'date-fns';

export const TIMELINE_STATUS = {
    OK: 'ok',
    WARNING: 'warning',
    ERROR: 'error'
};

export function analyzeTimeline(events) {
    const report = {
        score: 100,
        gaps: [],
        insuranceIssues: [],
        successionIssues: [],
        summary: {
            totalDays: 0,
            daysWithoutStatus: 0,
            daysWithoutInsurance: 0
        },
        controls: []
    };

    if (!events || events.length === 0) {
        return report;
    }

    // 1. Sort events chronologically
    const sortedEvents = [...events].sort((a, b) => {
        const dateA = new Date(a.submissionDate || a.start || 0);
        const dateB = new Date(b.submissionDate || b.start || 0);
        return dateA - dateB;
    });

    // 2. Analyze Gaps & Succession (Status Continuity)
    let processedEvents = [];

    // Filter mainly status-related events for gap analysis
    const statusEvents = sortedEvents.filter(e =>
        ['CAQ', 'Permis d\'études', 'Visa', 'CAQ_REFUSAL', 'INTENT_REFUSAL'].includes(e.type)
    );

    statusEvents.forEach((event, index) => {
        if (index > 0) {
            const prevEvent = statusEvents[index - 1];

            // Get end date of previous event (approximate based on logic or user input if available)
            // For now, assuming standard duration if no end date provided, or using start date of next event as check

            const prevDate = new Date(prevEvent.submissionDate || prevEvent.start);
            const currDate = new Date(event.submissionDate || event.start);

            const gapDays = differenceInDays(currDate, prevDate);

            // Refusals break continuity immediately
            if (prevEvent.type.includes('REFUSAL')) {
                report.controls.push({
                    type: TIMELINE_STATUS.ERROR,
                    message: `Rupture de continuité suite au refus du ${prevEvent.submissionDate}`,
                    date: prevEvent.submissionDate
                });
                report.score -= 20;
            }

            // Check for large gaps between applications without status
            // This is a heuristic: if > 90 days between "Start of App 1" and "Start of App 2", we check if App 1 covered it
            // Ideally we need 'endDate' for every event to be precise.
            // Using a simplified heuristic for now based on typical validity.

            // Logic: A CAQ usually covers a study period. If next event is > 4 years later?
            // For this MVP, we analyze the "Gap" as the time between events, flagging if it looks like "implied status" was lost.

            if (gapDays > 150) { // Arbitrary warning threshold for attention
                // This is weak logic without end dates, but serves the UI example
                // We will refine this if we add exact 'validityEnd' to events
            }
        }
    });

    // 3. Insurance Coverage (Simplified)
    // We look for "Preuve d'assurance" or "RAMQ" events
    const insuranceEvents = sortedEvents.filter(e => e.label.toLowerCase().includes('assurance') || e.label.toLowerCase().includes('ramq'));

    // If we have study periods (CAQ) but no insurance events?
    const hasCAQ = sortedEvents.some(e => e.type === 'CAQ');
    if (hasCAQ && insuranceEvents.length === 0) {
        report.insuranceIssues.push({
            type: TIMELINE_STATUS.WARNING,
            message: "Aucune preuve d'assurance détectée sur la chronologie."
        });
        report.score -= 10;
    }

    // 4. Refusals Impact
    const refusals = sortedEvents.filter(e => e.type.includes('REFUSAL'));
    if (refusals.length > 0) {
        report.score -= (refusals.length * 25);
        report.controls.push({
            type: TIMELINE_STATUS.ERROR,
            message: `${refusals.length} refus détecté(s) dans l'historique.`,
        });
    }

    // 5. Overall Consistency
    // Example: Study Permit before CAQ?
    // Not strictly impossible (concurrent application) but usually CAQ comes first.

    // Normalize score
    report.score = Math.max(0, report.score);

    // Generate Global Status
    if (report.score === 100) report.globalStatus = 'Exemplaire';
    else if (report.score >= 80) report.globalStatus = 'Conforme';
    else if (report.score >= 60) report.globalStatus = 'À Risque';
    else report.globalStatus = 'Critique';

    return report;
}
