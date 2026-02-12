import React from 'react';
import { X, FileText, Printer, Copy, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const DetailedReportModal = ({ isOpen, onClose, content, isLoading, error }) => {
    if (!isOpen) return null;

    const handleCopy = () => {
        if (content) {
            navigator.clipboard.writeText(content);
            alert("Rapport copié dans le presse-papier !");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="modal-overlay fade-in print:p-0">
            <div className="modal-content report-modal-content print:shadow-none print:w-full print:max-w-none print:m-0 print:rounded-none">
                <div className="modal-header print:hidden">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText className="text-accent" size={24} />
                        <h2>Compte-rendu d'analyse détaillée</h2>
                    </div>
                    <button onClick={onClose} className="close-button">
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body print:p-0">
                    {isLoading ? (
                        <div className="loading-state">
                            <Loader2 className="animate-spin text-accent" size={48} />
                            <p>Analyse du dossier en cours par nos services...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <AlertCircle className="text-red-500" size={48} />
                            <p>{error}</p>
                            <button onClick={onClose} className="btn-secondary" style={{ marginTop: '1rem' }}>Fermer</button>
                        </div>
                    ) : (
                        <div className="report-markdown print:m-0">
                            <ReactMarkdown>{content}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {!isLoading && !error && (
                    <div className="modal-footer print:hidden">
                        <button onClick={handleCopy} className="btn-secondary" style={{ flex: 1 }}>
                            <Copy size={18} />
                            Copier le texte
                        </button>
                        <button onClick={handlePrint} className="btn-primary" style={{ flex: 1 }}>
                            <Printer size={18} />
                            Imprimer le rapport
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .report-modal-content {
                    width: 95% !important;
                    max-width: 1200px !important;
                    max-height: 92vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }

                .modal-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-body {
                    padding: 2rem;
                    overflow-y: auto;
                    flex: 1;
                    color: #2d3748;
                    line-height: 1.6;
                }

                .modal-footer {
                    padding: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 1rem;
                    background: #f8fafc;
                }

                .loading-state, .error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    gap: 1rem;
                    text-align: center;
                }

                .report-markdown h1 { font-size: 1.75rem; margin-bottom: 1.5rem; color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 0.5rem; }
                .report-markdown h2 { font-size: 1.4rem; margin-top: 2rem; margin-bottom: 1rem; color: #2c5282; }
                .report-markdown p { margin-bottom: 1rem; }
                .report-markdown ul, .report-markdown ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
                .report-markdown li { margin-bottom: 0.5rem; }
                .report-markdown strong { color: #2d3748; font-weight: 700; }

                @media print {
                    .modal-overlay { position: static; background: none; padding: 0; }
                    .modal-content { box-shadow: none; border: none; width: 100%; max-width: 100%; margin: 0; }
                    .modal-body { padding: 0; overflow: visible; }
                    body * { visibility: hidden; }
                    .report-markdown, .report-markdown * { visibility: visible; }
                    .report-markdown { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default DetailedReportModal;
