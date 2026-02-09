import { analyzeDossier } from './src/logic/ruleEngine.js';
import { RECOMMENDATION, STATUS, APPLICATION_TYPE, STUDY_LEVEL } from './src/logic/constants.js';

const testCases = [
    {
        name: "Adulte Universitaire Parfait (Assurance implicite)",
        data: {
            dob: '1990-01-01',
            applicationType: APPLICATION_TYPE.FIRST,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2028-05-30',
            financeMode: 'calculate',
            availableFunds: 25000,
            financialProof: true
        },
        expected: RECOMMENDATION.ACCEPTABLE
    },
    {
        name: "Collégial Première demande (Assurance passée non requise)",
        data: {
            dob: '2000-01-01',
            applicationType: APPLICATION_TYPE.FIRST,
            studyLevel: STUDY_LEVEL.COLLEGIAL,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2028-05-30',
            financeMode: 'manual',
            financialProof: true,
            pastInsurances: [],
            futureInsurances: [{ start: '2025-09-01', end: '2028-05-30' }]
        },
        expected: RECOMMENDATION.ACCEPTABLE
    },
    {
        name: "Mineur (Fonds insuffisants)",
        data: {
            dob: '2015-01-01',
            applicationType: APPLICATION_TYPE.FIRST,
            studyLevel: STUDY_LEVEL.PROFESSIONAL,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2026-06-30',
            financeMode: 'calculate',
            availableFunds: 5000,
            financialProof: true,
            pastInsurances: [{ start: '2024-01-01', end: '2025-01-01' }],
            futureInsurances: [{ start: '2025-09-01', end: '2026-09-01' }]
        },
        expected: RECOMMENDATION.HIGH_RISK
    },
    {
        name: "Renouvellement avec Lettre Explicative (Accepted)",
        data: {
            dob: '2000-01-01',
            applicationType: APPLICATION_TYPE.RENEWAL,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2026-06-30',
            financeMode: 'manual',
            financialProof: true,
            transcripts: false,
            explanationsStudy: true,
            fullTimeJustification: true
        },
        expected: RECOMMENDATION.COMPLETE // La lettre explicative est un point majeur à vérifier
    },
    {
        name: "Adulte Conditionnel (MAJ 1 C - Pas de finance)",
        data: {
            dob: '1990-01-01',
            applicationType: APPLICATION_TYPE.FIRST,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            isConditional: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2028-05-30',
            financialProof: false // Pas de preuve jointe, mais Conditionnel
        },
        expected: RECOMMENDATION.ACCEPTABLE
    },
    {
        name: "Garant sans formulaire (Bloquant)",
        data: {
            dob: '2005-01-01',
            applicationType: APPLICATION_TYPE.FIRST,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            payerType: 'guarantor',
            supportForm: false, // Missing
            guarantorFinanceProof: true,
            financeMode: 'manual',
            financialProof: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2028-05-30'
        },
        expected: RECOMMENDATION.HIGH_RISK
    },
    {
        name: "Auto-payeur Renouvellement (Manque relevés 6 mois)",
        data: {
            dob: '2000-01-01',
            applicationType: APPLICATION_TYPE.RENEWAL,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            payerType: 'self',
            selfFinanceProof: true,
            bankStatements6Months: false, // Missing for renewal > 6 months
            financeMode: 'manual',
            financialProof: true,
            formDeclaration: true,
            admissionLetter: true,
            transcripts: true,
            startDate: '2025-09-01',
            endDate: '2026-05-30'
        },
        expected: RECOMMENDATION.COMPLETE
    },
    {
        name: "Auto-payeur Renouvellement Valide",
        data: {
            dob: '2000-01-01',
            applicationType: APPLICATION_TYPE.RENEWAL,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            payerType: 'self',
            selfFinanceProof: true,
            bankStatements6Months: true,
            financeMode: 'manual',
            financialProof: true,
            formDeclaration: true,
            admissionLetter: true,
            transcripts: true,
            startDate: '2025-09-01',
            endDate: '2026-05-30'
        },
        expected: RECOMMENDATION.ACCEPTABLE
    },
    {
        name: "Renouvellement Continuité Invalide",
        data: {
            dob: '2000-01-01',
            applicationType: APPLICATION_TYPE.RENEWAL,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            payerType: 'self',
            selfFinanceProof: true,
            bankStatements6Months: true,
            financeMode: 'manual',
            financialProof: true,
            formDeclaration: true,
            admissionLetter: true,
            transcripts: true,
            prevCAQStart: '2024-01-01',
            prevCAQEnd: '2024-12-31',
            prevStudyStart: '2023-09-01', // Out of CAQ range
            prevStudyEnd: '2024-12-31',
            startDate: '2025-01-01',
            endDate: '2025-12-31'
        },
        expected: RECOMMENDATION.COMPLETE // Major issue due to lack of continuity
    },
    {
        name: "Renouvellement Entrée Inconsistante",
        data: {
            dob: '2000-01-01',
            applicationType: APPLICATION_TYPE.RENEWAL,
            studyLevel: STUDY_LEVEL.UNIVERSITY,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            payerType: 'self',
            selfFinanceProof: true,
            bankStatements6Months: true,
            financeMode: 'manual',
            financialProof: true,
            formDeclaration: true,
            admissionLetter: true,
            transcripts: true,
            entryDate: '2025-02-01', // Late entry
            startDate: '2025-01-01',
            endDate: '2025-12-31'
        },
        expected: RECOMMENDATION.ACCEPTABLE // Minor issue, still acceptable but flagged
    },
    {
        name: "Mineur - Manque Documents Spécifiques (Bloquant)",
        data: {
            dob: '2010-01-01', // Minor
            applicationType: APPLICATION_TYPE.FIRST,
            studyLevel: STUDY_LEVEL.COLLEGIAL,
            passportStatus: 'valid',
            photo: true,
            paymentProof: true,
            formDeclaration: true,
            admissionLetter: true,
            startDate: '2025-09-01',
            endDate: '2028-05-30',
            financeMode: 'manual',
            financialProof: true,
            futureInsurances: [{ start: '2025-09-01', end: '2028-05-30' }],
            // Missing major minor docs
            birthCertificate: false,
            parentsIdentity: false,
            responsibleAdultIdentity: true,
            residenceProof: true
        },
        expected: RECOMMENDATION.HIGH_RISK
    }
];

console.log("--- DÉMARRAGE DES TESTS DU MOTEUR DE RÈGLES (V1.2) ---");

testCases.forEach(test => {
    const result = analyzeDossier(test.data);
    const pass = result.recommendation === test.expected;
    console.log(`${pass ? '✅' : '❌'} [${test.name}]`);
    if (!pass) {
        console.log(`   Expected: ${test.expected}, Got: ${result.recommendation}`);
    }
});
