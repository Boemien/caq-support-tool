import { useState, useMemo } from 'react'
import {
    FileText, User, GraduationCap, Users, ShieldAlert,
    CheckCircle2, History, Timer, AlertTriangle, Info,
    DollarSign, ClipboardCheck, ArrowRight
} from 'lucide-react'
import { analyzeDossier } from './logic/ruleEngine'
import { STATUS, SEVERITY, RECOMMENDATION } from './logic/constants'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Components
import Timeline from './components/Timeline'
import Checklist from './components/Checklist'
import TimelineBuilder from './components/TimelineBuilder'

function App() {
    const [activeTab, setActiveTab] = useState('input')
    const [formData, setFormData] = useState({
        fileNumber: '',
        category: 'MAJ 1 NC',
        isConforming: false,
        dob: '',
        country: '',
        applicationType: 'Première demande',
        studyLevel: 'Collégial',
        passportStatus: 'valid',
        startDate: '',
        endDate: '',
        financeMode: 'calculate',
        availableFunds: 0,
        financialProof: false,
        formDeclaration: false,
        admissionLetter: false,
        transcripts: false,
        explanationsStudy: false,
        fullTimeJustification: false,
        pastInsurances: [],
        futureInsurances: [],
        prevCAQStart: '',
        prevCAQEnd: '',
        prevStudyStart: '',
        prevStudyEnd: '',
        entryDate: '',
        isNewProgram: false,
        payerType: 'self', // 'self' or 'guarantor'
        supportForm: false,
        guarantorFinanceProof: false,
        bankStatements6Months: false,
        selfFinanceProof: false,
        // Minor-specific documents
        birthCertificate: false,
        parentsIdentity: false,
        parentalAuthorityDeclaration: false,
        custodyDeclaration: false,
        citizenshipProof: false,
        consentDeclaration: false,
        soleCustodyProof: false,
        nonAccompanyingParentIdentity: false,
        accompanyingParentsStatus: false,
        parentalAuthorityDelegation: false,
        responsibleAdultIdentity: false,
        residenceProof: false,
        criminalRecordCheck: false,
        minorSituation: 'both_parents', // 'both_parents', 'one_parent', 'unaccompanied', 'emancipated'
        emancipationJudgment: false,
        passportSigned: false,
    })

    const [timelineEvents, setTimelineEvents] = useState([])
    const [reportSource, setReportSource] = useState('dossier') // 'dossier' or 'pathway'

    const analysis = useMemo(() => analyzeDossier(formData), [formData])

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleCategoryChange = (e) => {
        const cat = e.target.value;
        const isMinor = cat.startsWith('MIN');
        const isRenewal = cat.includes('Renouvellement');
        const isConditional = cat.includes('Exemption');

        setFormData(prev => ({
            ...prev,
            category: cat,
            applicationType: isRenewal ? 'Renouvellement' : 'Première demande',
            isConditional: isConditional,
            // Only update DOB if empty or incompatible
            dob: prev.dob ? prev.dob : (isMinor ? '2015-01-01' : '2000-01-01')
        }));
    }


    const addInsurance = (type) => {
        setFormData(prev => ({
            ...prev,
            [type === 'past' ? 'pastInsurances' : 'futureInsurances']: [
                ...prev[type === 'past' ? 'pastInsurances' : 'futureInsurances'],
                { start: '', end: '' }
            ]
        }))
    }

    const updateInsurance = (type, index, field, value) => {
        setFormData(prev => {
            const list = [...prev[type === 'past' ? 'pastInsurances' : 'futureInsurances']]
            list[index][field] = value
            return {
                ...prev,
                [type === 'past' ? 'pastInsurances' : 'futureInsurances']: list
            }
        })
    }

    const removeInsurance = (type, index) => {
        setFormData(prev => ({
            ...prev,
            [type === 'past' ? 'pastInsurances' : 'futureInsurances']: prev[type === 'past' ? 'pastInsurances' : 'futureInsurances'].filter((_, i) => i !== index)
        }))
    }

    const getRecommendationColor = (rec) => {
        switch (rec) {
            case RECOMMENDATION.ACCEPTABLE: return '#2c3e50'; // Deep blue/slate
            case RECOMMENDATION.COMPLETE: return '#3182ce';   // Quebec-adjacent blue
            case RECOMMENDATION.HIGH_RISK: return '#e53e3e';  // Alert red
            default: return '#718096';
        }
    }

    return (
        <div className="app-container">
            <header>
                <div className="brand">
                    <div className="logo-box"><FileText size={24} color="white" /></div>
                    <div className="brand-text">
                        <h1>Outil d'accompagnement de demande de CAQ <span className="version">v1.1</span></h1>
                        <div className="by-brand">par <a href="https://www.cvquebec.ca" target="_blank" rel="noopener noreferrer"><strong>CVQUEBEC</strong></a></div>
                    </div>
                </div>
                <nav className="nav-tabs">
                    <button
                        className={`nav-item mode-dossier ${activeTab === 'input' ? 'active' : ''}`}
                        onClick={() => setActiveTab('input')}
                    >
                        <FileText size={18} /> 1. Analyse du Dossier
                    </button>
                    <button
                        className={`nav-item mode-pathway ${activeTab === 'chronology' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chronology')}
                    >
                        <History size={18} /> 2. Reconstitution Chronologique
                    </button>
                    <button
                        className={`nav-item mode-report ${activeTab === 'analysis' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analysis')}
                    >
                        <ShieldAlert size={18} /> 3. Rapport Final
                    </button>
                </nav>
            </header>

            <main>
                {activeTab === 'input' ? (
                    <div className="input-layout fade-in">
                        <div className="form-column">

                            <section className="card form-card mode-header-dossier">
                                <div className="card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <User size={18} />
                                        <h2>Saisie & Analyse Individuelle</h2>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Catégorie de Dossier (GPI)</label>
                                    <select name="category" value={formData.category} onChange={handleCategoryChange} className="category-select">
                                        <option value="MAJEUR Première demande (Finance à vérifier)">MAJEUR Première demande (Finance à vérifier)</option>
                                        <option value="MAJEUR Renouvellement (Finance à vérifier)">MAJEUR Renouvellement (Finance à vérifier)</option>
                                        <option value="MAJEUR Première demande (Exemption financière)">MAJEUR Première demande (Exemption financière)</option>
                                        <option value="MAJEUR Renouvellement (Exemption financière)">MAJEUR Renouvellement (Exemption financière)</option>
                                        <option value="MINEUR Première demande (Finance à vérifier)">MINEUR Première demande (Finance à vérifier)</option>
                                        <option value="MINEUR Renouvellement (Finance à vérifier)">MINEUR Renouvellement (Finance à vérifier)</option>
                                        <option value="MINEUR Première demande (Exemption financière)">MINEUR Première demande (Exemption financière)</option>
                                        <option value="MINEUR Renouvellement (Exemption financière)">MINEUR Renouvellement (Exemption financière)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Numéro de dossier</label>
                                    <input name="fileNumber" value={formData.fileNumber} onChange={handleInputChange} placeholder="Ex: 1234567" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Date de naissance</label>
                                        <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} />
                                        <span className="input-hint">{analysis.isAdult ? 'Candidat Majeur' : 'Candidat Mineur'}</span>
                                    </div>
                                    <div className="form-group">
                                        <label>Type de Demande (Déduit)</label>
                                        <div className="info-box-styled" style={{ border: '2px solid #e2e8f0', background: '#f8fafc', padding: '0.8rem', borderRadius: '12px', fontWeight: 700, textAlign: 'center' }}>
                                            {formData.applicationType}
                                        </div>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Niveau d'études</label>
                                        <select name="studyLevel" value={formData.studyLevel} onChange={handleInputChange}>
                                            <option value="Professionnel">Professionnel</option>
                                            <option value="Collégial">Collégial</option>
                                            <option value="Universitaire">Universitaire</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Pays de résidence</label>
                                        <input name="country" value={formData.country} onChange={handleInputChange} placeholder="Ex: Sénégal..." />
                                    </div>
                                </div>
                            </section>

                            <section className="card form-card">
                                <div className="card-header">
                                    <ShieldAlert size={18} />
                                    <h2>Document de Voyage</h2>
                                </div>
                                <div className="form-group">
                                    <label>État du Passeport</label>
                                    <div className="segmented-control">
                                        <label className={`segment ${formData.passportStatus === 'valid' ? 'active' : ''}`}>
                                            <input type="radio" name="passportStatus" value="valid" checked={formData.passportStatus === 'valid'} onChange={handleInputChange} />
                                            Présent & Valide
                                        </label>
                                        <label className={`segment ${formData.passportStatus === 'expired' ? 'active' : ''}`}>
                                            <input type="radio" name="passportStatus" value="expired" checked={formData.passportStatus === 'expired'} onChange={handleInputChange} />
                                            Présent & Non conforme
                                        </label>
                                        <label className={`segment ${formData.passportStatus === 'absent' ? 'active' : ''}`}>
                                            <input type="radio" name="passportStatus" value="absent" checked={formData.passportStatus === 'absent'} onChange={handleInputChange} />
                                            Absent
                                        </label>
                                    </div>
                                </div>
                                {formData.passportStatus === 'valid' && (
                                    <div className="checklist-input fade-in" style={{ marginTop: '1rem' }}>
                                        <label className="checkbox-item">
                                            <input type="checkbox" name="passportSigned" checked={formData.passportSigned} onChange={handleInputChange} />
                                            <span>Passeport signé par le titulaire (Art. 13 RIQ)</span>
                                        </label>
                                    </div>
                                )}
                            </section>

                            <section className="card form-card">
                                <div className="card-header">
                                    <GraduationCap size={18} />
                                    <h2>Projet d'Études (DLI)</h2>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Début du programme</label>
                                        <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Fin du programme</label>
                                        <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} />
                                    </div>
                                </div>

                                {formData.applicationType === 'Renouvellement' && (
                                    <div className="sub-section fade-in">
                                        <h3>Dates du CAQ Précédent</h3>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Début CAQ précédent</label>
                                                <input type="date" name="prevCAQStart" value={formData.prevCAQStart} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Fin CAQ précédent</label>
                                                <input type="date" name="prevCAQEnd" value={formData.prevCAQEnd} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                        <div className="form-row" style={{ marginTop: '0.5rem' }}>
                                            <div className="form-group">
                                                <label>Début études précédentes</label>
                                                <input type="date" name="prevStudyStart" value={formData.prevStudyStart} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Fin études précédentes</label>
                                                <input type="date" name="prevStudyEnd" value={formData.prevStudyEnd} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                        <div className="form-row" style={{ marginTop: '0.5rem' }}>
                                            <div className="form-group">
                                                <label>Date de première entrée au pays</label>
                                                <input type="date" name="entryDate" value={formData.entryDate} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group">
                                                <label className="checkbox-item" style={{ justifyContent: 'flex-start', height: '100%', marginTop: '1.5rem' }}>
                                                    <input type="checkbox" name="isNewProgram" checked={formData.isNewProgram} onChange={handleInputChange} />
                                                    <span>Nouveau programme d'études ?</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="form-column">
                            <section className="card form-card">
                                <div className="card-header">
                                    <DollarSign size={18} />
                                    <h2>Capacité Financière</h2>
                                </div>

                                {formData.isConditional ? (
                                    <p className="info-box">Vérification financière non requise pour cette catégorie (Conditionnel).</p>
                                ) : (
                                    <>
                                        <div className="form-group">
                                            <label>Qui est le principal payeur ?</label>
                                            <div className="segmented-control">
                                                <label className={`segment ${formData.payerType === 'self' ? 'active' : ''}`}>
                                                    <input type="radio" name="payerType" value="self" checked={formData.payerType === 'self'} onChange={handleInputChange} />
                                                    Candidat lui-même
                                                </label>
                                                <label className={`segment ${formData.payerType === 'guarantor' ? 'active' : ''}`}>
                                                    <input type="radio" name="payerType" value="guarantor" checked={formData.payerType === 'guarantor'} onChange={handleInputChange} />
                                                    Un garant
                                                </label>
                                            </div>
                                        </div>

                                        {formData.payerType === 'guarantor' ? (
                                            <div className="checklist-input fade-in">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="supportForm" checked={formData.supportForm} onChange={handleInputChange} />
                                                    <span>Formulaire de déclaration de soutien financier</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="guarantorFinanceProof" checked={formData.guarantorFinanceProof} onChange={handleInputChange} />
                                                    <span>Preuve de capacité financière du Garant</span>
                                                </label>
                                            </div>
                                        ) : (
                                            <div className="checklist-input fade-in">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="selfFinanceProof" checked={formData.selfFinanceProof} onChange={handleInputChange} />
                                                    <span>Preuves récentes de capacité financière (Candidat)</span>
                                                    <span className="tooltip-trigger" data-tooltip="Relevés, placements, bourses, etc.">
                                                        <Info size={14} className="hint-icon" />
                                                    </span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="bankStatements6Months" checked={formData.bankStatements6Months} onChange={handleInputChange} />
                                                    <span className="text-accent-bold">Relevés bancaires (6 derniers mois)</span>
                                                    <span className="tooltip-trigger" data-tooltip="OBLIGATOIRE : Doit montrer l’historique des transactions, le solde et le nom du titulaire.">
                                                        <Info size={14} className="hint-icon" />
                                                    </span>
                                                </label>
                                            </div>
                                        )}

                                        <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                            <label>Précision du montant (Optionnel)</label>
                                            <div className="segmented-control">
                                                <label className={`segment ${formData.financeMode === 'calculate' ? 'active' : ''}`}>
                                                    <input type="radio" name="financeMode" value="calculate" checked={formData.financeMode === 'calculate'} onChange={handleInputChange} />
                                                    Calcul détaillé
                                                </label>
                                                <label className={`segment ${formData.financeMode === 'manual' ? 'active' : ''}`}>
                                                    <input type="radio" name="financeMode" value="manual" checked={formData.financeMode === 'manual'} onChange={handleInputChange} />
                                                    Validation simple
                                                </label>
                                            </div>
                                        </div>

                                        {formData.financeMode === 'calculate' && (
                                            <div className="form-group fade-in">
                                                <label>Fonds mobilisables ($ CAD)</label>
                                                <input type="number" name="availableFunds" value={formData.availableFunds} onChange={handleInputChange} />
                                            </div>
                                        )}

                                        <div className="checklist-input">
                                            <label className="checkbox-item">
                                                <input type="checkbox" name="financialProof" checked={formData.financialProof} onChange={handleInputChange} />
                                                <span>{formData.financeMode === 'calculate' ? 'Dossier financier complet' : 'Capacité financière confirmée'}</span>
                                            </label>
                                        </div>
                                    </>
                                )}
                            </section>

                            <section className="card form-card">
                                <div className="card-header">
                                    <ClipboardCheck size={18} />
                                    <h2>Pièces Justificatives</h2>
                                </div>
                                <div className="checklist-input">
                                    <label className="checkbox-item">
                                        <input type="checkbox" name="formDeclaration" checked={formData.formDeclaration} onChange={handleInputChange} />
                                        <span>Formulaires déclaration et engagement</span>
                                    </label>
                                    <label className="checkbox-item">
                                        <input type="checkbox" name="admissionLetter" checked={formData.admissionLetter} onChange={handleInputChange} />
                                        <span>Admission / Attestation fréquentation</span>
                                    </label>

                                    {formData.applicationType === 'Renouvellement' && (
                                        <div className="sub-section fade-in">
                                            <label className="checkbox-item">
                                                <input type="checkbox" name="transcripts" checked={formData.transcripts} onChange={handleInputChange} />
                                                <span>Relevés de notes officiels</span>
                                            </label>
                                            {!formData.transcripts && (
                                                <label className="checkbox-item ml-4">
                                                    <input type="checkbox" name="explanationsStudy" checked={formData.explanationsStudy} onChange={handleInputChange} />
                                                    <span>Lettre explicative (si relevés absents)</span>
                                                </label>
                                            )}
                                            {formData.explanationsStudy && (
                                                <label className="checkbox-item ml-4">
                                                    <input type="checkbox" name="fullTimeJustification" checked={formData.fullTimeJustification} onChange={handleInputChange} />
                                                    <span>Justification Études Temps Plein</span>
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="card form-card">
                                <div className="card-header">
                                    <ShieldAlert size={18} />
                                    <h2>Assurances Santé</h2>
                                </div>
                                {formData.studyLevel === 'Universitaire' ? (
                                    <p className="info-box">L'assurance est réputée incluse pour le niveau universitaire.</p>
                                ) : (
                                    <div className="insurance-sections" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {formData.applicationType === 'Renouvellement' && (
                                            <div className="insurance-manager">
                                                <div className="manager-header">
                                                    <h3>Périodes passées (Dernière année)</h3>
                                                    <button className="btn-small" onClick={() => addInsurance('past')}>+ Ajouter</button>
                                                </div>
                                                {formData.pastInsurances.map((ins, idx) => (
                                                    <div key={idx} className="insurance-row">
                                                        <input type="date" value={ins.start} onChange={(e) => updateInsurance('past', idx, 'start', e.target.value)} />
                                                        <span>au</span>
                                                        <input type="date" value={ins.end} onChange={(e) => updateInsurance('past', idx, 'end', e.target.value)} />
                                                        <button onClick={() => removeInsurance('past', idx)}>×</button>
                                                    </div>
                                                ))}
                                                {formData.pastInsurances.length === 0 && <p className="hint">Aucune période passée ajoutée.</p>}
                                            </div>
                                        )}

                                        <div className="insurance-manager">
                                            <div className="manager-header">
                                                <h3>Périodes futures (Prochaine année)</h3>
                                                <button className="btn-small" onClick={() => addInsurance('future')}>+ Ajouter</button>
                                            </div>
                                            {formData.futureInsurances.map((ins, idx) => (
                                                <div key={idx} className="insurance-row">
                                                    <input type="date" value={ins.start} onChange={(e) => updateInsurance('future', idx, 'start', e.target.value)} />
                                                    <span>au</span>
                                                    <input type="date" value={ins.end} onChange={(e) => updateInsurance('future', idx, 'end', e.target.value)} />
                                                    <button onClick={() => removeInsurance('future', idx)}>×</button>
                                                </div>
                                            ))}
                                            {formData.futureInsurances.length === 0 && <p className="hint">Aucune période future ajoutée.</p>}
                                        </div>
                                    </div>
                                )}
                            </section>

                            {!analysis.isAdult && (
                                <section className="card form-card fade-in">
                                    <div className="card-header">
                                        <Users size={18} />
                                        <h2>Documents pour Mineur</h2>
                                    </div>

                                    {/* Minor Situation Selector */}
                                    <div className="form-group">
                                        <label>Situation du Mineur</label>
                                        <select
                                            name="minorSituation"
                                            value={formData.minorSituation}
                                            onChange={handleInputChange}
                                            className="category-select"
                                        >
                                            <option value="both_parents">Situation A: Accompagné par les deux parents</option>
                                            <option value="one_parent">Situation B: Accompagné par un seul parent</option>
                                            <option value="unaccompanied">Situation C: Non accompagné</option>
                                            <option value="emancipated">Situation D: Émancipé (17 ans ou jugement)</option>
                                        </select>
                                    </div>

                                    {/* Common Documents (All Situations A, B, C) */}
                                    {formData.minorSituation !== 'emancipated' && (
                                        <div className="sub-section fade-in">
                                            <h3>Documents Communs (Toutes Situations)</h3>
                                            <div className="checklist-input">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="birthCertificate" checked={formData.birthCertificate} onChange={handleInputChange} />
                                                    <span>Certificat de naissance (avec noms parents)</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="parentsIdentity" checked={formData.parentsIdentity} onChange={handleInputChange} />
                                                    <span>Identité des deux parents (Passeport/CNI)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Situation A: Both Parents */}
                                    {formData.minorSituation === 'both_parents' && (
                                        <div className="sub-section fade-in">
                                            <h3>Situation A: Accompagné par les deux parents</h3>
                                            <p className="info-box" style={{ marginBottom: '1rem' }}>
                                                Enfant accompagné par ses deux parents. Preuve du séjour valide requis.
                                            </p>
                                            <div className="checklist-input">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="accompanyingParentsStatus" checked={formData.accompanyingParentsStatus} onChange={handleInputChange} />
                                                    <span>Durée du séjour des parents (Permis/Admission/Statut de résident)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Situation B: One Parent */}
                                    {formData.minorSituation === 'one_parent' && (
                                        <div className="sub-section fade-in">
                                            <h3>Situation B: Accompagné par un seul parent</h3>
                                            <p className="info-box" style={{ marginBottom: '1rem' }}>
                                                Enfant accompagné par un seul parent. Consentement du parent non-accompagnant requis.
                                            </p>
                                            <div className="checklist-input">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="nonAccompanyingParentIdentity" checked={formData.nonAccompanyingParentIdentity} onChange={handleInputChange} />
                                                    <span>Identité du parent non-accompagnant (Passeport/CNI)</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="consentDeclaration" checked={formData.consentDeclaration} onChange={handleInputChange} />
                                                    <span>Consentement écrit du parent non-accompagnant</span>
                                                </label>
                                                <div className="or-divider">OU</div>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="soleCustodyProof" checked={formData.soleCustodyProof} onChange={handleInputChange} />
                                                    <span>Preuve de garde exclusive</span>
                                                    <span className="tooltip-trigger" data-tooltip="REMPLACE le consentement si le candidat est sous la garde exclusive d'un seul parent.">
                                                        <Info size={14} className="hint-icon" />
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Situation C: Unaccompanied */}
                                    {formData.minorSituation === 'unaccompanied' && (
                                        <div className="sub-section fade-in">
                                            <h3>Situation C: Non accompagné</h3>
                                            <p className="info-box" style={{ marginBottom: '1rem' }}>
                                                Enfant non accompagné. Délégation parentale et supervision d'un adulte responsable au Québec requises.
                                            </p>
                                            <div className="checklist-input">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="parentalAuthorityDelegation" checked={formData.parentalAuthorityDelegation} onChange={handleInputChange} />
                                                    <span>Délégation formelle d'autorité parentale (chaque parent)</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="custodyDeclaration" checked={formData.custodyDeclaration} onChange={handleInputChange} />
                                                    <span>Déclaration de prise en charge par un adulte au Québec</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="responsibleAdultIdentity" checked={formData.responsibleAdultIdentity} onChange={handleInputChange} />
                                                    <span>Identité de l'adulte responsable (Passeport/CNI)</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="citizenshipProof" checked={formData.citizenshipProof} onChange={handleInputChange} />
                                                    <span>Statut du responsable (Citoyen canadien ou Résident permanent)</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="residenceProof" checked={formData.residenceProof} onChange={handleInputChange} />
                                                    <span>Preuve de résidence du responsable au Québec</span>
                                                </label>
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="criminalRecordCheck" checked={formData.criminalRecordCheck} onChange={handleInputChange} />
                                                    <span>Absence d'antécédents judiciaires (tous adultes du foyer)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Situation D: Emancipated */}
                                    {formData.minorSituation === 'emancipated' && (
                                        <div className="sub-section fade-in">
                                            <h3>Situation D: Émancipé ou 17 ans</h3>
                                            <p className="info-box" style={{ marginBottom: '1rem' }}>
                                                Mineur émancipé ou âgé de 17 ans. Règles applicables à un candidat majeur, avec jugement d'émancipation si applicable.
                                            </p>
                                            <div className="checklist-input">
                                                <label className="checkbox-item">
                                                    <input type="checkbox" name="emancipationJudgment" checked={formData.emancipationJudgment} onChange={handleInputChange} />
                                                    <span>Jugement d'émancipation (si applicable)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>

                        <div className="action-footer">
                            <button className="btn-primary large" onClick={() => { setReportSource('dossier'); setActiveTab('analysis'); }}>
                                Lancer l'Analyse du Dossier <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'chronology' ? (
                    <div className="tab-content fade-in">
                        <div className="chronology-layout">
                            <div className="column">
                                <TimelineBuilder events={timelineEvents} setEvents={setTimelineEvents} />
                            </div>
                            <div className="column sticky">
                                <section className="card res-card mode-header-pathway">
                                    <div className="card-header">
                                        <History size={18} />
                                        <h2>Aperçu de la Chronologie</h2>
                                    </div>
                                    <Timeline
                                        customEvents={timelineEvents}
                                    />
                                </section>
                            </div>
                        </div>
                        <div className="action-footer">
                            <button className="btn-primary large" onClick={() => { setReportSource('pathway'); setActiveTab('analysis'); }} style={{ background: 'var(--pathway-primary)' }}>
                                Générer le Rapport de Parcours <ShieldAlert size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="analysis-layout fade-in">
                        <div className="summary-banner" style={{ background: getRecommendationColor(analysis.recommendation) }}>
                            <div className="rec-info">
                                <span className="category-label">{analysis.category || 'Catégorie non spécifiée'}</span>
                                <div className="caq-period">
                                    CAQ du <strong>{analysis.caqStart ? format(analysis.caqStart, 'dd/MM/yyyy') : '??'}</strong> au <strong>{analysis.caqEnd ? format(analysis.caqEnd, 'dd/MM/yyyy') : '??'}</strong>
                                </div>
                            </div>
                            <div className="rec-text">
                                <span className="label">RECOMMANDATION ADMINISTRATIVE</span>
                                <h3>{analysis.recommendation}</h3>
                            </div>
                            <div className="rec-stats">
                                <div className="stat"><strong>{analysis.summary.blockingCount}</strong> Bloquants</div>
                                <div className="stat"><strong>{analysis.summary.majorCount}</strong> Majeurs</div>
                            </div>
                        </div>

                        <div className="analysis-grid">
                            {reportSource === 'dossier' ? (
                                <div className="column">
                                    <section className="card res-card mode-header-dossier">
                                        <h2 style={{ color: 'inherit' }}>Rapport d'Analyse Individuelle</h2>
                                        <Timeline
                                            startDate={formData.startDate}
                                            endDate={formData.endDate}
                                            caqStart={analysis.caqStart}
                                            caqEnd={analysis.caqEnd}
                                            entryDate={formData.entryDate}
                                            isNewProgram={formData.isNewProgram}
                                        />
                                        {analysis.caqStart && (
                                            <div className="date-hints">
                                                <div className="hint">Prévoyance Installation : <strong>{format(analysis.caqStart, 'dd/MM/yyyy')}</strong></div>
                                                <div className="hint">Marge Post-Études : <strong>{format(analysis.caqEnd, 'dd/MM/yyyy')}</strong></div>
                                            </div>
                                        )}
                                    </section>

                                    <section className="card res-card">
                                        <h2>Résumé du Dossier</h2>
                                        <div className="summary-list">
                                            <div className="summary-item"><span>Dossier N°:</span> <strong>{formData.fileNumber || 'cxxx'}</strong></div>
                                            <div className="summary-item"><span>Profil:</span> <strong>{analysis.summary.profile}</strong></div>
                                            <div className="summary-item"><span>Niveau:</span> <strong>{analysis.summary.level}</strong></div>
                                            <div className="summary-item"><span>Demande:</span> <strong>{analysis.summary.type}</strong></div>
                                            <div className="summary-item"><span>Passeport:</span> <strong>{analysis.summary.passport}</strong></div>
                                        </div>
                                    </section>
                                </div>
                            ) : (
                                <div className="column" style={{ gridColumn: '1 / -1' }}>
                                    <section className="card res-card mode-header-pathway">
                                        <h2 style={{ color: 'inherit' }}>Rapport de Reconstitution Chronologique (Parcours)</h2>
                                        <Timeline
                                            customEvents={timelineEvents}
                                        />
                                        <p className="hint">Étude indépendante du parcours et des délais.</p>
                                    </section>
                                </div>
                            )}

                            {reportSource === 'dossier' && (
                                <div className="column">
                                    <section className="card res-card">
                                        <h2>Checklist des Manquements</h2>
                                        <Checklist controls={analysis.controls} />
                                    </section>
                                </div>
                            )}
                        </div>

                        <div className="analysis-actions no-print">
                            <button className="btn-secondary" onClick={() => setActiveTab('input')}>
                                Modifier les données
                            </button>
                            <button className="btn-primary" onClick={() => window.print()}>
                                <ClipboardCheck size={18} /> Générer Rapport PDF
                            </button>
                        </div>
                    </div>
                )
                }
            </main >

            <footer className="no-print">
                <div className="container footer-content">
                    <div className="footer-sources">
                        <h4>Sources Officielles :</h4>
                        <div className="source-links">
                            <a href="https://www.legisquebec.gouv.qc.ca/fr/document/lc/i-0.2.1" target="_blank" rel="noopener noreferrer">LIQ (Loi sur l'immigration au Québec)</a>
                            <a href="https://www.legisquebec.gouv.qc.ca/fr/document/rc/I-0.2.1,%20r.%203" target="_blank" rel="noopener noreferrer">RIQ (Règlement sur l'immigration au Québec)</a>
                            <a href="https://www.quebec.ca/education/etudier-quebec" target="_blank" rel="noopener noreferrer">Étudier au Québec (Quebec.ca)</a>
                            <a href="https://www.quebec.ca/education/etudier-quebec/documents" target="_blank" rel="noopener noreferrer">Documents requis (Quebec.ca)</a>
                        </div>
                    </div>
                    <div className="footer-disclaimer">
                        <AlertTriangle size={14} />
                        <p><strong>Aide à la décision :</strong> Cet outil est une simulation basée sur les règles publiques. Il ne remplace pas les conseils d'un professionnel agréé et n'a aucune valeur juridique officielle.</p>
                    </div>
                    <div className="footer-copyright">
                        <p>&copy; {new Date().getFullYear()} <a href="https://www.cvquebec.ca" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>www.cvquebec.ca</a> - Tous droits réservés.</p>
                    </div>
                </div>
            </footer>

            <style>{`
        .mode-header-dossier .card-header { color: var(--primary); border-bottom-color: var(--accent); }
        .mode-header-pathway .card-header { color: var(--pathway-primary); border-bottom-color: #e9d8fd; }
        .analysis-actions { display: flex; gap: 1rem; margin-top: 2rem; }
        .logo-box { background: var(--primary); padding: 0.5rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .version { font-size: 0.6rem; background: var(--accent); color: var(--primary); padding: 0.1rem 0.4rem; border-radius: 4px; vertical-align: middle; margin-left: 0.5rem; }
        :root {
            --pathway-primary: #6b46c1; /* Deep Purple */
            --pathway-secondary: #faf5ff;
        }
        .nav-item { border-bottom: 3px solid transparent; border-radius: 0; padding: 1rem 1.5rem; height: 100%; display: flex; align-items: center; color: var(--text); background: transparent; transition: all 0.2s; font-weight: 600; }
        .nav-item.active.mode-dossier { border-bottom-color: var(--primary); color: var(--primary); background: #f0f7ff; }
        .nav-item.active.mode-pathway { border-bottom-color: var(--pathway-primary); color: var(--pathway-primary); background: var(--pathway-secondary); }
        .nav-item.active.mode-report { border-bottom-color: #2d3748; color: #2d3748; background: #f7fafc; }
        .nav-item:hover:not(.active) { background: rgba(0,0,0,0.03); }
        
        .input-layout, .analysis-grid, .chronology-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .form-column { display: flex; flex-direction: column; gap: 1.5rem; }
        .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; color: var(--primary); border-bottom: 1px solid var(--accent); padding-bottom: 0.5rem; }
        .card-header h2 { margin: 0; font-size: 1.1rem; }
        
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .checklist-input { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem 0; }
        .checkbox-item { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.75rem; border-radius: 10px; transition: all 0.2s; border: 1px solid transparent; }
        .checkbox-item:hover { background: var(--secondary); border-color: var(--border); }
        .checkbox-item input { width: 1.25rem; height: 1.25rem; cursor: pointer; border-radius: 4px; border: 2px solid var(--border); }
        
        .btn-primary.large { width: 100%; display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1.25rem; font-size: 1.1rem; border-radius: 14px; box-shadow: var(--shadow-sm); }
        .action-footer { margin-top: 2rem; }

        .summary-banner { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; padding: 2.5rem; border-radius: 20px; color: white; margin-bottom: 2.5rem; box-shadow: var(--shadow-lg); transition: transform 0.3s; }
        .rec-info { display: flex; flex-direction: column; gap: 0.5rem; }
        .category-label { font-size: 1.25rem; font-weight: 800; background: rgba(255,255,255,0.15); padding: 0.4rem 1rem; border-radius: 8px; width: fit-content; border: 1px solid rgba(255,255,255,0.2); }
        .caq-period { font-size: 1rem; opacity: 0.9; font-weight: 500; }
        .rec-text { text-align: center; }
        .rec-text .label { font-size: 0.75rem; opacity: 0.8; letter-spacing: 2px; font-weight: 700; }
        .rec-text h3 { color: white; margin: 0; font-size: 2.2rem; font-weight: 800; }
        .rec-stats { display: flex; gap: 1.5rem; }
        .stat { font-size: 0.9rem; background: rgba(255,255,255,0.2); padding: 1rem 1.5rem; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 100px; border: 1px solid rgba(255,255,255,0.1); }
        .stat strong { font-size: 1.5rem; }

        .summary-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .summary-item { display: flex; justify-content: space-between; font-size: 0.95rem; padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border); }
        .summary-item span { color: var(--text-muted); font-weight: 500; }
        
        .date-hints { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; border-top: 2px solid var(--secondary); padding-top: 1.5rem; }
        .hint { font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; }
        .hint strong { color: var(--primary); }
        
        .segmented-control { display: flex; background: #f1f5f9; padding: 0.35rem; border-radius: 12px; gap: 0.35rem; }
        .segment { flex: 1; text-align: center; padding: 0.6rem; border-radius: 9px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; font-weight: 600; color: var(--text-muted); }
        .segment input { display: none; }
        .segment.active { background: white; color: var(--primary); box-shadow: var(--shadow-sm); border-color: var(--border); }
        .segment:hover:not(.active) { background: rgba(0,0,0,0.03); color: var(--text); }

        .fade-in { animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .sub-section { display: flex; flex-direction: column; gap: 0.75rem; border-left: 3px solid var(--primary); padding-left: 1.5rem; margin: 1.5rem 0; background: var(--secondary); padding: 1.5rem; border-radius: 0 16px 16px 0; }
        .info-box { background: var(--secondary); padding: 1.25rem; border-radius: 12px; color: var(--primary); font-size: 0.95rem; border: 1px solid var(--border); font-weight: 500; line-height: 1.6; }
        
        .insurance-manager { background: white; border-radius: 14px; border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow-sm); }
        .manager-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border); }
        .manager-header h3 { margin: 0; font-size: 1rem; color: var(--text); font-weight: 700; }
        .insurance-row { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid #f1f5f9; animation: slideDown 0.3s ease-out; }
        .insurance-row:last-child { border-bottom: none; }
        .insurance-row input { flex: 1; padding: 0.6rem; font-size: 0.9rem; border: 1px solid var(--border); border-radius: 8px; }
        .insurance-row span { color: var(--text-muted); font-size: 0.85rem; font-weight: 500; }
        .insurance-row button { background: none; border: none; color: #e53e3e; cursor: pointer; padding: 0.4rem; font-size: 1.4rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .insurance-row button:hover { background: #fff5f5; }
        
        .btn-small { background: var(--primary); color: white; border: none; padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600; }
        .category-select { width: 100%; padding: 0.85rem; border-radius: 12px; border: 2px solid var(--primary); background: #f0f7ff; font-weight: 800; color: var(--primary); margin-bottom: 1rem; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
        .category-select:hover { background: #e0eeff; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
        .tooltip-trigger {
            position: relative;
            cursor: help;
            display: inline-flex;
            align-items: center;
            margin-left: 6px;
            vertical-align: middle;
        }
        .tooltip-trigger:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 140%;
            left: 50%;
            transform: translateX(-50%);
            background: #2d3748;
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.75rem;
            width: 220px;
            z-index: 1000;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
            line-height: 1.4;
            text-align: center;
            pointer-events: none;
            font-weight: 500;
            animation: fadeInTooltip 0.2s ease-out;
        }
        .tooltip-trigger:hover::before {
            content: '';
            position: absolute;
            bottom: 120%;
            left: 50%;
            transform: translateX(-50%);
            border: 6px solid transparent;
            border-top-color: #2d3748;
            z-index: 1000;
            pointer-events: none;
            animation: fadeInTooltip 0.2s ease-out;
        }
        @keyframes fadeInTooltip {
            from { opacity: 0; transform: translate(-50%, 5px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }

        footer {
            margin-top: 4rem;
            padding: 3rem 0;
            background: #f8fafc;
            border-top: 1px solid var(--border);
        }
        .footer-content {
            display: flex;
            flex-direction: column;
            gap: 2rem;
            align-items: center;
            max-width: 800px;
            margin: 0 auto;
        }
        .footer-sources {
            text-align: center;
        }
        .footer-sources h4 {
            margin-bottom: 1rem;
            color: var(--text-muted);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .source-links {
            display: flex;
            gap: 1.5rem;
            flex-wrap: wrap;
            justify-content: center;
        }
        .source-links a {
            color: var(--primary);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 600;
            padding: 0.5rem 1rem;
            background: white;
            border: 1px solid var(--accent);
            border-radius: 8px;
            transition: all 0.2s;
        }
        .source-links a:hover {
            background: var(--accent);
            transform: translateY(-2px);
        }
        .footer-disclaimer {
            display: flex;
            gap: 0.75rem;
            background: #fff5f5;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            border: 1px solid #feb2b2;
            max-width: 600px;
            color: #c53030;
            align-items: flex-start;
        }
        .footer-disclaimer p {
            margin: 0;
            font-size: 0.85rem;
            line-height: 1.5;
        }
        .footer-copyright {
            color: var(--text-muted);
            font-size: 0.8rem;
            font-weight: 500;
        }
        
        .brand-text { display: flex; flex-direction: column; gap: 0.1rem; }
        .by-brand { font-size: 0.75rem; color: var(--text-muted); letter-spacing: 0.5px; margin-top: -2px; }
        .by-brand strong { color: var(--primary); font-weight: 800; }
        
        @media (max-width: 900px) {
          .input-layout, .analysis-grid { grid-template-columns: 1fr; }
        }

        @media print {
          .no-print, header, nav, .action-footer, .nav-tabs, .btn-secondary, .btn-primary, .btn-small { display: none !important; }
          .app-container { padding: 0 !important; margin: 0 !important; box-shadow: none !important; width: 100% !important; background: white !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .card { border: 1px solid #eee !important; box-shadow: none !important; break-inside: avoid; margin-bottom: 2rem !important; }
          .summary-banner { border-radius: 0 !important; box-shadow: none !important; border: 2px solid #ccc !important; color: black !important; padding: 1.5rem !important; margin-bottom: 2rem !important; }
          .summary-banner h3, .summary-banner strong, .summary-banner span { color: black !important; }
          .stat { border: 1px solid #eee !important; background: none !important; color: black !important; }
          .analysis-grid { display: block !important; }
          .column { width: 100% !important; margin-bottom: 2rem !important; }
          body { background: white !important; font-size: 10pt !important; }
          .timeline-widget { min-width: 100% !important; overflow: visible !important; }
          .timeline-track { border: 1px solid #ddd !important; }
          .side-label { background: white !important; border: 1px solid #ccc !important; }
          h2, h3 { color: #2c3e50 !important; }
          .category-label { border: 1px solid #ccc !important; background: #f8fafc !important; }
          
          /* Force color printing */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          .app-container::before {
            content: "RAPPORT D'ANALYSE DÉCISIONNELLE - CAQ QUEBEC";
            display: block;
            text-align: center;
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 2rem;
            border-bottom: 3px solid var(--primary);
            padding-bottom: 1rem;
            color: #1a365d;
          }
        }
      `}</style>
        </div >
    )
}

export default App
