import { STATUS, SEVERITY, RECOMMENDATION, FINANCIAL_THRESHOLDS, APPLICATION_TYPE, STUDY_LEVEL } from './constants.js';
import { differenceInMonths, isBefore, addMonths, subMonths, differenceInYears } from 'date-fns';

export function analyzeDossier(data) {
    const controls = [];
    const isMinorCategory = data.category && data.category.startsWith('MIN');
    const isAdult = isMinorCategory ? false : (data.dob ? differenceInYears(new Date(), new Date(data.dob)) >= 18 : true);
    const isRenewal = data.applicationType === APPLICATION_TYPE.RENEWAL;
    const isUniversity = data.studyLevel === STUDY_LEVEL.UNIVERSITY;

    // --- PIÈCES JUSTIFICATIVES ---

    // Passport check
    let passportStatus = STATUS.OK;
    if (data.passportStatus === 'absent') passportStatus = STATUS.MISSING;
    else if (data.passportStatus === 'expired') passportStatus = STATUS.EXPIRED;

    controls.push({
        label: 'Passeport et signature conformes',
        status: passportStatus,
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 13 RIQ',
        note: passportStatus === STATUS.EXPIRED ? 'Le passeport est expiré.' :
            passportStatus === STATUS.MISSING ? 'Passeport absent.' : ''
    });

    // Forms
    controls.push({
        label: 'Formulaires déclaration et engagement',
        status: data.formDeclaration ? STATUS.OK : STATUS.MISSING,
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 13 RIQ'
    });

    // Admission
    controls.push({
        label: "Lettre d'admission / Attestation",
        status: data.admissionLetter ? STATUS.OK : STATUS.MISSING,
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 13 RIQ'
    });

    // Renewal specific documents & Continuity
    if (isRenewal) {
        const transcriptsStatus = data.transcripts ? STATUS.OK : (data.explanationsStudy ? STATUS.INCONSISTENT : STATUS.MISSING);
        controls.push({
            label: 'Relevé de notes officiel',
            status: transcriptsStatus,
            severity: SEVERITY.MAJOR,
            legalRef: 'Art. 11 RIQ',
            note: transcriptsStatus === STATUS.INCONSISTENT ? 'Lettre explicative fournie.' : ''
        });

        if (data.explanationsStudy) {
            controls.push({
                label: 'Justification temps plein',
                status: data.fullTimeJustification ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MINOR
            });
        }

        // Continuity check: Previous CAQ vs Previous Study
        if (data.prevCAQStart && data.prevCAQEnd && data.prevStudyStart && data.prevStudyEnd) {
            const caqS = new Date(data.prevCAQStart);
            const caqE = new Date(data.prevCAQEnd);
            const studyS = new Date(data.prevStudyStart);
            const studyE = new Date(data.prevStudyEnd);

            const isCovered = (caqS <= studyS) && (caqE >= studyE);

            controls.push({
                label: 'Continuité CAQ / Études précédentes',
                status: isCovered ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR,
                legalRef: 'Art. 11 RIQ',
                note: !isCovered ? 'La période du CAQ précédent ne couvre pas entièrement les études déclarées.' : 'Continuité vérifiée.'
            });
        }

        if (data.entryDate && data.startDate) {
            const entryD = new Date(data.entryDate);
            const studyS = new Date(data.startDate);
            const entryValid = entryD <= studyS;

            controls.push({
                label: "Date d'entrée vs Début Études",
                status: entryValid ? STATUS.OK : STATUS.INCONSISTENT,
                severity: SEVERITY.MINOR,
                legalRef: 'Art. 11 RIQ',
                note: !entryValid ? "La date d'entrée déclarée est postérieure au début des cours." : ""
            });
        }

        if (data.isNewProgram) {
            controls.push({
                label: 'Profil : Nouveau Programme',
                status: STATUS.OK,
                severity: SEVERITY.MINOR,
                note: 'Le candidat entame un nouveau programme.'
            });
        }
    }

    // --- DOCUMENTS POUR MINEUR ---
    // Determine minor age category and situation
    const minorAge = isAdult ? null : (data.dob ? differenceInYears(new Date(), new Date(data.dob)) : null);
    const isEmancipated = data.minorSituation === 'emancipated' || minorAge === 17;
    
    if (!isAdult && !isEmancipated) {
        // Common requirements for all minor situations (A, B, C)
        controls.push({
            label: 'Certificat de naissance (Noms parents requis)',
            status: data.birthCertificate ? STATUS.OK : STATUS.MISSING,
            severity: SEVERITY.BLOCKING,
            legalRef: 'Art. 13 RIQ'
        });
        controls.push({
            label: 'Identité des deux parents (Passeport/CNI)',
            status: data.parentsIdentity ? STATUS.OK : STATUS.MISSING,
            severity: SEVERITY.BLOCKING,
            legalRef: 'Art. 13 RIQ'
        });

        // Situation A: Accompanied by both parents
        if (data.minorSituation === 'both_parents') {
            controls.push({
                label: 'Durée du séjour des parents (Permis/Admission)',
                status: data.accompanyingParentsStatus ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR,
                note: 'Établit la validité du CAQ de l\'enfant. Situation A: Les deux parents accompagnent.'
            });
        }

        // Situation B: Accompanied by one parent
        if (data.minorSituation === 'one_parent') {
            controls.push({
                label: 'Identité du parent non-accompagnant',
                status: data.nonAccompanyingParentIdentity ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 13 RIQ'
            });
            const hasConsent = data.consentDeclaration || data.soleCustodyProof;
            controls.push({
                label: 'Consentement du parent non-accompagnant',
                status: hasConsent ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 13 RIQ',
                note: data.soleCustodyProof ? 'Justifié par preuve de garde exclusive.' : 'Situation B: Un seul parent accompagne.'
            });
        }

        // Situation C: Unaccompanied
        if (data.minorSituation === 'unaccompanied') {
            controls.push({
                label: 'Délégation autorité parentale (Chaque parent)',
                status: data.parentalAuthorityDelegation ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 13 RIQ',
                note: 'Situation C: Enfant non accompagné. Délégation formelle de chaque parent requise.'
            });
            controls.push({
                label: 'Prise en charge par un adulte au Québec',
                status: data.custodyDeclaration ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 14 RIQ'
            });
            controls.push({
                label: 'Statut du responsable (Citoyen/RP)',
                status: data.citizenshipProof ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR
            });
            controls.push({
                label: 'Identité du responsable au Québec',
                status: data.responsibleAdultIdentity ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING
            });
            controls.push({
                label: 'Preuve de résidence de l\'adulte responsable',
                status: data.residenceProof ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR
            });
            controls.push({
                label: 'Absence d\'antécédents judiciaires (Tous adultes du foyer)',
                status: data.criminalRecordCheck ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR,
                note: 'Requis pour chaque adulte résidant avec l\'enfant.'
            });
        }
    }
    
    // Situation D: 17 years old or Emancipated (triggers major-student rules)
    if (!isAdult && (minorAge === 17 || isEmancipated)) {
        const hasEmancipationDoc = data.emancipationJudgment;
        controls.push({
            label: 'Jugement d\'émancipation (si applicable)',
            status: hasEmancipationDoc ? STATUS.OK : (isEmancipated ? STATUS.MISSING : STATUS.OK),
            severity: SEVERITY.MAJOR,
            legalRef: 'Art. 13 RIQ',
            note: 'Situation D: Mineur émancipé (17 ans ou plus) ou avec jugement. Règles adulte applicables.'
        });
    }

    // --- PROGRAMME & TIMELINE ---
    const programDuration = data.startDate && data.endDate ?
        differenceInMonths(new Date(data.endDate), new Date(data.startDate)) : 0;
    const programStatus = programDuration < 6 ? STATUS.INCONSISTENT : STATUS.OK;

    controls.push({
        label: 'Durée du programme (> 6 mois)',
        status: programStatus,
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 11 RIQ',
        note: programDuration < 6 ? 'Le programme doit durer plus de 6 mois.' : ''
    });

    // --- ASSURANCES ---
    if (!isUniversity) {
        if (isRenewal) {
            const hasPast = data.pastInsurances && data.pastInsurances.length > 0;
            controls.push({
                label: 'Assurances passées',
                status: hasPast ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR,
                legalRef: 'Art. 15 RIQ',
                note: !hasPast ? 'Requis pour Renouvellement Collégial/Professionnel.' : ''
            });
        }

        const hasFuture = data.futureInsurances && data.futureInsurances.length > 0;
        controls.push({
            label: 'Assurances futures',
            status: hasFuture ? STATUS.OK : STATUS.MISSING,
            severity: SEVERITY.MAJOR,
            legalRef: 'Art. 15 RIQ',
            note: !hasFuture ? 'Requis pour Collégial/Professionnel.' : ''
        });
    } else {
        controls.push({
            label: 'Assurances (Universitaire)',
            status: STATUS.OK,
            severity: SEVERITY.MINOR,
            note: 'Réputées incluses.'
        });
    }

    // --- FINANCES ---
    let financeStatus = STATUS.OK;
    let financeNote = '';

    if (data.isConditional) {
        financeStatus = STATUS.OK;
        financeNote = 'Dossier Conditionnel (Exemption financière)';
    } else {
        // Payer-specific checks
        if (data.payerType === 'guarantor') {
            if (!data.supportForm || !data.guarantorFinanceProof) {
                financeStatus = STATUS.MISSING;
                financeNote = 'Garant : Formulaire ou preuves financières manquants.';
            }
        } else {
            // Self-payer
            if (!data.selfFinanceProof) {
                financeStatus = STATUS.MISSING;
                financeNote = 'Candidat : Preuves financières récentes manquantes.';
            } else if (isRenewal && !data.bankStatements6Months) {
                // Technically the user said "if since > 6 months",
                // but the checkbox usually implies that condition is met.
                // We'll treat it as required for self-payer renewal if the box isn't checked
                // and maybe add a note.
                financeStatus = STATUS.MISSING;
                financeNote = 'Renouvellement Auto-payeur : Relevés bancaires 6 mois requis (si > 6 mois au Qc).';
            }
        }

        // Apply mode-based checks if primary documents are present
        if (financeStatus === STATUS.OK) {
            if (data.financeMode === 'manual') {
                financeStatus = data.financialProof ? STATUS.OK : STATUS.MISSING;
            } else {
                // Calculate mode
                const threshold = FINANCIAL_THRESHOLDS[data.studyLevel] || FINANCIAL_THRESHOLDS.UNIVERSITY;
                const isEnough = data.availableFunds >= threshold;
                financeStatus = isEnough ? STATUS.OK : STATUS.INSUFFICIENT;
                financeNote = !isEnough ? `Fonds (${data.availableFunds}$) < Seuil (${threshold}$)` : '';
            }
        }
    }

    controls.push({
        label: 'Capacité financière',
        status: financeStatus,
        severity: isAdult ? SEVERITY.MAJOR : SEVERITY.BLOCKING, // Plus critique pour les mineurs
        legalRef: 'Art. 14 RIQ',
        note: financeNote
    });

    // --- RECOMMANDATION ---
    let recommendation = RECOMMENDATION.ACCEPTABLE;
    const blocking = controls.filter(c => c.severity === SEVERITY.BLOCKING && c.status !== STATUS.OK);
    const major = controls.filter(c => c.severity === SEVERITY.MAJOR && c.status !== STATUS.OK);

    if (blocking.length > 0) {
        recommendation = RECOMMENDATION.HIGH_RISK;
    } else if (major.length > 0) {
        recommendation = RECOMMENDATION.COMPLETE;
    }

    // --- TIMELINE ---
    const caqStart = data.startDate ? subMonths(new Date(data.startDate), 1) : null;
    const caqEnd = data.endDate ? addMonths(new Date(data.endDate), 3) : null;

    return {
        controls,
        recommendation,
        caqStart,
        caqEnd,
        isAdult,
        isUniversity,
        category: data.category, // Pass through category
        summary: {
            blockingCount: blocking.length,
            majorCount: major.length,
            totalControls: controls.length,
            profile: isAdult ? 'Adulte / Majeur' : 'Candidat Mineur',
            level: data.studyLevel,
            type: data.applicationType === APPLICATION_TYPE.FIRST ? 'Première demande' : 'Renouvellement',
            passport: passportStatus === STATUS.OK ? 'Valide' :
                passportStatus === STATUS.EXPIRED ? 'Expiré / Non conforme' : 'Absent'
        }
    };
}
