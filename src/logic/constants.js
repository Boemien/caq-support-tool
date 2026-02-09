export const STATUS = {
    OK: 'OK',
    MISSING: 'Manquant',
    INCONSISTENT: 'Incohérent',
    EXPIRED: 'Expiré'
};

export const SEVERITY = {
    BLOCKING: 'Bloquant',
    MAJOR: 'Majeur',
    MINOR: 'Mineur'
};

export const RECOMMENDATION = {
    ACCEPTABLE: 'Acceptable',
    COMPLETE: 'À compléter',
    HIGH_RISK: 'Risque élevé'
};

export const APPLICATION_TYPE = {
    FIRST: 'Première demande',
    RENEWAL: 'Renouvellement'
};

export const STUDY_LEVEL = {
    PROFESSIONAL: 'Professionnel',
    COLLEGIAL: 'Collégial',
    UNIVERSITY: 'Universitaire'
};

export const FINANCIAL_THRESHOLDS = {
    SINGLE_ADULT: 15478, // Updated for 2025
    MINOR: 7739, // Roughly half or as per latest GPI
    TRANSPORTATION: 2000,
    INSTALLATION: 500
};

export const DOSSIER_CATEGORY = {
    MAJ_1_NC: 'MAJEUR Première demande (Finance à vérifier)',
    MAJ_R_NC: 'MAJEUR Renouvellement (Finance à vérifier)',
    MAJ_1_C: 'MAJEUR Première demande (Exemption financière)',
    MAJ_R_C: 'MAJEUR Renouvellement (Exemption financière)',
    MIN_1_NC: 'MINEUR Première demande (Finance à vérifier)',
    MIN_R_NC: 'MINEUR Renouvellement (Finance à vérifier)',
    MIN_1_C: 'MINEUR Première demande (Exemption financière)',
    MIN_R_C: 'MINEUR Renouvellement (Exemption financière)'
};
