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
    MAJ_1_NC: 'MAJ 1 NC',
    MAJ_R_NC: 'MAJ R NC',
    MAJ_1_C: 'MAJ 1 C',
    MAJ_R_C: 'MAJ R C',
    MIN_1_NC: 'MIN 1 NC',
    MIN_R_NC: 'MIN R NC',
    MIN_1_C: 'MIN 1 C',
    MIN_R_C: 'MIN R C'
};
