import { STATUS, SEVERITY, RECOMMENDATION, FINANCIAL_THRESHOLDS, APPLICATION_TYPE, STUDY_LEVEL, FINANCE_MIFI_COUNTRIES } from './constants.js';
import { differenceInMonths, isBefore, addMonths, subMonths, differenceInYears } from 'date-fns';

export function analyzeDossier(data) {
    const controls = [];
    const isMinorCategory = data.category && data.category.startsWith('MIN');
    // Official Quebec rule: minors are 16 and under, 17+ follow major rules
    const age = data.dob ? differenceInYears(new Date(), new Date(data.dob)) : null;
    const isAdult = isMinorCategory ? false : (age !== null ? age >= 17 : true);
    const isRenewal = data.applicationType === APPLICATION_TYPE.RENEWAL;
    const isUniversity = data.studyLevel === STUDY_LEVEL.UNIVERSITY;
    const isPrimary = data.studyLevel === STUDY_LEVEL.PRIMAIRE;

    // Country-based finance rule
    const isMifiFinanceCountry = data.country && FINANCE_MIFI_COUNTRIES.some(c =>
        c.toLowerCase() === data.country.trim().toLowerCase()
    );

    // --- PIÈCES JUSTIFICATIVES ---

    // Primary Exemption info
    if (isPrimary) {
        controls.push({
            label: 'Exemption CAQ (Niveau Primaire)',
            status: STATUS.OK,
            severity: SEVERITY.MINOR,
            legalRef: 'Art. 3 RIQ',
            note: 'Note : Un enfant mineur qui est déjà au Québec et dont un parent est travailleur temporaire ou étudiant étranger n\'a pas besoin de CAQ pour le primaire/secondaire.'
        });
    }

    // Passport check
    let passportStatus = STATUS.OK;
    let passportNote = '';
    if (data.passportStatus === 'absent') {
        passportStatus = STATUS.MISSING;
        passportNote = 'Passeport absent.';
    } else if (data.passportStatus === 'expired') {
        passportStatus = STATUS.EXPIRED;
        passportNote = 'Le passeport est expiré.';
    } else if (isAdult && !data.passportSigned) {
        passportStatus = STATUS.INCONSISTENT;
        passportNote = 'Passeport non signé : fournir une autre pièce d\'identité officielle avec photo et signature.';
    }

    controls.push({
        label: 'Passeport et signature conformes',
        status: passportStatus,
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 13 RIQ',
        note: passportNote
    });

    // Forms
    controls.push({
        label: 'Formulaires déclaration et engagement',
        status: data.formDeclaration ? STATUS.OK : STATUS.MISSING,
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 13 RIQ'
    });

    controls.push({
        label: "Lettre d'admission ou Attestation",
        status: data.admissionLetter ? STATUS.OK : (isPrimary || isMinorCategory ? STATUS.OK : STATUS.MISSING),
        severity: SEVERITY.BLOCKING,
        legalRef: 'Art. 13 RIQ',
        note: (isPrimary || isMinorCategory)
            ? 'Note : Pas requise pour les moins de 16 ans au primaire/secondaire si un parent a un statut. Sinon, à fournir.'
            : 'Doit inclure : programme, diplôme, dates début/fin, nb crédits/heures, stage (< 50% durée), conditions admission, montant frais scolarité.'
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
                label: 'Justification temps plein / Documents officiels',
                status: data.fullTimeJustification ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MINOR,
                legalRef: 'Art. 11 RIQ',
                note: 'Sceau, signature registraire, timbres passeport ou certificat médical requis.'
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
                legalRef: 'Art. 13 RIQ',
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
            // According to Quebec.ca: Consent OR Proof of Sole Custody
            const hasConsent = data.consentDeclaration || data.soleCustodyProof;
            controls.push({
                label: 'Consentement OU Preuve de garde exclusive',
                status: hasConsent ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 13 RIQ',
                note: data.soleCustodyProof ? 'Justifié par preuve de garde exclusive.' : 'Situation B : Consentement requis si pas de garde exclusive.'
            });
        }

        // Reminder for all signatures
        controls.push({
            label: 'Formulaires signés (Manuscrit/Numérisé)',
            status: (data.formDeclaration && data.admissionLetter) ? STATUS.OK : STATUS.MISSING,
            severity: SEVERITY.MINOR,
            legalRef: 'GPI 3.5',
            note: 'Les signatures dactylographiées ne sont pas acceptées. Signature manuscrite (stylet/souris) ou numérisée requise.'
        });


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
                severity: SEVERITY.MAJOR,
                legalRef: 'Art. 14 RIQ'
            });
            controls.push({
                label: 'Identité du responsable au Québec',
                status: data.responsibleAdultIdentity ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 14 RIQ'
            });
            controls.push({
                label: 'Preuve de résidence de l\'adulte responsable',
                status: data.residenceProof ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR,
                legalRef: 'Art. 14 RIQ'
            });
            controls.push({
                label: 'Absence antécédents judiciaires (Tous adultes résidence)',
                status: data.criminalRecordCheck ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.BLOCKING,
                legalRef: 'Art. 14 RIQ',
                note: 'Rapport de police requis pour chaque adulte du foyer.'
            });
        }
    }

    // Situation D: emancipated (handled in App.jsx but reinforced here)
    if (data.minorSituation === 'emancipated') {
        controls.push({
            label: "Jugement d'émancipation (si applicable)",
            status: data.emancipationJudgment ? STATUS.OK : STATUS.MISSING,
            severity: SEVERITY.BLOCKING,
            legalRef: 'Art. 13 RIQ',
            note: 'Requis pour les mineurs émancipés de 16 ans et moins.'
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
            // Basic coverage check: sum of months should roughly match study duration
            // This is a simplified check for the demonstration
            controls.push({
                label: 'Assurances passées (Maintien de couverture)',
                status: hasPast ? STATUS.OK : STATUS.MISSING,
                severity: SEVERITY.MAJOR,
                legalRef: 'Art. 15 RIQ',
                note: !hasPast ? 'Requis pour Renouvellement : Prouver le maintien de l\'assurance pour toute la durée du séjour précédent.' : 'Périodes déclarées.'
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
            legalRef: 'Art. 15 RIQ',
            note: 'Réputées incluses.'
        });
    }

    // --- FINANCES ---
    let financeStatus = STATUS.OK;
    let financeNote = '';

    if (data.isConditional) {
        financeStatus = STATUS.OK;
        financeNote = 'Dossier Conditionnel (Exemption financière)';
    } else if (!isMifiFinanceCountry && data.country !== 'Autre territoire') {
        // Territory where finance is verified at the Federal level (IRCC) instead of MIFI
        financeStatus = STATUS.OK;
        financeNote = 'Vérification au niveau Fédéral (IRCC) uniquement pour ce territoire.';

        controls.push({
            label: 'Capacité financière (IRCC)',
            status: STATUS.OK,
            severity: SEVERITY.MINOR,
            legalRef: 'Lien MIFI-IRCC',
            note: 'Pour ce territoire, le MIFI ne vérifie pas la capacité financière au stade du CAQ. Elle sera vérifiée par le Bureau canadien des visas (IRCC).'
        });
    } else {
        // Payer-specific checks for MIFI territories
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
            } else if (!data.bankStatements6Months) {
                financeStatus = STATUS.MISSING;
                financeNote = 'Relevés bancaires des 6 derniers mois requis (doit montrer transactions, solde et propriété).';
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
