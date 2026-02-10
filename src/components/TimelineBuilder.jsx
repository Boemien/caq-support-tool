import React, { useState } from 'react';
import { Plus, Trash2, Clock, Scale, History, GraduationCap } from 'lucide-react';

const EVENT_TYPES = [
    // ACTES ADMINISTRATIFS & DÉCISIONS
    { value: 'CAQ_REFUSAL', label: '⛔ Refus de CAQ', ref: 'Art. 11/13 RIQ', category: 'ADM' },
    { value: 'INTENT_REFUSAL', label: '⚠️ Intention de Refus', ref: 'GPI 3.2', category: 'ADM' },
    { value: 'INTERVIEW', label: '🗣️ Convocation Entrevue', ref: '', category: 'ADM' },

    // PARCOURS & VIE DU CANDIDAT
    { value: 'CAQ', label: '📜 Certificat (CAQ)', ref: 'Art. 13 RIQ', category: 'USR' },
    { value: 'WORK_PERMIT', label: '🪪 Permis de Travail/Études', ref: '', category: 'USR' },
    { value: 'DOCS_SENT', label: '📤 Envoi de Documents', ref: '', category: 'USR' },
    { value: 'STUDIES', label: '🎓 Études (Programme)', ref: 'Art. 11 RIQ', category: 'USR' },
    { value: 'INSURANCE', label: '🏥 Assurance Maladie', ref: 'Art. 15 RIQ', category: 'USR' },
    { value: 'ENTRY', label: '🛬 Entrée au pays', ref: 'Art. 13 RIQ', category: 'USR' },
    { value: 'EXIT', label: '🛫 Sortie du territoire', ref: '', category: 'USR' },
    { value: 'MEDICAL', label: '💊 Maladie / Congé Médical', ref: '', category: 'USR' },
    { value: 'OTHER', label: '📅 Autre Événement', ref: '', category: 'USR' },
];

