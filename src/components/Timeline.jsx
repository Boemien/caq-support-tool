import React from 'react';
import { format, differenceInDays, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GraduationCap } from 'lucide-react';

const Timeline = ({ startDate, endDate, caqStart, caqEnd, entryDate, isNewProgram, customEvents = [] }) => {
    // Calculer la plage globale
    // Priorise les paramètres explicites (startDate/endDate), sinon utilise tous les événements disponibles
    let minDate, maxDate;

    if (startDate && endDate) {
        // Use explicitly provided dates
        minDate = new Date(startDate);
        maxDate = new Date(endDate);
    } else {
        // Collect all available dates from all sources (explicit dates + custom events)
        const allDates = [
            startDate, endDate, caqStart, caqEnd, entryDate,
            ...customEvents.map(e => e.start),
            ...customEvents.map(e => e.end).filter(Boolean),
            ...customEvents.map(e => e.submissionDate).filter(Boolean)
        ]
            .filter(Boolean)
            .map(d => new Date(d));

        if (allDates.length > 0) {
            // Find the min and max dates, then add 1-month buffer on each side
            const minTime = Math.min(...allDates.map(d => d.getTime()));
            const maxTime = Math.max(...allDates.map(d => d.getTime()));
            
            minDate = subMonths(startOfMonth(new Date(minTime)), 1);
            maxDate = addMonths(endOfMonth(new Date(maxTime)), 1);
        } else {
            // Fallback: no dates provided, use current month ± 6 months
            minDate = startOfMonth(new Date());
            maxDate = addMonths(minDate, 12);
        }
    }

    const totalDays = Math.max(1, differenceInDays(maxDate, minDate));

    const getOffset = (date) => (differenceInDays(new Date(date), minDate) / totalDays) * 100;
    const getWidth = (s, e) => (differenceInDays(new Date(e), new Date(s)) / totalDays) * 100;

    return (
        <div className="timeline-widget">
            <div className="timeline-header">
                <div className="timeline-labels">
                    <span className="date-label">{format(minDate, 'dd MMM yyyy', { locale: fr })}</span>
                    <span className="date-label">{format(maxDate, 'dd MMM yyyy', { locale: fr })}</span>
                </div>
                {isNewProgram && <span className="program-badge">Nouveau Programme</span>}
            </div>

            <div className="timeline-main">
                {/* Couche de base (CAQ / Études par défaut) */}
                <div className="timeline-track base-track">
                    {caqStart && caqEnd && (
                        <div className="timeline-bar caq-bar" style={{ left: `${getOffset(caqStart)}%`, width: `${getWidth(caqStart, caqEnd)}%` }}>
                            <span className="bar-label">CAQ</span>
                        </div>
                    )}
                    {startDate && endDate && (
                        <div className="timeline-bar study-bar" style={{ left: `${getOffset(startDate)}%`, width: `${getWidth(startDate, endDate)}%` }}>
                            <span className="bar-label">Études</span>
                        </div>
                    )}
                    {entryDate && (
                        <div className="timeline-marker entry-marker" style={{ left: `${getOffset(entryDate)}%` }}>
                            <div className="marker-pin"></div>
                            <span className="marker-label">Entrée</span>
                        </div>
                    )}
                </div>

                {/* Couches personnalisées */}
                {customEvents.length > 0 && (
                    <div className="custom-events-tracks">
                        {customEvents.map((event, idx) => {
                            const hasDecision = !!event.start;
                            const anchorDate = event.start || event.submissionDate;
                            const isMarkerOnly = !event.end || ['ENTRY', 'CAQ_REFUSAL', 'INTENT_REFUSAL', 'INTERVIEW', 'DOCS_SENT', 'TRAVEL'].includes(event.type) || !hasDecision;

                            return (
                                <div key={event.id} className="timeline-track custom-track">
                                    {event.submissionDate && (
                                        <>
                                            <div className="submission-line" style={{
                                                left: `${getOffset(event.submissionDate)}%`,
                                                width: `${getOffset(anchorDate) - getOffset(event.submissionDate)}%`
                                            }}></div>
                                            <div className="submission-dot" style={{ left: `${getOffset(event.submissionDate)}%` }}></div>
                                        </>
                                    )}
                                    {!isMarkerOnly ? (
                                        <div
                                            className={`timeline-bar custom-bar ${event.type.toLowerCase()}`}
                                            style={{ left: `${getOffset(event.start)}%`, width: `${getWidth(event.start, event.end)}%` }}
                                        >
                                            <div className="bar-content">
                                                <span className="bar-label">{event.label || event.type}</span>
                                                {event.linkedProgram && <span className="linked-tag"><GraduationCap size={10} /> {event.linkedProgram}</span>}
                                                {event.isOutsideCanada && <span className="linked-tag" style={{ color: '#ed8936' }}>📍 Hors Canada</span>}
                                            </div>
                                            {event.legalRef && <span className="legal-tag-mini">{event.legalRef}</span>}
                                        </div>
                                    ) : (
                                        <div className={`timeline-marker custom-marker ${event.type.toLowerCase()} ${!hasDecision ? 'pending' : ''}`} style={{ left: `${getOffset(anchorDate)}%` }}>
                                            <div className="marker-pin"></div>
                                            {(() => {
                                                const offset = getOffset(anchorDate);
                                                let alignmentStyles = {
                                                    left: offset < 50 ? 'calc(100% + 12px)' : 'auto',
                                                    right: offset >= 50 ? 'calc(100% + 12px)' : 'auto',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)'
                                                };

                                                return (
                                                    <span
                                                        className="marker-label side-label"
                                                        style={alignmentStyles}
                                                    >
                                                        {!hasDecision && <span className="pending-tag">Demande de </span>}
                                                        {event.label || (
                                                            event.type === 'ENTRY' ? 'Entrée au pays' :
                                                                event.type === 'CAQ_REFUSAL' ? 'Refus CAQ' :
                                                                    event.type === 'CAQ' && hasDecision ? 'CAQ Octroyé' :
                                                                        event.type
                                                        )}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="timeline-legend">
                <div className="legend-item"><span className="dot caq"></span> CAQ</div>
                <div className="legend-item"><span className="dot study"></span> Études</div>
                <div className="legend-item"><span className="dot entry"></span> Entrée au pays</div>
                <div className="legend-item"><span className="dot travel"></span> Sortie / Retour</div>
                <div className="legend-item"><span className="dot pending"></span> En attente</div>
                <div className="legend-item"><span className="dot intent"></span> Alerte / Refus</div>
            </div>

            <style>{`
                .timeline-widget { padding: 1.5rem 0; width: 100%; overflow-x: auto; margin-top: 1rem; }
                .timeline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
                .timeline-labels { display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-muted); flex-grow: 1; justify-content: space-between; font-family: 'Outfit', monospace; font-weight: 600; }
                .program-badge { background: #e67e22; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                
                .timeline-main { display: flex; flex-direction: column; gap: 12px; }
                .timeline-track { height: 36px; background: #f1f5f9; border-radius: 8px; position: relative; overflow: visible; border: 1px solid var(--border); }
                .base-track { height: 44px; background: #e2e8f0; border-width: 2px; }
                
                .timeline-bar { position: absolute; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 6px; overflow: hidden; white-space: nowrap; padding: 0 8px; box-shadow: var(--shadow-sm); z-index: 2; }
                .caq-bar { background: var(--primary); color: white; }
                .study-bar { background: #3182ce; color: white; }
                
                .custom-bar { color: white; }
                .custom-bar.caq { background: var(--primary); }
                .custom-bar.caq_refusal { background: #e53e3e; }
                .custom-bar.studies { background: #3182ce; }
                .custom-bar.insurance { background: #38a169; }
                .custom-bar.work_permit { background: #805ad5; }
                .custom-bar.intent_refusal { background: #e53e3e; }
                .custom-bar.docs_sent { background: #d6bcfa; color: #553c9a; }
                .custom-bar.interview { background: #ecc94b; color: #1a202c; }
                .custom-bar.travel { background: #f8fafc; color: #4a5568; border: 2px dashed #cbd5e0; box-shadow: none; }
                .custom-bar.other { background: #718096; }

                .submission-line { position: absolute; height: 1px; background: var(--primary); opacity: 0.3; top: 50%; transform: translateY(-50%); pointer-events: none; border-top: 1px dashed var(--primary); }
                .submission-dot { position: absolute; width: 6px; height: 6px; background: white; border: 2px solid var(--primary); border-radius: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 4; }

                .bar-content { display: flex; flex-direction: column; align-items: center; line-height: 1.2; width: 100%; overflow: hidden; }
                .bar-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }
                .linked-tag { font-size: 0.55rem; opacity: 0.9; display: flex; align-items: center; gap: 3px; font-weight: 500; margin-top: 1px; }

                .timeline-marker { position: absolute; top: 0; height: 100%; width: 2px; background: #718096; z-index: 5; }
                .marker-pin { width: 10px; height: 10px; background: inherit; border-radius: 50%; margin-left: -4px; margin-top: 13px; border: 2px solid white; box-shadow: var(--shadow-sm); }
                
                .custom-marker.caq_refusal { background: #e53e3e; }
                .custom-marker.intent_refusal { background: #e53e3e; }
                .custom-marker.entry { background: #ed8936; }
                .custom-marker.travel { background: #718096; border-style: dashed; }
                .custom-marker.work_permit { background: #805ad5; }
                .custom-marker.docs_sent { background: #d6bcfa; }
                .custom-marker.pending { background: #94a3b8; }
                
                .marker-label { position: absolute; font-size: 0.65rem; font-weight: 800; color: #1e293b; white-space: nowrap; background: white; padding: 2px 8px; border-radius: 8px; box-shadow: var(--shadow-sm); border: 1px solid var(--border); z-index: 10; transition: all 0.3s ease; }
                .marker-label.side-label { pointer-events: none; }
                .pending-tag { color: #64748b; font-style: italic; font-weight: 600; }
                
                .legal-tag-mini { position: absolute; bottom: 2px; right: 4px; font-size: 0.5rem; opacity: 0.8; background: rgba(0,0,0,0.3); padding: 0 4px; border-radius: 3px; color: white; font-weight: 500; }
                
                .timeline-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2rem; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
                .legend-item { display: flex; align-items: center; gap: 0.5rem; }
                .dot { width: 10px; height: 10px; border-radius: 3px; }
                .dot.caq { background: var(--primary); }
                .dot.refusal { background: #e53e3e; }
                .dot.study { background: #3182ce; }
                .dot.entry { background: #ed8936; }
                .dot.travel { background: #cbd5e0; border: 1px dashed #718096; }
                .dot.work { background: #805ad5; }
                .dot.intent { background: #e53e3e; }
                .dot.pending { background: #94a3b8; }
            `}</style>
        </div>
    );
};

export default Timeline;
