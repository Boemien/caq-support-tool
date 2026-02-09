import React from 'react';
import { STATUS, SEVERITY } from '../logic/constants';
import { AlertTriangle, XCircle, Info, CheckCircle2, Scale } from 'lucide-react';

const Checklist = ({ controls }) => {
    const missingItems = controls.filter(c => c.status !== STATUS.OK);

    if (missingItems.length === 0) {
        return (
            <div className="checklist-complete">
                <CheckCircle2 color="green" size={24} />
                <p>Tous les documents et contrôles sont validés.</p>
            </div>
        );
    }

    return (
        <div className="checklist-container">
            <ul className="checklist-items">
                {missingItems.map((item, i) => (
                    <li key={i} className={`checklist-item ${item.severity.toLowerCase()}`}>
                        <div className="icon">
                            {item.severity === SEVERITY.BLOCKING ? <XCircle size={18} color="#c0392b" /> :
                                item.severity === SEVERITY.MAJOR ? <AlertTriangle size={18} color="#e67e22" /> :
                                    <Info size={18} color="#3498db" />}
                        </div>
                        <div className="content">
                            <div className="label-row">
                                <strong>{item.label}</strong>
                                {item.legalRef && (
                                    <span className="legal-tag">
                                        <Scale size={10} style={{ marginRight: '4px' }} />
                                        {item.legalRef}
                                    </span>
                                )}
                            </div>
                            <p>{item.note}</p>
                        </div>
                        <div className="severity-badge">{item.severity}</div>
                    </li>
                ))}
            </ul>

            <style>{`
        .checklist-container { margin-top: 1rem; }
        .checklist-items { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
        .checklist-item { 
          display: flex; 
          align-items: flex-start; 
          gap: 1rem; 
          padding: 1rem; 
          border-radius: 8px; 
          background: #fff;
          border: 1px solid #eee;
          position: relative;
        }
        .checklist-item.bloquant { border-left: 4px solid #c0392b; background: #fff5f5; }
        .checklist-item.majeur { border-left: 4px solid #e67e22; background: #fffcf5; }
        .checklist-item.mineur { border-left: 4px solid #3498db; background: #f5faff; }
        .content.majeur { border-left: 4px solid #e67e22; background: #fffcf5; }
        .content.mineur { border-left: 4px solid #3498db; background: #f5faff; }
        .label-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
        .legal-tag { 
          font-size: 0.65rem; 
          background: rgba(10, 37, 64, 0.08); 
          padding: 3px 8px; 
          border-radius: 6px; 
          color: #0c2540; 
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          display: flex;
          align-items: center;
          border: 1px solid rgba(10, 37, 64, 0.1);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .content strong { font-size: 0.95rem; }
        .content p { font-size: 0.85rem; color: #666; }
        .severity-badge { 
          position: absolute; 
          top: 0.5rem; 
          right: 0.5rem; 
          font-size: 0.65rem; 
          text-transform: uppercase; 
          font-weight: bold; 
          opacity: 0.6;
        }
      `}</style>
        </div>
    );
};

export default Checklist;