const TimelineBuilder = ({ events, setEvents }) => {
    const [newEvent, setNewEvent] = useState({
        type: 'CAQ',
        start: '',
        end: '',
        label: '',
        note: '',
        linkedProgram: '',
        isOutsideCanada: false,
        submissionDate: '',
    });

    const addEvent = () => {
        if (!newEvent.start && !newEvent.submissionDate) return;
        const typeInfo = EVENT_TYPES.find(t => t.value === newEvent.type);
        setEvents([...events, {
            ...newEvent,
            id: Date.now(),
            legalRef: typeInfo.ref,
            category: typeInfo.category // Save category for later use
        }]);
        setNewEvent({ type: 'CAQ', start: '', end: '', label: '', note: '', linkedProgram: '', isOutsideCanada: false, submissionDate: '' });
    };

    const removeEvent = (id) => {
        setEvents(events.filter(e => e.id !== id));
    };

    return (
        <div className="timeline-builder">
            <section className="card form-card">
                <div className="card-header">
                    <Clock size={18} />
                    <h2>Nouvel Événement Chronologique</h2>
                </div>
                <div className="builder-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Type d'événement</label>
                            <select
                                value={newEvent.type}
                                onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                            >
                                <optgroup label="--- ACTES ADMINISTRATIFS & DÉCISIONS ---">
                                    {EVENT_TYPES.filter(t => t.category === 'ADM').map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </optgroup>
                                <optgroup label="--- PARCOURS & VIE DU CANDIDAT ---">
                                    {EVENT_TYPES.filter(t => t.category === 'USR').map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Libellé / Description</label>
                            <input
                                type="text"
                                placeholder="ex: CAQ Session Automne"
                                value={newEvent.label || ''}
                                onChange={(e) => setNewEvent({ ...newEvent, label: e.target.value })}
                            />
                        </div>
                    </div>
                    {!['CAQ_REFUSAL', 'INTENT_REFUSAL', 'DOCS_SENT', 'INTERVIEW', 'ENTRY', 'EXIT'].includes(newEvent.type) && (
                        <div className="form-row">
                            <div className="form-group">
                                <label>Date Début / Réponse</label>
                                <input
                                    type="date"
                                    value={newEvent.start || ''}
                                    onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Date Fin</label>
                                <input
                                    type="date"
                                    value={newEvent.end || ''}
                                    onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                    {['CAQ', 'WORK_PERMIT', 'CAQ_REFUSAL', 'INTENT_REFUSAL', 'DOCS_SENT', 'INTERVIEW'].includes(newEvent.type) && (
                        <div className="form-group fade-in highlight-group">
                            <label>
                                {newEvent.type === 'CAQ' || newEvent.type === 'WORK_PERMIT' ? 'Date de Dépôt (Demande)' : 'Date de l\'événement / Envoi'}
                            </label>
                            <input
                                type="date"
                                value={newEvent.submissionDate || ''}
                                onChange={(e) => setNewEvent({ ...newEvent, submissionDate: e.target.value })}
                            />
                            <span className="input-hint info">
                                {['CAQ', 'WORK_PERMIT'].includes(newEvent.type)
                                    ? '💡 Remplissez UNIQUEMENT ceci s\'il s\'agit d\'une demande en attente.'
                                    : 'Date unique de cet acte administratif.'}
                            </span>
                        </div>
                    )}
                    {['ENTRY', 'EXIT'].includes(newEvent.type) && (
                        <div className="form-group fade-in">
                            <label>
                                {newEvent.type === 'ENTRY' ? "Date d'arrivée au Canada" : "Date de départ du Canada"}
                            </label>
                            <input
                                type="date"
                                value={newEvent.start || ''}
                                onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                            />
                            <span className="input-hint">
                                Date unique du mouvement migratoire (tampon passeport).
                            </span>
                        </div>
                    )}
                    {['CAQ', 'STUDIES'].includes(newEvent.type) && (
                        <div className="form-group fade-in">
                            <label>Détails Spécifiques au Programme</label>
                            <div className="form-row">
                                <input
                                    type="text"
                                    placeholder="Programme d'études (ex: AEC, DEP...)"
                                    value={newEvent.linkedProgram}
                                    onChange={(e) => setNewEvent({ ...newEvent, linkedProgram: e.target.value })}
                                />
                                {newEvent.type === 'CAQ' && (
                                    <label className="checkbox-item mini">
                                        <input
                                            type="checkbox"
                                            checked={newEvent.isOutsideCanada}
                                            onChange={(e) => setNewEvent({ ...newEvent, isOutsideCanada: e.target.checked })}
                                        />
                                        <span>Demande Hors Canada</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="form-group">
                        <label>Notes / Observations</label>
                        <textarea
                            rows="2"
                            placeholder="Observations sur cet événement..."
                            value={newEvent.note}
                            onChange={(e) => setNewEvent({ ...newEvent, note: e.target.value })}
                        ></textarea>
                    </div>
                    <button className="btn-primary btn-pathway" onClick={addEvent}>
                        <Plus size={16} /> Ajouter à la chronologie du parcours
                    </button>
                </div>
            </section>

            <section className="card form-card">
                <div className="card-header">
                    <History size={18} />
                    <h2>Événements Enregistrés</h2>
                </div>
                <div className="events-list">
                    {events.length === 0 ? (
                        <p className="empty-msg">Aucun événement dans la chronologie.</p>
                    ) : (
                        events.map(event => (
                            <div key={event.id} className={`event-card ${event.type.toLowerCase()}`}>
                                <div className="event-info">
                                    <div className="event-main">
                                        <strong>{EVENT_TYPES.find(t => t.value === event.type)?.label}</strong>
                                        {event.label && <span className="event-desc"> - {event.label}</span>}
                                        {event.legalRef && <span className="legal-badge"><Scale size={10} /> {event.legalRef}</span>}
                                        {event.category === 'ADM' && <span className="category-badge adm">ADMINISTRATIF</span>}
                                        {event.category === 'USR' && <span className="category-badge usr">CANDIDAT</span>}
                                    </div>
                                    <div className="event-dates">
                                        {event.submissionDate && <span className="sub-date">Demande : {event.submissionDate} ➜ </span>}
                                        {event.start} {event.end ? ` au ${event.end}` : ''}
                                    </div>
                                    {event.linkedProgram && (
                                        <div className="linked-info">
                                            <GraduationCap size={12} /> Destiné au programme : <strong>{event.linkedProgram}</strong>
                                            {event.isOutsideCanada && <span className="outside-tag ml-4">📍 Hors Canada</span>}
                                        </div>
                                    )}
                                    {event.type === 'CAQ' && event.isOutsideCanada && !event.linkedProgram && (
                                        <div className="linked-info">
                                            <span className="outside-tag">📍 Demande effectuée Hors Canada</span>
                                        </div>
                                    )}
                                    {event.note && <p className="event-note">{event.note}</p>}
                                </div>
                                <button className="btn-icon delete" onClick={() => removeEvent(event.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <style>{`
                .builder-form { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0; }
                .events-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
                .event-card { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding: 1rem; 
                    background: white; 
                    border-radius: 12px; 
                    border: 1px solid #eee;
                    border-left: 5px solid #ccc;
                }
                .btn-pathway { background: var(--pathway-primary); }
                .btn-pathway:hover { background: #553c9a; }
                .event-card.caq { border-left-color: var(--pathway-primary); }
                .event-card.studies { border-left-color: #3498db; }
                .event-card.caq_refusal { border-left-color: #e53e3e; background: #fff5f5; }
                .event-card.insurance { border-left-color: #2ecc71; }
                .event-card.work_permit { border-left-color: #9b59b6; background: #faf5ff; }
                .event-card.travel { border-left-color: #718096; background: #f8fafc; border-style: dashed; }
                .event-card.entry { border-left-color: #e67e22; background: #fffcf5; }
                .event-card.intent_refusal { border-left-color: #e74c3c; background: #fff5f5; }
                
                .event-main { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
                .event-desc { font-size: 0.9rem; color: #666; }
                .event-dates { font-size: 0.8rem; color: #888; margin-top: 0.25rem; font-family: monospace; }
                .sub-date { color: var(--pathway-primary); font-weight: 700; font-size: 0.75rem; }
                .event-note { font-size: 0.85rem; color: #444; margin-top: 0.5rem; font-style: italic; background: rgba(0,0,0,0.02); padding: 0.5rem; border-radius: 4px; }
                
                .linked-info { 
                    margin-top: 0.5rem; 
                    font-size: 0.75rem; 
                    color: var(--pathway-primary); 
                    display: flex; 
                    align-items: center; 
                    gap: 6px; 
                    background: var(--pathway-secondary); 
                    padding: 4px 8px; 
                    border-radius: 6px; 
                }
                .outside-tag {
                    color: #d97706;
                    font-weight: 700;
                    font-size: 0.7rem;
                }
                .checkbox-item.mini {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #f8fafc;
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                .checkbox-item.mini input {
                    width: 1rem;
                    height: 1rem;
                }

                .legal-badge { 
                    font-size: 0.65rem; 
                    background: #f0f0f0; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    color: #666; 
                    display: flex; 
                    align-items: center; 
                    gap: 3px; 
                }
                
                .delete { color: #e74c3c; opacity: 0.6; transition: opacity 0.2s; }
                .delete:hover { opacity: 1; }
                .empty-msg { text-align: center; color: #999; padding: 2rem; font-style: italic; }

                .category-badge {
                    font-size: 0.6rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    margin-left: 6px;
                }
                .category-badge.adm {
                    background: #fed7d7;
                    color: #c53030;
                    border: 1px solid #feb2b2;
                }
                .category-badge.usr {
                    background: #c6f6d5;
                    color: #2f855a;
                    border: 1px solid #9ae6b4;
                }
            `}</style>
        </div>
    );
};

export default TimelineBuilder;
