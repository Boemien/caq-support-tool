import { differenceInDays, addDays, isAfter, isBefore, parseISO, isValid, format, differenceInMonths } from 'date-fns';

const formatDate = (date) => isValid(date) ? format(date, 'dd/MM/yyyy') : '??';

const safeParseDate = (dateStr) => {
    if (dateStr === 0) return new Date(0);
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'number') return new Date(dateStr);
    // Handle YYYY-MM-DD strings safely
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts.map(Number);
            // new Date(y, m-1, d) creates a local date
            return new Date(y, m - 1, d);
        }
    }
    return new Date(dateStr);
};

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
        const dateA = safeParseDate(a.submissionDate || a.start || 0);
        const dateB = safeParseDate(b.submissionDate || b.start || 0);
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

            const prevDate = safeParseDate(prevEvent.submissionDate || prevEvent.start);
            const currDate = safeParseDate(event.submissionDate || event.start);

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

    // 3. Insurance Coverage (Refined)
    // Find all CAQ periods (validity)
    const caqPeriods = sortedEvents.filter(e => e.type === 'CAQ' && e.start && e.end);

    // Find entry date (first entry event)
    const entryEvent = sortedEvents.find(e => e.type === 'ENTRY');
    const entryDate = entryEvent ? safeParseDate(entryEvent.start || entryEvent.submissionDate) : null;

    // Find all insurance coverage periods
    const insurancePeriods = sortedEvents
        .filter(e => e.type === 'INSURANCE' || (e.label && (e.label.toLowerCase().includes('assurance') || e.label.toLowerCase().includes('ramq'))))
        .map(e => ({
            start: safeParseDate(e.start || e.submissionDate),
            end: e.end ? safeParseDate(e.end) : addDays(safeParseDate(e.start || e.submissionDate), 365) // Default 1 year if no end
        }));

    // Define studyEvents and caqEvents for use in insurance and consistency checks
    const studyEvents = sortedEvents.filter(e => e.type === 'STUDIES' && e.start && e.end);
    const caqEvents = sortedEvents.filter(e => e.type === 'CAQ' && e.start && e.end);


    // 3. Insurance Coverage (LINKED TO ACTUAL STUDIES)
    // CRITICAL CHANGE: Only check insurance for CAQs where studies actually occurred
    // This prevents false warnings for CAQs that were obtained but never used for studies

    // Only require insurance if there is an indication of presence in Canada
    const hasPresence = sortedEvents.some(e => ['ENTRY', 'STUDIES', 'WORK_PERMIT'].includes(e.type));

    if (studyEvents.length > 0 && hasPresence) {
        // For each study period, find the covering CAQ and check insurance for that period
        studyEvents.forEach(study => {
            const sStart = new Date(study.start);
            const sEnd = new Date(study.end);
            if (!isValid(sStart) || !isValid(sEnd)) return;

            // Find the CAQ that covers this study (matching level and overlapping dates)
            const coveringCAQ = caqEvents.find(caq => {
                const cStart = safeParseDate(caq.start);
                const cEnd = safeParseDate(caq.end);
                return caq.level === study.level && (cStart <= sEnd && cEnd >= sStart);
            });

            if (!coveringCAQ) {
                // No matching CAQ found - this is already reported in program consistency check
                return;
            }

            const caqStart = safeParseDate(coveringCAQ.start);
            const caqEnd = safeParseDate(coveringCAQ.end);

            // Determine effective required start date for insurance
            let requiredStart = caqStart;
            if (entryDate && isAfter(entryDate, caqStart)) {
                requiredStart = entryDate;
            }

            // IMPORTANT: Skip if CAQ expired before entry to Canada
            if (entryDate && isBefore(caqEnd, entryDate)) {
                return; // Skip this CAQ entirely
            }

            // If requiredStart > caqEnd, no insurance needed
            if (isAfter(requiredStart, caqEnd)) return;

            // Find insurance periods that overlap with [requiredStart, caqEnd]
            const relevantInsurance = insurancePeriods
                .filter(ins => (isBefore(ins.start, caqEnd) && isAfter(ins.end, requiredStart)))
                .sort((a, b) => a.start - b.start);

            const caqInfo = coveringCAQ.level ? `${coveringCAQ.level}${coveringCAQ.linkedProgram ? ' (' + coveringCAQ.linkedProgram + ')' : ''}` : 'Non spécifié';

            if (relevantInsurance.length === 0) {
                report.insuranceIssues.push({
                    type: TIMELINE_STATUS.WARNING,
                    message: `CAQ obtenu pour le niveau ${caqInfo} du ${formatDate(caqStart)} au ${formatDate(caqEnd)} entièrement sans preuve d'assurance.`,
                    date: caqStart
                });
                report.score -= 15;
            } else {
                // Check for gaps
                let currentCheck = requiredStart;

                // Merge overlapping insurance periods first to simplify gap detection
                const mergedInsurance = [];
                if (relevantInsurance.length > 0) {
                    let currentPeriod = relevantInsurance[0];
                    for (let i = 1; i < relevantInsurance.length; i++) {
                        const nextPeriod = relevantInsurance[i];
                        if (isBefore(nextPeriod.start, currentPeriod.end) || differenceInDays(nextPeriod.start, currentPeriod.end) <= 1) {
                            // Overlap or adjacent -> merge
                            if (isAfter(nextPeriod.end, currentPeriod.end)) {
                                currentPeriod.end = nextPeriod.end;
                            }
                        } else {
                            mergedInsurance.push(currentPeriod);
                            currentPeriod = nextPeriod;
                        }
                    }
                    mergedInsurance.push(currentPeriod);
                }

                // Now check gaps against merged periods
                mergedInsurance.forEach(period => {
                    // If insurance starts after current check point -> gap detected
                    if (isAfter(period.start, currentCheck) && differenceInDays(period.start, currentCheck) > 15) {
                        report.insuranceIssues.push({
                            type: TIMELINE_STATUS.WARNING,
                            message: `CAQ obtenu pour le niveau ${caqInfo} du ${formatDate(caqStart)} : Rupture d'assurance entre ${formatDate(currentCheck)} et ${formatDate(period.start)}.`,
                            date: currentCheck
                        });
                        report.score -= 5;
                    }
                    // Move check point to end of current insurance period if it's later
                    if (isAfter(period.end, currentCheck)) {
                        currentCheck = period.end;
                    }
                });

                // Check final gap after last insurance
                if (isBefore(currentCheck, caqEnd) && differenceInDays(caqEnd, currentCheck) > 15) {
                    report.insuranceIssues.push({
                        type: TIMELINE_STATUS.WARNING,
                        message: `CAQ obtenu pour le niveau ${caqInfo} du ${formatDate(caqStart)} : Rupture d'assurance à la fin, entre ${formatDate(currentCheck)} et ${formatDate(caqEnd)}.`,
                        date: currentCheck
                    });
                    report.score -= 5;
                }
            }
        });
    } else if (hasPresence && insurancePeriods.length === 0) {
        // Fallback if no CAQ but presence exists
        report.insuranceIssues.push({
            type: TIMELINE_STATUS.WARNING,
            message: "Aucune preuve d'assurance détectée malgré une présence au Canada (sans CAQ lié)."
        });
        report.score -= 10;
    }

    // 4. Post-Arrival Delay Check (Entry -> Studies)
    if (entryDate && studyEvents.length > 0) {
        // Find the first study period AFTER arrival
        const studiesAfterEntry = studyEvents
            .map(s => ({ ...s, startDate: safeParseDate(s.start) }))
            .filter(s => isAfter(s.startDate, entryDate))
            .sort((a, b) => a.startDate - b.startDate);

        if (studiesAfterEntry.length > 0) {
            const firstStudyAfterEntry = studiesAfterEntry[0];
            const monthsDelay = differenceInMonths(firstStudyAfterEntry.startDate, entryDate);

            if (monthsDelay >= 1) {
                const isSerious = monthsDelay >= 3;
                report.controls.push({
                    type: isSerious ? TIMELINE_STATUS.ERROR : TIMELINE_STATUS.WARNING,
                    message: `Délai d'entrée : L'étudiant a commencé ses études ${monthsDelay} mois après son arrivée au pays (Arrivée: ${formatDate(entryDate)}, Études: ${formatDate(firstStudyAfterEntry.startDate)}). (Note: > 1 mois est suspect, > 3 mois est critique)`,
                    date: firstStudyAfterEntry.startDate
                });
                if (isSerious) report.score -= 15;
                else report.score -= 5;
            }
        }
    }

    // 4. Refusals Impact
    // 4. Refusals & Intents Impact
    const refusals = sortedEvents.filter(e => e.type === 'CAQ_REFUSAL');
    const intents = sortedEvents.filter(e => e.type === 'INTENT_REFUSAL');

    // A. Analyze Refusals
    if (refusals.length > 0) {
        refusals.forEach(refusal => {
            const rDate = safeParseDate(refusal.submissionDate || refusal.start);

            // Check if a NEW CAQ was APPROVED (has start/end dates) AFTER this refusal
            const hasApprovedCAQ = sortedEvents.some(e =>
                e.type === 'CAQ' &&
                e.start && e.end && // Must have validity dates (approved)
                safeParseDate(e.start) > rDate
            );

            // Check if a NEW CAQ REQUEST (submission only) exists AFTER this refusal
            const hasPendingRequest = sortedEvents.some(e =>
                e.type === 'CAQ' &&
                e.submissionDate &&
                !e.start && !e.end && // No validity dates (pending)
                safeParseDate(e.submissionDate) > rDate
            );

            if (!hasApprovedCAQ && !hasPendingRequest) {
                report.score -= 25;
                report.controls.push({
                    type: TIMELINE_STATUS.ERROR,
                    message: `Refus du ${formatDate(rDate)} sans nouvelle demande détectée par la suite.`,
                    date: refusal.submissionDate
                });
            } else if (hasApprovedCAQ) {
                // Best case: CAQ was approved after refusal
                report.controls.push({
                    type: TIMELINE_STATUS.OK,
                    message: `Refus du ${formatDate(rDate)} suivi d'un CAQ approuvé (Excellent).`,
                    date: refusal.submissionDate
                });
                report.score -= 2; // Minimal penalty for history
            } else if (hasPendingRequest) {
                // Pending request exists but not yet approved
                report.controls.push({
                    type: TIMELINE_STATUS.WARNING,
                    message: `Refus du ${formatDate(rDate)} suivi d'une nouvelle demande en attente.`,
                    date: refusal.submissionDate
                });
                report.score -= 5; // Small penalty for pending
            }
        });
    }

    // B. Analyze Intents
    if (intents.length > 0) {
        intents.forEach(intent => {
            const iDate = safeParseDate(intent.submissionDate || intent.start);
            // Check if DOCS_SENT exists AFTER intent (Response)
            const hasResponse = sortedEvents.some(e =>
                e.type === 'DOCS_SENT' &&
                safeParseDate(e.submissionDate || e.start) > iDate
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

    // C. Analyze Cancellations & Fraud (CRITICAL)
    const intentCancels = sortedEvents.filter(e => e.type === 'INTENT_CANCEL');
    const caqCancels = sortedEvents.filter(e => e.type === 'CAQ_CANCEL');
    const fraudRejections = sortedEvents.filter(e => e.type === 'FRAUD_REJECTION');

    // Intent to Cancel Analysis
    if (intentCancels.length > 0) {
        intentCancels.forEach(intent => {
            const iDate = safeParseDate(intent.submissionDate || intent.start);
            // Check if DOCS_SENT exists AFTER intent (Response within 60 days)
            const hasResponse = sortedEvents.some(e =>
                e.type === 'DOCS_SENT' &&
                safeParseDate(e.submissionDate || e.start) > iDate
            );

            if (!hasResponse) {
                report.score -= 30;
                report.controls.push({
                    type: TIMELINE_STATUS.ERROR,
                    message: `🚨 Intention d'annulation du ${formatDate(iDate)} sans réponse documentée (60 jours requis).`,
                    date: intent.submissionDate
                });
            } else {
                report.controls.push({
                    type: TIMELINE_STATUS.WARNING,
                    message: `Intention d'annulation du ${formatDate(iDate)} répondue par un envoi de documents.`,
                    date: intent.submissionDate
                });
                report.score -= 10; // Still a serious concern
            }
        });
    }

    // CAQ Cancellation (CRITICAL)
    if (caqCancels.length > 0) {
        report.score -= (caqCancels.length * 50); // Severe penalty
        caqCancels.forEach(cancel => {
            const cDate = safeParseDate(cancel.submissionDate || cancel.start);
            report.controls.push({
                type: TIMELINE_STATUS.ERROR,
                message: `🚫 ANNULATION DU CAQ le ${formatDate(cDate)} - Dossier gravement compromis (Art. 59 LIQ).`,
                date: cancel.submissionDate
            });
        });
    }

    // Fraud Rejection (CRITICAL)
    if (fraudRejections.length > 0) {
        report.score -= (fraudRejections.length * 60); // Most severe penalty
        fraudRejections.forEach(fraud => {
            const fDate = safeParseDate(fraud.submissionDate || fraud.start);
            report.controls.push({
                type: TIMELINE_STATUS.ERROR,
                message: `⚖️ REJET POUR FAUX ET TROMPEUR le ${formatDate(fDate)} - Interdiction de 5 ans (Art. 56-57 LIQ).`,
                date: fraud.submissionDate
            });
        });
    }

    // 5. Study Coverage & Program Consistency
    if (studyEvents.length > 0) {

        studyEvents.forEach(study => {
            const studyStart = safeParseDate(study.start);
            const studyEnd = safeParseDate(study.end);

            // Find CAQ covering this period
            const coverCAQ = caqEvents.find(caq => {
                const caqStart = safeParseDate(caq.start);
                const caqEnd = safeParseDate(caq.end);
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





    // 6. Studies & CAQ Consistency (Strict Level + Period Check)
    if (studyEvents.length > 0) {
        studyEvents.forEach(study => {
            const sStart = new Date(study.start);
            const sEnd = new Date(study.end);
            if (!isValid(sStart) || !isValid(sEnd)) return;

            // Find overlapping CAQs
            const coveringCAQs = caqEvents.filter(caq => {
                const cStart = safeParseDate(caq.start);
                const cEnd = safeParseDate(caq.end);
                return (cStart <= sEnd && cEnd >= sStart);
            });

            if (coveringCAQs.length > 0) {
                // Check LEVEL consistency
                const matchingLevelCAQ = coveringCAQs.find(caq => caq.level === study.level);

                if (!matchingLevelCAQ) {
                    const coveredLevels = coveringCAQs.map(c => c.level || 'Non spécifié').join(', ');
                    report.controls.push({
                        type: TIMELINE_STATUS.ERROR,
                        message: `Incohérence de programme : Études en "${study.level || 'Non spécifié'}" sous un CAQ pour "${coveredLevels}".`,
                        date: study.start
                    });
                    report.score -= 20;
                } else {
                    const caqStart = safeParseDate(matchingLevelCAQ.start);
                    const caqEnd = safeParseDate(matchingLevelCAQ.end);

                    if (isBefore(sStart, caqStart) && differenceInDays(caqStart, sStart) > 30) {
                        report.controls.push({
                            type: TIMELINE_STATUS.WARNING,
                            message: `Études (${study.level}) commencées avant le début du CAQ approprié (${formatDate(caqStart)}).`,
                            date: study.start
                        });
                        report.score -= 5;
                    }
                    if (isAfter(sEnd, caqEnd) && differenceInDays(sEnd, caqEnd) > 30) {
                        report.controls.push({
                            type: TIMELINE_STATUS.WARNING,
                            message: `Études (${study.level}) continuées après la fin du CAQ approprié (${formatDate(caqEnd)}).`,
                            date: study.end
                        });
                        report.score -= 5;
                    }
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
                const pStart = safeParseDate(p.start);
                const pEnd = safeParseDate(p.end);
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
        const moveDate = safeParseDate(move.submissionDate || move.start);
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
        const today = safeParseDate(new Date());
        absencePeriods.push({ start: lastMovementDate, end: today, isOpen: true });
    }

    // Validate Studies during Absence
    if (studyEvents.length > 0 && absencePeriods.length > 0) {
        studyEvents.forEach(study => {
            const sStart = safeParseDate(study.start);
            const sEnd = safeParseDate(study.end);
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
        const sortedStudies = [...studyEvents].sort((a, b) => safeParseDate(a.start) - safeParseDate(b.start));

        for (let i = 0; i < sortedStudies.length - 1; i++) {
            const currentStudyEnd = safeParseDate(sortedStudies[i].end);
            const nextStudyStart = safeParseDate(sortedStudies[i + 1].start);

            const gapInDays = differenceInDays(nextStudyStart, currentStudyEnd);

            if (gapInDays > 150) {
                // Check if this gap falls within a CAQ
                // We check if the midpoint of the gap is covered by a CAQ
                const gapMidPoint = addDays(currentStudyEnd, Math.floor(gapInDays / 2));

                const isUnderCAQ = caqEvents.some(caq => {
                    return isAfter(gapMidPoint, safeParseDate(caq.start)) && isBefore(gapMidPoint, safeParseDate(caq.end));
                });

                if (isUnderCAQ) {
                    // Check if this gap is covered by a MEDICAL event
                    // We treat it impartially: It justifies the 'reason' but requires strict verification.

                    const gapStart = addDays(currentStudyEnd, 1);
                    const gapEnd = addDays(nextStudyStart, -1);

                    const medicalJustification = sortedEvents.find(e =>
                        e.type === 'MEDICAL' &&
                        safeParseDate(e.start) <= gapEnd &&
                        (safeParseDate(e.end) >= gapStart || !e.end)
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

    // Combine and sort all alerts chronologically
    const allAlerts = [
        ...report.controls,
        ...report.insuranceIssues,
        ...report.successionIssues
    ].sort((a, b) => {
        const dateA = a.date ? safeParseDate(a.date) : safeParseDate(0);
        const dateB = b.date ? safeParseDate(b.date) : safeParseDate(0);
        return dateA - dateB;
    });

    // Replace individual arrays with sorted combined array
    report.allAlerts = allAlerts;

    return report;
}
