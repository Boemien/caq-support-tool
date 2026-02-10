import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History } from 'lucide-react';

const Timeline3D = ({ events = [], onBack }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const [projectedLabels, setProjectedLabels] = useState([]);

    // Sort events
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => {
            const dateA = new Date(a.submissionDate || a.start || 0);
            const dateB = new Date(b.submissionDate || b.start || 0);
            return dateA - dateB;
        });
    }, [events]);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        // --- SCENE SETUP ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x020617);

        const width = window.innerWidth;
        const height = window.innerHeight;

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.set(0, 15, 40);

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // --- LIGHTS ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xffffff, 1.2);
        pointLight1.position.set(10, 20, 10);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x3182ce, 0.8);
        pointLight2.position.set(-10, -10, -10);
        scene.add(pointLight2);

        // --- CONTROLS ---
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // --- STARS ---
        const starCount = 4000;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i++) {
            starPositions[i] = (Math.random() - 0.5) * 600;
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.6 });
        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        // --- TIMELINE NODES ---
        const nodeGroup = new THREE.Group();
        const nodes = [];

        sortedEvents.forEach((event, i) => {
            // Spiral-like path for visual depth
            const x = Math.sin(i * 0.5) * 5;
            const y = (i - sortedEvents.length / 2) * 2;
            const z = -i * 12;

            // Outer Glow Sphere
            const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
            // Color Logic based on Category/Type
            let color = 0x718096; // Default Gray

            if (event.type === 'CAQ') color = 0x003399; // Deep Blue
            else if (['CAQ_REFUSAL', 'INTENT_REFUSAL'].includes(event.type)) color = 0xe53e3e; // Red
            else if (['INTERVIEW', 'DOCS_SENT', 'WORK_PERMIT'].includes(event.type)) color = 0x805ad5; // Purple
            else if (event.type === 'INSURANCE') color = 0x38a169; // Green
            else if (['ENTRY', 'EXIT'].includes(event.type)) color = 0xed8936; // Orange
            else if (event.type === 'MEDICAL') color = 0xf687b3; // Pink
            else if (event.type === 'STUDIES') color = 0x3182ce; // Blue
            else if (event.category === 'ADM') color = 0x805ad5; // Fallback Admin
            else if (event.category === 'USR') color = 0x3182ce; // Fallback User

            const glowMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.2
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(x, y, z);
            nodeGroup.add(glow);

            // Core Sphere
            const geo = new THREE.SphereGeometry(0.3, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 1.5
            });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.position.set(x, y, z);
            nodeGroup.add(sphere);

            nodes.push({ sphere, event, index: i });
        });

        // --- CONNECTION PATH ---
        if (nodes.length > 1) {
            const curvePoints = nodes.map(n => n.sphere.position.clone());
            const curve = new THREE.CatmullRomCurve3(curvePoints);
            const tubeGeo = new THREE.TubeGeometry(curve, 100, 0.06, 8, false);
            const tubeMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15
            });
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            nodeGroup.add(tube);

            // Duration Labels Markers
            nodes.forEach((node, i) => {
                if (i > 0) {
                    const prevNode = nodes[i - 1];
                    const midPoint = new THREE.Vector3().addVectors(node.sphere.position, prevNode.sphere.position).multiplyScalar(0.5);
                    const days = differenceInDays(
                        new Date(node.event.submissionDate || node.event.start),
                        new Date(prevNode.event.submissionDate || prevNode.event.start)
                    );
                    node.durationToPrev = days;
                    node.midPos = midPoint;
                }
            });
        }

        scene.add(nodeGroup);

        // --- PROJECTION LOGIC ---
        const vector = new THREE.Vector3();

        const updateLabels = () => {
            const newProjected = nodes.map(node => {
                vector.copy(node.sphere.position);
                vector.project(camera);

                const screenX = (vector.x * 0.5 + 0.5) * width;
                const screenY = (-vector.y * 0.5 + 0.5) * height;

                // Hide if behind camera
                const isVisible = vector.z < 1;

                return {
                    id: node.event.id || node.index,
                    x: screenX,
                    y: screenY,
                    visible: isVisible,
                    event: node.event,
                    duration: node.durationToPrev,
                    midX: node.midPos ? ((new THREE.Vector3().copy(node.midPos).project(camera).x * 0.5 + 0.5) * width) : null,
                    midY: node.midPos ? ((-new THREE.Vector3().copy(node.midPos).project(camera).y * 0.5 + 0.5) * height) : null,
                    nodeZ: node.sphere.position.z
                };
            });
            setProjectedLabels(newProjected);
        };

        // --- ANIMATION LOOP ---
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
            updateLabels();
        };

        animate();

        // --- HANDLE RESIZE ---
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(requestRef.current);
            renderer.dispose();
            starGeometry.dispose();
            starMaterial.dispose();
            nodeGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        };
    }, [sortedEvents]);

    return (
        <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#020617', fontFamily: 'Outfit, sans-serif' }}>
            {/* UI Overlay */}
            <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 100000 }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        padding: '12px 28px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 24px -1px rgba(0, 0, 0, 0.2)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                    ← Dashboard
                </button>
            </div>

            <canvas ref={canvasRef} style={{ display: 'block' }} />

            {/* 2D HTML Labels Layer */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {projectedLabels.map(label => (
                    label.visible && (
                        <React.Fragment key={label.id}>
                            {/* Duration Indicator */}
                            {label.duration !== undefined && label.midX && (
                                <div style={{
                                    position: 'absolute',
                                    left: label.midX,
                                    top: label.midY,
                                    transform: 'translate(-50%, -50%)',
                                    color: 'rgba(148, 163, 184, 0.8)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: 'rgba(15, 23, 42, 0.4)',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(148, 163, 184, 0.2)'
                                }}>
                                    +{label.duration} j
                                </div>
                            )}

                            {/* Main Event Card */}
                            <div style={{
                                position: 'absolute',
                                left: label.x,
                                top: label.y,
                                transform: 'translate(20px, -50%)',
                                background: 'rgba(15, 23, 42, 0.9)',
                                backdropFilter: 'blur(12px)',
                                padding: '12px 16px',
                                borderRadius: '14px',
                                border: `2px solid ${label.event.type === 'CAQ' ? '#00339999' : '#3182ce99'}`,
                                color: 'white',
                                minWidth: '180px',
                                pointerEvents: 'none',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                                transition: 'opacity 0.2s',
                                opacity: Math.max(0.3, 1 + label.nodeZ / 100) // Simple depth sorting via opacity
                            }}>
                                <div style={{
                                    fontSize: '10px',
                                    textTransform: 'uppercase',
                                    fontWeight: 800,
                                    letterSpacing: '0.05em',
                                    marginBottom: '4px',
                                    color: label.event.type === 'CAQ' ? '#60a5fa' : '#93c5fd'
                                }}>
                                    {(() => {
                                        const EVENT_LABELS = {
                                            'CAQ': 'Certificat (CAQ)',
                                            'CAQ_REFUSAL': 'Refus de CAQ',
                                            'INTENT_REFUSAL': 'Intention de Refus',
                                            'DOCS_SENT': 'Envoi de Documents',
                                            'INTERVIEW': 'Convocation Entrevue',
                                            'ENTRY': 'Entrée au pays',
                                            'EXIT': 'Sortie du territoire',
                                            'WORK_PERMIT': 'Permis Travail/Études',
                                            'STUDIES': 'Début des Études',
                                            'INSURANCE': 'Assurance Maladie',
                                            'MEDICAL': 'Maladie / Congé Médical'
                                        };

                                        // Logic to distinguish Request vs Obtained
                                        const hasDecision = !!label.event.start;
                                        let text = EVENT_LABELS[label.event.type] || label.event.type;

                                        if (!hasDecision && ['CAQ', 'WORK_PERMIT'].includes(label.event.type)) {
                                            if (label.event.type === 'CAQ') text = "Demande de CAQ";
                                            if (label.event.type === 'WORK_PERMIT') text = "Demande de Permis";
                                        }

                                        return text;
                                    })()}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                                    {label.event.label}
                                </div>
                                <div style={{ fontSize: '11px', opacity: 0.7, fontWeight: 500 }}>
                                    {label.event.start && label.event.end ? (
                                        <>
                                            {format(new Date(label.event.start), 'dd MMM yyyy', { locale: fr })} - {format(new Date(label.event.end), 'dd MMM yyyy', { locale: fr })}
                                        </>
                                    ) : (
                                        format(new Date(label.event.submissionDate || label.event.start), 'dd MMMM yyyy', { locale: fr })
                                    )}
                                </div>
                            </div>
                        </React.Fragment>
                    )
                ))}
            </div>

            {/* Hint overlay */}
            <div style={{
                position: 'absolute',
                bottom: '3rem',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.9rem',
                textAlign: 'center',
                pointerEvents: 'none',
                background: 'rgba(255,255,255,0.05)',
                padding: '10px 24px',
                borderRadius: '50px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <History size={14} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Reconstitution temporelle • Utilisez la souris (Molette = Zoom)
            </div>
        </div>
    );
};

export default Timeline3D;
