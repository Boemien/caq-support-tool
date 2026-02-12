import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Obfuscation helper: Decodes a slightly hidden string.
 */
const getDecodedKey = () => {
    const encoded = import.meta.env.VITE_GEMINI_API_KEY;
    if (!encoded) return null;
    return encoded;
};

const API_KEY = getDecodedKey();
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Comprehensive mapping of technical event IDs to professional French labels
const EVENT_TYPE_LABELS = {
    'CAQ': 'Demande de CAQ / Certificat d\'Acceptation du Québec',
    'WORK_PERMIT': 'Permis de Travail ou Permis d\'Études',
    'DOCS_SENT': 'Dépôt du dossier / Envoi des documents au MIFI',
    'STUDIES': 'Période d\'études active',
    'INSURANCE': 'Couverture d\'assurance maladie/voyage',
    'ENTRY': 'Entrée sur le territoire canadien',
    'EXIT': 'Sortie du territoire canadien',
    'MEDICAL': 'Congé médical ou période d\'interruption pour santé',
    'OTHER': 'Événement divers',
    'CAQ_REFUSAL': 'Décision de Refus de CAQ',
    'INTENT_REFUSAL': 'Avis d\'intention de refus (MIFI)',
    'INTENT_CANCEL': 'Avis d\'intention d\'annulation du CAQ',
    'CAQ_CANCEL': 'Confirmation d\'annulation du CAQ',
    'FRAUD_REJECTION': 'Rejet pour Faux ou Trompeur (Art. 56-57 LIQ)',
    'INTERVIEW': 'Convocation à une entrevue avec l\'immigration',
    'VISA': 'Permis d\'études / Visa de résident temporaire',
    'REFUSAL': 'Décision de refus (Générique)',
    'EXT_STATUS': 'Période de Statut maintenu / Rétablissement de statut'
};

/**
 * TYPE 1: Dossier Analysis Report
 * Focuses on evaluating the current application's chances and documents.
 */
export async function generateDossierReport(dossierData, analysisResults) {
    if (!genAI) throw new Error("Service indisponible.");

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const prompt = `
Tu es un Expert Conseil en Immigration Senior spécialisé dans les dossiers de CAQ.
Ton rôle est de rédiger un "Compte-rendu d'évaluation du dossier" (Current Application).

Données du dossier actuel :
- Profil : ${dossierData.category}
- Niveau d'études : ${dossierData.studyLevel}
- Type de demande : ${dossierData.applicationType}
- Pays de résidence : ${dossierData.country || 'Non spécifié'}
- Date de naissance : ${dossierData.dob} (${analysisResults.summary.profile})

Résultats de l'analyse technique (Checklist) :
${analysisResults.controls.map(c => `- ${c.label}: ${c.status} (${c.note || 'Pas de note'})`).join('\n')}

CONSIGNES DE SÉPARATION STRICTE :
1. Titre : # Analyse de conformité du dossier de CAQ
2. Focus exclusif : Évalue la conformité du dossier de candidature présent (documents, seuils, formulaires).
3. INTERDICTION : Ne mélange PAS l'analyse historique du parcours avec ce diagnostic documentaire.
4. INTERDICTION : Ne mentionne PAS les événements de la chronologie (CAQ passés, dates d'entrée, etc.). Concentre-toi sur le dossier "statique".
5. Structure :
   - ## Synthèse de la demande : Résume l'objet du dossier actuel.
   - ## Diagnostic de conformité : Analyse les points validés et les lacunes documentaires.
   - ## Recommandations immédiates : Liste les actions pour sécuriser ce dépôt précis.
6. IMPORTANT : Ne mentionne PAS l'IA.
7. Format : Markdown.
`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini Dossier Error:", error);
        throw new Error("Impossible de générer l'analyse du dossier.");
    }
}

/**
 * TYPE 2: Chronology / Path Analysis Report
 * Focuses on evaluating the student's historical consistency and compliance over time.
 */
export async function generateChronologyReport(dossierData, events) {
    if (!genAI) throw new Error("Service indisponible.");

    // Strip "Finance à vérifier" or other current application statuses from the category for the audit
    const cleanCategory = (dossierData.category || '').split('(')[0].trim();

    const eventsList = (events || []).map(e => {
        const typeLabel = EVENT_TYPE_LABELS[e.type] || e.type;
        const mainTitle = e.title || typeLabel;
        const submission = e.submissionDate ? `[Date de dépôt/demande : ${e.submissionDate}]` : '';
        const validity = (e.start && e.end) ? `[Période effective/validité : du ${e.start} au ${e.end}]` : (e.start ? `[Date d'événement : ${e.start}]` : '');
        const role = e.category === 'ADM' ? 'Administratif/MIFI' : 'Candidat';
        const notes = e.note ? ` - Note : ${e.note}` : '';

        return `- ${mainTitle} (${role}) | Type: ${typeLabel} ${submission} ${validity}${notes}`;
    }).join('\n');

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const prompt = `
Tu es un Expert Conseil en Immigration Senior spécialisé dans l'analyse de parcours.
Ton rôle est de rédiger un "Audit de parcours et chronologie migratoire".

DONNÉES CHRONOLOGIQUES À ANALYSER (BRUTES) :
${eventsList || "Aucune donnée chronologique."}

CONSIGNES DE SÉPARATION ET PRÉCISION :
1. Titre : # Expertise de parcours et continuité historique
2. RÈGLE D'OR : Ne confonds PAS les "Demandes" (Date de dépôt) et les "Octrois" (Période de validité). 
   - La date de dépôt marque le début d'un processus.
   - La période de validité (début/fin) marque l'autorisation effective.
   - Un délai important entre les deux est un temps de traitement.
3. INTERDICTION : Si un événement mentionne une date de dépôt en 2017 mais qu'un octroi commence en 2023, n'invente pas de validité entre les deux. Analyse le "trou" comme une période sans statut ou une interruption.
4. Focus exclusif : Analyse UNIQUEMENT la cohérence du parcours dans le temps (le passé). Discute des délais d'entrée, des ruptures de statut et des enchaînements logiques.
5. NE mentionne PAS le profil actuel du candidat (âge, niveau d'études actuel) sauf si cela ressort directement de l'historique des événements fournis.
6. Structure :
   - ## Reconstitution narrative : Raconte le parcours passé de manière fluide en respectant la nuance Demande vs Octroi.
   - ## Analyse des délais et conformité : Commente spécifiquement les temps de traitement et les interruptions.
   - ## Points de vigilance historiques : Identifie les risques (ex: entrée tardive, CAQ expiré sans renouvellement immédiat).
7. IMPORTANT : Ne mentionne PAS l'IA.
8. Format : Markdown.
`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini Chronology Error:", error);
        throw new Error("Impossible de générer l'audit de chronologie.");
    }
}
