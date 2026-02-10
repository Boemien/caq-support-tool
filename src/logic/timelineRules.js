import { differenceInDays, addDays, isAfter, isBefore, parseISO, isValid, format } from 'date-fns';

const formatDate = (date) => isValid(date) ? format(date, 'dd/MM/yyyy') : '??';

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
        return { ...report, globalStatus: 'NEUTRAL', score: 100, isEmpty: true };
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

    // Only require insurance if there is an indication of presence in Canada
    // (Entry, Studies started, or Work Permit activated)
    const hasPresence = sortedEvents.some(e => ['ENTRY', 'STUDIES', 'WORK_PERMIT'].includes(e.type));

    if (hasPresence && insuranceEvents.length === 0) {
        report.insuranceIssues.push({
            type: TIMELINE_STATUS.WARNING,
            message: "Aucune preuve d'assurance détectée malgré une présence au Canada."
        });
        report.score -= 10;
    }

    // 4. Refusals Impact
    // 4. Refusals & Intents Impact
    const refusals = sortedEvents.filter(e => e.type === 'CAQ_REFUSAL');
    const intents = sortedEvents.filter(e => e.type === 'INTENT_REFUSAL');

    // A. Analyze Refusals
    if (refusals.length > 0) {
        refusals.forEach(refusal => {
            const rDate = new Date(refusal.submissionDate || refusal.start);
            // Check if a NEW CAQ application exists AFTER this refusal
            const hasNewApp = sortedEvents.some(e =>
                e.type === 'CAQ' && // Assuming CAQ type can determine "Request" via visual logic, or we check if it starts after
                new Date(e.submissionDate || e.start) > rDate
            );

            if (!hasNewApp) {
                report.score -= 25;
                report.controls.push({
                    type: TIMELINE_STATUS.ERROR,
                    message: `Refus du ${formatDate(rDate)} sans nouvelle demande détectée par la suite.`,
                    date: refusal.submissionDate
                });
            } else {
                // If re-applied, we reduce the penalty or add an info note?
                // For now, let's say it's "Handled" so no major error, but still a history note
                report.controls.push({
                    type: TIMELINE_STATUS.WARNING,
                    message: `Refus du ${formatDate(rDate)} suivi d'une nouvelle demande (Correct).`,
                    date: refusal.submissionDate
                });
                report.score -= 5; // Small penalty for history
            }
        });
    }

    // B. Analyze Intents
    if (intents.length > 0) {
        intents.forEach(intent => {
            const iDate = new Date(intent.submissionDate || intent.start);
            // Check if DOCS_SENT exists AFTER intent (Response)
            const hasResponse = sortedEvents.some(e =>
                e.type === 'DOCS_SENT' &&
                new Date(e.submissionDate || e.start) > iDate
            );

            if (!hasResponse) {
                report.score -= 15;
                report.controls.push({
                    type: TIMELINE_STATUS.ERROR,
                    message: `Intention de refus du ${formatDate(iDate)} sans envoi de documents justificatifs détecté.`,
                    date: intent.submissionDate
                });
            } else {
                report.controls.push({
                    type: TIMELINE_STATUS.OK,
                    message: `Intention de refus du ${formatDate(iDate)} répondue par un envoi de documents.`,
                    date: intent.submissionDate
                });
            }
        });
    }

    // 5. Study Coverage & Program Consistency
    const studyEvents = sortedEvents.filter(e => e.type === 'STUDIES' && e.start && e.end);
    const caqEvents = sortedEvents.filter(e => e.type === 'CAQ' && e.start && e.end);

    if (studyEvents.length > 0) {
        studyEvents.forEach(study => {
            const studyStart = new Date(study.start);
            const studyEnd = new Date(study.end);

            // Find CAQ covering this period
            const coverCAQ = caqEvents.find(caq => {
                const caqStart = new Date(caq.start);
                const caqEnd = new Date(caq.end);
                return (studyStart >= caqStart && studyEnd <= caqEnd) ||
                    (studyStart <= caqEnd && studyEnd >= caqStart);
            });

            if (!coverCAQ && caqEvents.length > 0) {
                report.controls.push({
                    type: TIMELINE_STATUS.WARNING,
                    message: `Période d'études du ${study.start} non couverte par un CAQ valide.`
                });
                report.score -= 5;
            } else if (coverCAQ && study.linkedProgram && coverCAQ.linkedProgram) {
                // Program Consistency Check
                // Simple string inclusion or equality check (normalized)
                const sProg = study.linkedProgram.toLowerCase().trim();
                const cProg = coverCAQ.linkedProgram.toLowerCase().trim();

                if (!sProg.includes(cProg) && !cProg.includes(sProg)) {
                    report.controls.push({
                        type: TIMELINE_STATUS.WARNING,
                        message: `Incohérence de programme : Études en "${study.linkedProgram}" sous un CAQ pour "${coverCAQ.linkedProgram}".`
                    });
                    report.score -= 10;
                }
            }
        });
    }

    // 6. Precise Insurance Gap Detection (During CAQ Validity)
    // Only check if we have presence indicators
    // Redefine hasPresence as it was used before and might be outdated here
    const hasPresenceForInsurance = sortedEvents.some(e => ['ENTRY', 'STUDIES', 'WORK_PERMIT'].includes(e.type));

    if (hasPresenceForInsurance && caqEvents.length > 0) {
        // We want to find days covered by a CAQ but NOT covered by Insurance
        // This is a simplified "Gap Search"

        caqEvents.forEach(caq => {
            const cStart = new Date(caq.start);
            const cEnd = new Date(caq.end);

            // Find insurance events overlapping this CAQ
            const overlappingIns = insuranceEvents.filter(ins => {
                const iStart = new Date(ins.start);
                const iEnd = new Date(ins.end);
                return (iStart <= cEnd && iEnd >= cStart);
            });

            if (overlappingIns.length === 0) {
                report.insuranceIssues.push({
                    type: TIMELINE_STATUS.WARNING,
                    message: `Période CAQ du ${caq.start} au ${caq.end} entièrement sans preuve d'assurance.`
                });
                report.score -= 15;
            } else {
                // Determine if there are specific gaps
                // Sort insurance by start date
                const sortedIns = [...overlappingIns].sort((a, b) => new Date(a.start) - new Date(b.start));

                let coveredUntil = cStart;

                sortedIns.forEach(ins => {
                    const iStart = new Date(ins.start);
                    const iEnd = new Date(ins.end);

                    // If there's a gap between the end of the last covered period and the start of the current insurance
                    if (iStart > addDays(coveredUntil, 1)) {
                        // Gap detected
                        report.insuranceIssues.push({
                            type: TIMELINE_STATUS.WARNING,
                            message: `Trou d'assurance du ${formatDate(coveredUntil)} au ${formatDate(addDays(iStart, -1))} pendant le CAQ.`
                        });
                        report.score -= 5;
                    }
                    // Update coveredUntil to the latest end date of insurance
                    if (iEnd > coveredUntil) coveredUntil = iEnd;
                });

                // Check for a gap at the end of the CAQ period
                if (coveredUntil < cEnd) {
                    report.insuranceIssues.push({
                        type: TIMELINE_STATUS.WARNING,
                        message: `Fin de CAQ non couverte par assurance à partir du ${formatDate(addDays(coveredUntil, 1))}.`
                    });
                    report.score -= 5;
                }
            }
        });
    }

    // 7. Permit Continuity for Studies
    // Check if Studies are covered by a Permit (WORK_PERMIT type covers both)
    const permitEvents = sortedEvents.filter(e => e.type === 'WORK_PERMIT' && e.start && e.end);

    if (studyEvents.length > 0) {
        studyEvents.forEach(study => {
            const sStart = new Date(study.start);
            const sEnd = new Date(study.end);

            // Allow a small grace period or check for implied status? 
            // For now, strict check: MUST have a permit overlapping

            const hasPermit = permitEvents.some(p => {
                const pStart = new Date(p.start);
                const pEnd = new Date(p.end);
                return (sStart >= pStart && sEnd <= pEnd) || (sStart <= pEnd && sEnd >= pStart);
            });

            if (!hasPermit && permitEvents.length > 0) {
                report.controls.push({
                    type: TIMELINE_STATUS.ERROR,
                    message: `Attention: Période d'études du ${formatDate(sStart)} sans permis valide associé.`
                });
                report.score -= 15;
            }
        });
    }

    // 8. Physical Presence Analysis
    // We scan ENTRY and EXIT events to determine presence

    // Sort only movement events
    const movementEvents = sortedEvents.filter(e => ['ENTRY', 'EXIT'].includes(e.type));
    let inCanada = false;
    let lastMovementDate = null;
    let absencePeriods = [];

    // If the first movement is an EXIT, assume implied presence before? 
    // Or if first is ENTRY, assume absence before?
    // Let's assume absence before first Entry.

    movementEvents.forEach(move => {
        const moveDate = new Date(move.submissionDate || move.start);
        if (!isValid(moveDate)) return;

        if (move.type === 'ENTRY') {
            if (inCanada && lastMovementDate) {
                // Entry following Entry? Maybe a short trip not recorded? 
                // Or user error. We reset date.
            } else if (!inCanada && lastMovementDate) {
                // Was absent since last EXIT
                absencePeriods.push({ start: lastMovementDate, end: moveDate });
            }
            inCanada = true;
            lastMovementDate = moveDate;
        } else if (move.type === 'EXIT') {
            if (!inCanada) {
                // Exit following Exit? or Exit without Entry?
            }
            inCanada = false;
            lastMovementDate = moveDate;
        }
    });

    // Check for Open Absence (Exit without Return until Now)
    if (!inCanada && lastMovementDate) {
        // Warning: Currently absent?
        // We might want to flag if they have active studies/CAQ during this open absence
        const today = new Date();
        absencePeriods.push({ start: lastMovementDate, end: today, isOpen: true });
    }

    // Validate Studies during Absence
    if (studyEvents.length > 0 && absencePeriods.length > 0) {
        studyEvents.forEach(study => {
            const sStart = new Date(study.start);
            const sEnd = new Date(study.end);
            if (!isValid(sStart) || !isValid(sEnd)) return;

            absencePeriods.forEach(abs => {
                // Check overlap
                if ((sStart >= abs.start && sStart <= abs.end) ||
                    (sEnd >= abs.start && sEnd <= abs.end) ||
                    (sStart <= abs.start && sEnd >= abs.end)) {

                    report.controls.push({
                        type: TIMELINE_STATUS.ERROR,
                        message: `Incohérence : Période d'études du ${formatDate(sStart)} déclarée pendant une absence du territoire (Départ du ${formatDate(abs.start)}).`
                    });
                    report.score -= 20;
                }
            });
        });
    }

    // Check if CAQ exists but has huge gaps without studies (e.g. > 150 days)
    if (caqEvents.length > 0 && studyEvents.length > 0) {
        // Sort studies
        const sortedStudies = [...studyEvents].sort((a, b) => new Date(a.start) - new Date(b.start));

        for (let i = 0; i < sortedStudies.length - 1; i++) {
            const currentStudyEnd = new Date(sortedStudies[i].end);
            const nextStudyStart = new Date(sortedStudies[i + 1].start);

            const gapInDays = differenceInDays(nextStudyStart, currentStudyEnd);

            if (gapInDays > 150) {
                // Check if this gap falls within a CAQ
                // We check if the midpoint of the gap is covered by a CAQ
                const gapMidPoint = addDays(currentStudyEnd, Math.floor(gapInDays / 2));

                const isUnderCAQ = caqEvents.some(caq => {
                    return isAfter(gapMidPoint, new Date(caq.start)) && isBefore(gapMidPoint, new Date(caq.end));
                });

                if (isUnderCAQ) {
                    // Check if this gap is covered by a MEDICAL event
                    // We treat it impartially: It justifies the 'reason' but requires strict verification.

                    const gapStart = addDays(currentStudyEnd, 1);
                    const gapEnd = addDays(nextStudyStart, -1);

                    const medicalJustification = sortedEvents.find(e =>
                        e.type === 'MEDICAL' &&
                        new Date(e.start) <= gapEnd &&
                        (new Date(e.end) >= gapStart || !e.end)
                    );

                    if (medicalJustification) {
                        report.controls.push({
                            type: TIMELINE_STATUS.WARNING,
                            message: `Interruption d'études (${gapInDays} jours) justifiée par motif médical. PREUVES IMPÉRATIVES requises.`
                        });
                        report.score -= 5; // Reduced penalty but still a warning because it needs verification
                    } else {
                        report.controls.push({
                            type: TIMELINE_STATUS.WARNING,
                            message: `Interruption prolongée (${gapInDays} jours) détectée entre deux périodes d'études sous CAQ.`
                        });
                        report.score -= 15; // Full penalty for unexplained gaps
                    }
                }
            }
        }
    } else if (caqEvents.length > 0 && studyEvents.length === 0) {
        report.controls.push({
            type: TIMELINE_STATUS.WARNING,
            message: "CAQ déclaré mais aucune période d'études confirmée."
        });
        report.score -= 5;
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
