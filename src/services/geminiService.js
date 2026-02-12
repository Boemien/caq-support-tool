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
    // PARCOURS & VIE DU CANDIDAT
    'CAQ': 'Demande de CAQ / Certificat d\'Acceptation du Québec',
    'WORK_PERMIT': 'Permis de Travail ou Permis d\'Études',
    'DOCS_SENT': 'Dépôt du dossier / Envoi des documents au MIFI',
    'STUDIES': 'Période d\'études active',
    'INSURANCE': 'Couverture d\'assurance maladie/voyage',
    'ENTRY': 'Entrée sur le territoire canadien',
    'EXIT': 'Sortie du territoire canadien',
    'MEDICAL': 'Congé médical ou période d\'interruption pour santé',
    'OTHER': 'Événement divers',

    // ACTES ADMINISTRATIFS & DÉCISIONS
    'CAQ_REFUSAL': 'Décision de Refus de CAQ',
    'INTENT_REFUSAL': 'Avis d\'intention de refus (MIFI)',
    'INTENT_CANCEL': 'Avis d\'intention d\'annulation du CAQ',
    'CAQ_CANCEL': 'Confirmation d\'annulation du CAQ',
    'FRAUD_REJECTION': 'Rejet pour Faux ou Trompeur (Art. 56-57 LIQ)',
    'INTERVIEW': 'Convocation à une entrevue avec l\'immigration',

    // FALLBACKS / OTHER LOGIC TYPES
    'VISA': 'Permis d\'études / Visa de résident temporaire',
    'REFUSAL': 'Décision de refus (Générique)',
    'EXT_STATUS': 'Période de Statut maintenu / Rétablissement de statut'
};

/**
 * Generates a detailed narrative report based on the dossier data and analysis results.
 */
export async function generateDetailedReport(dossierData, analysisResults, events) {
    if (!genAI) {
        throw new Error("Connexion aux services de rapport indisponible (Clé manquante).");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const prompt = `
Tu es un Expert Conseil en Immigration Senior spécialisé dans les dossiers de CAQ (Certificat d'Acceptation du Québec) pour les étudiants étrangers.
Ton rôle est de rédiger un "Compte-rendu d'analyse détaillée" pour un dossier de candidature.

Données du dossier :
- Profil : ${dossierData.category}
- Niveau d'études : ${dossierData.studyLevel}
- Type de demande : ${dossierData.applicationType}
- Pays de résidence : ${dossierData.country || 'Non spécifié'}
- Date de naissance : ${dossierData.dob} (${analysisResults.summary.profile})

Résultats de l'analyse automatique (Points techniques) :
${analysisResults.controls.map(c => `- ${c.label}: ${c.status} (${c.note || 'Pas de note'})`).join('\n')}

Chronologie des événements :
${events && events.length > 0 ? events.map(e => {
        const mainDate = e.submissionDate || e.start || e.end || 'Date non spécifiée';
        const period = (e.start && e.end) ? ` (Période complète : du ${e.start} au ${e.end})` : '';
        const level = e.level ? ` [Niveau: ${e.level}]` : '';
        const prog = e.linkedProgram ? ` [Programme: ${e.linkedProgram}]` : '';
        return `- ${mainDate}${period}${level}${prog} : ${EVENT_TYPE_LABELS[e.type] || e.type} (${e.title || e.note || 'Pas d\'observation'})`;
    }).join('\n') : "Aucune chronologie fournie."}

CONSIGNES POUR LE RAPPORT :
1. Titre : # Compte-rendu d'analyse détaillée
2. Ton : Professionnel, factuel, rassurant mais lucide. Utilise le "Nous" ou une forme impersonnelle ("L'analyse révèle...").
3. Structure :
   - ## Synthèse du profil : Présente brièvement le candidat et l'objet de sa demande.
   - ## Analyse narrative de la chronologie : Raconte le parcours du candidat de manière fluide. ANALYSE LES DÉLAIS entre les événements (ex: délai entre l'arrivée et le début des études, durée entre une intention de refus et la réponse).
   - ## Points de vigilance stratégiques : Identifie les risques potentiels basés sur les dates (délais trop courts, interruptions trop longues, validité expirée).
   - ## Recommandations prioritaires : Liste les actions concrètes.
4. IMPORTANT : Ne mentionne JAMAIS que ce rapport est généré par une IA.
5. Langue : Français de France (ou Québec).
6. Format : Markdown.
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erreur Gemini Détaillée:", error);
        if (error.message?.includes('404')) {
            throw new Error("Le service d'analyse narrative rencontre une erreur de configuration (Modèle introuvable).");
        }
        throw new Error("Le service d'analyse narrative est temporairement indisponible.");
    }
}
