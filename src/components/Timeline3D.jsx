import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { addMonths, addYears, differenceInDays, differenceInMonths, endOfMonth, format, startOfMonth, startOfYear, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, AlertTriangle } from 'lucide-react';
import { analyzeTimeline } from '../logic/timelineRules';

const safeParseDate = (dateStr) => {
    if (dateStr === 0) return new Date(0);
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'number') return new Date(dateStr);
    // Handle YYYY-MM-DD strings safely as local time
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts.map(Number);
            return new Date(y, m - 1, d);
        }
    }
    return new Date(dateStr);
};

const EVENT_LABELS = {
    CAQ: 'Certificat (CAQ)',
    CAQ_REFUSAL: 'Refus de CAQ',
    INTENT_REFUSAL: 'Intention de refus',
    INTENT_CANCEL: 'Intention d\'annulation',
    CAQ_CANCEL: 'Annulation du CAQ',
    FRAUD_REJECTION: 'Rejet pour faux et trompeur',
    DOCS_SENT: 'Envoi de documents',
    INTERVIEW: 'Convocation entrevue',
    ENTRY: "Entrée au pays",
    EXIT: 'Sortie du territoire',
    WORK_PERMIT: 'Permis travail/études',
    STUDIES: 'Début des études',
    INSURANCE: 'Assurance maladie',
    MEDICAL: 'Maladie / congé médical'
};

const LANE_DEFS = [
    {
        id: 'immigration',
        label: 'Immigration',
        color: '#2563eb',
        types: ['CAQ', 'CAQ_REFUSAL', 'INTENT_REFUSAL', 'INTENT_CANCEL', 'CAQ_CANCEL', 'FRAUD_REJECTION', 'WORK_PERMIT']
    },
    {
        id: 'documents',
        label: 'Documents',
        color: '#14b8a6',
        types: ['DOCS_SENT', 'INTERVIEW']
    },
    {
        id: 'sejour',
        label: 'Études & séjour',
        color: '#f59e0b',
        types: ['ENTRY', 'EXIT', 'STUDIES']
    },
    {
        id: 'sante',
        label: 'Santé',
        color: '#f472b6',
        types: ['INSURANCE', 'MEDICAL']
    },
    {
        id: 'autre',
        label: 'Autres',
        color: '#94a3b8',
        types: []
    }
];

// Color mapping for specific event types (overrides lane color)
const EVENT_COLORS = {
    'CAQ_REFUSAL': '#ef4444',        // Red - Refusal
    'INTENT_REFUSAL': '#f97316',     // Orange - Intent to refuse
    'INTENT_CANCEL': '#dc2626',      // Dark red - Intent to cancel
    'CAQ_CANCEL': '#991b1b',         // Very dark red - Cancellation
    'FRAUD_REJECTION': '#7c3aed',    // Purple - Fraud
    'CAQ': '#10b981',                // Green - Approved CAQ
    'WORK_PERMIT': '#3b82f6'         // Blue - Work permit
};

const toDate = value => safeParseDate(value);

const pickLane = event => {
    const directLane = LANE_DEFS.find(lane => lane.types.includes(event.type));
    if (directLane) return directLane;
    if (event.category === 'ADM') return LANE_DEFS.find(lane => lane.id === 'documents');
    if (event.category === 'USR') return LANE_DEFS.find(lane => lane.id === 'sejour');
    return LANE_DEFS.find(lane => lane.id === 'autre');
};

const humanizeType = value => {
    if (!value) return 'Événement';
    return String(value)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/(^|\s)\S/g, char => char.toUpperCase());
};

const buildEventTitle = event => {
    const hasDecision = Boolean(event.start);
    if (!hasDecision && event.type === 'CAQ') return 'Demande de CAQ';
    if (!hasDecision && event.type === 'WORK_PERMIT') return 'Demande de permis';
    return EVENT_LABELS[event.type] || humanizeType(event.type);
};

const formatDate = date => format(date, 'dd MMM yyyy', { locale: fr });

const getDisplayLabel = event => {
    const label = event?.label;
    if (!label) return buildEventTitle(event);
    if (label === event.type) return buildEventTitle(event);
    if (label.includes('_')) return buildEventTitle(event);
    return label;
};

const Timeline3D = ({ events = [], onBack }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const [projectedLabels, setProjectedLabels] = useState([]);
    const [projectedRanges, setProjectedRanges] = useState([]);
    const [projectedMarkers, setProjectedMarkers] = useState([]);
    const [projectedAlerts, setProjectedAlerts] = useState([]);

    const timelineData = useMemo(() => {
        const items = events
            .map((event, index) => {
                const submissionDate = toDate(event.submissionDate);
                const startDate = toDate(event.start);
                const endDate = toDate(event.end);
                const anchorDate = submissionDate || startDate || endDate;
                if (!anchorDate) return null;

                const lane = pickLane(event);
                const durationDays = startDate && endDate
                    ? Math.max(0, differenceInDays(endDate, startDate))
                    : null;

                return {
                    id: event.id || `${event.type || 'event'}-${index}`,
                    event,
                    lane,
                    submissionDate,
                    startDate,
                    endDate,
                    anchorDate,
                    durationDays,
                    gapDays: null
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.anchorDate - b.anchorDate);

        if (!items.length) {
            return { items: [], minDate: null, maxDate: null, totalDays: 0 };
        }

        let minDate = items[0].anchorDate;
        let maxDate = items[0].anchorDate;

        items.forEach(item => {
            const rangeStart = item.startDate || item.anchorDate;
            const rangeEnd = item.endDate || item.anchorDate;
            if (rangeStart < minDate) minDate = rangeStart;
            if (rangeEnd > maxDate) maxDate = rangeEnd;
        });

        const totalDays = Math.max(1, differenceInDays(maxDate, minDate) + 1);
        const lastByLane = new Map();

        items.forEach(item => {
            item.dayIndex = Math.max(0, differenceInDays(item.anchorDate, minDate));
            const lastDate = lastByLane.get(item.lane.id);
            if (lastDate) {
                item.gapDays = Math.max(0, differenceInDays(item.anchorDate, lastDate));
            }
            lastByLane.set(item.lane.id, item.endDate || item.anchorDate);
        });

        const laneBuckets = new Map();
        items.forEach(item => {
            if (!laneBuckets.has(item.lane.id)) laneBuckets.set(item.lane.id, []);
            laneBuckets.get(item.lane.id).push(item);
        });

        laneBuckets.forEach(laneItems => {
            laneItems.sort((a, b) => {
                const startA = a.startDate || a.anchorDate;
                const startB = b.startDate || b.anchorDate;
                return startA - startB;
            });

            const trackEnds = [];

            laneItems.forEach(item => {
                const rangeStart = item.startDate || item.anchorDate;
                const rangeEnd = item.endDate || item.startDate || item.anchorDate;
                // Force separate tracks for even immediate sequences or same-day events
                let trackIndex = trackEnds.findIndex(endDate => rangeStart > endDate);
                if (trackIndex === -1) {
                    trackIndex = trackEnds.length;
                    trackEnds.push(rangeEnd);
                } else {
                    trackEnds[trackIndex] = rangeEnd;
                }
                item.trackIndex = trackIndex;
            });

            laneItems.forEach(item => {
                item.trackCount = trackEnds.length;
            });
        });

        const report = analyzeTimeline(events);
        const alerts = (report.allAlerts || [])
            .map((alert, idx) => {
                const date = safeParseDate(alert.date);
                if (!date || !isValid(date)) return null;
                return {
                    id: `alert-${idx}`,
                    date,
                    message: alert.message,
                    type: alert.type,
                    dayIndex: Math.max(0, differenceInDays(date, minDate))
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.date - b.date);

        // Assign stacking indices for alerts on same or near dates (within 6 days)
        let lastDate = null;
        let currentStackIndex = 0;
        const PROXIMITY_THRESHOLD_DAYS = 6;

        alerts.forEach(alert => {
            if (lastDate && Math.abs(differenceInDays(alert.date, lastDate)) <= PROXIMITY_THRESHOLD_DAYS) {
                currentStackIndex++;
            } else {
                currentStackIndex = 0;
            }
            alert.stackIndex = currentStackIndex;
            lastDate = alert.date;
        });

        return { items, minDate, maxDate, totalDays, alerts };
    }, [events]);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return undefined;

        const { items, minDate, maxDate, totalDays, alerts } = timelineData;

        if (!items.length || !minDate || !maxDate) {
            setProjectedLabels([]);
            setProjectedRanges([]);
            setProjectedMarkers([]);
            setProjectedAlerts([]);
            return undefined;
        }

        const container = containerRef.current;
        const getSize = () => {
            const { width, height } = container.getBoundingClientRect();
            return {
                width: Math.max(1, width),
                height: Math.max(1, height)
            };
        };

        const { width, height } = getSize();
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b1220);
        scene.fog = new THREE.Fog(0x0b1220, 40, 220);

        const desiredLength = 400; // Increased spacing for chronological clarity
        const scale = Math.min(1.0, Math.max(0.08, desiredLength / totalDays));
        const timelineLength = totalDays * scale;
        const laneSpacing = 7;
        const laneOffset = ((LANE_DEFS.length - 1) * laneSpacing) / 2;
        const baseY = 0.55;
        const trackSpacing = 2.0; // Increased to ensure enough vertical gap between L/R labels

        const dateToZ = date => -differenceInDays(date, minDate) * scale;
        const laneX = laneIndex => laneIndex * laneSpacing - laneOffset;
        const laneY = item => {
            const trackCount = item.trackCount || 1;
            const trackIndex = item.trackIndex || 0;
            const offset = ((trackCount - 1) * trackSpacing) / 2;
            return baseY + trackIndex * trackSpacing - offset;
        };

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2500);
        camera.position.set(0, 25, 65);
        camera.lookAt(0, 0, -timelineLength / 3);

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.55);
        keyLight.position.set(8, 18, 12);
        scene.add(keyLight);

        const fillLight = new THREE.PointLight(0x60a5fa, 0.35);
        fillLight.position.set(-12, 10, 8);
        scene.add(fillLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 20;
        controls.maxDistance = 160;
        controls.maxPolarAngle = Math.PI * 0.78;
        controls.target.set(0, 0, -timelineLength / 2);
        controls.update();

        const grid = new THREE.GridHelper(200, 40, 0x1f2937, 0x0f172a);
        grid.position.set(0, -0.4, -timelineLength / 2);
        scene.add(grid);

        const guidesGroup = new THREE.Group();
        const railsGroup = new THREE.Group();

        LANE_DEFS.forEach((lane, index) => {
            const x = laneX(index);
            const points = [
                new THREE.Vector3(x, 0, 0),
                new THREE.Vector3(x, 0, -timelineLength)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({
                color: lane.color,
                transparent: true,
                opacity: 0.65
            });
            railsGroup.add(new THREE.Line(lineGeo, lineMat));

            const ribbonGeo = new THREE.BoxGeometry(0.9, 0.03, timelineLength);
            const ribbonMat = new THREE.MeshStandardMaterial({
                color: lane.color,
                transparent: true,
                opacity: 0.08
            });
            const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
            ribbon.position.set(x, -0.12, -timelineLength / 2);
            railsGroup.add(ribbon);
        });

        const monthStart = startOfMonth(minDate);
        const monthEnd = endOfMonth(maxDate);
        const monthCount = Math.max(1, differenceInMonths(monthEnd, monthStart) + 1);
        let monthStep = 1;
        if (monthCount > 60) monthStep = 3;
        if (monthCount > 120) monthStep = 6;
        if (monthCount > 240) monthStep = 12;

        const monthLineMaterial = new THREE.LineBasicMaterial({
            color: 0x1f2937,
            transparent: true,
            opacity: 0.65
        });
        const yearLineMaterial = new THREE.LineBasicMaterial({
            color: 0x334155,
            transparent: true,
            opacity: 0.9
        });

        const markerX = laneX(0) - 8.4;
        const markerTargets = [];

        const monthLabelFormat = monthCount > 24 ? 'MMM yyyy' : 'MMM';

        if (monthStep < 12) {
            for (let cursor = monthStart; cursor <= monthEnd; cursor = addMonths(cursor, monthStep)) {
                if (cursor >= minDate) {
                    const z = dateToZ(cursor);
                    const points = [
                        new THREE.Vector3(laneX(0) - 1, -0.05, z),
                        new THREE.Vector3(laneX(LANE_DEFS.length - 1) + 1, -0.05, z)
                    ];
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    guidesGroup.add(new THREE.Line(geometry, monthLineMaterial));
                }

                if (cursor.getMonth() !== 0) {
                    const labelDate = cursor < minDate ? minDate : cursor;
                    markerTargets.push({
                        id: `month-${cursor.toISOString()}`,
                        position: new THREE.Vector3(markerX, -0.45, dateToZ(labelDate)),
                        label: format(cursor, monthLabelFormat, { locale: fr }),
                        kind: 'month',
                        dayIndex: Math.max(0, differenceInDays(labelDate, minDate))
                    });
                }
            }
        }

        for (let cursor = startOfYear(minDate); cursor <= maxDate; cursor = addYears(cursor, 1)) {
            if (cursor >= minDate) {
                const z = dateToZ(cursor);
                const points = [
                    new THREE.Vector3(laneX(0) - 1.2, -0.03, z),
                    new THREE.Vector3(laneX(LANE_DEFS.length - 1) + 1.2, -0.03, z)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                guidesGroup.add(new THREE.Line(geometry, yearLineMaterial));
            }

            const labelDate = cursor < minDate ? minDate : cursor;
            markerTargets.push({
                id: `year-${cursor.getFullYear()}`,
                position: new THREE.Vector3(markerX, -0.18, dateToZ(labelDate)),
                label: format(cursor, 'yyyy', { locale: fr }),
                kind: 'year',
                dayIndex: Math.max(0, differenceInDays(labelDate, minDate))
            });
        }

        scene.add(guidesGroup);
        scene.add(railsGroup);

        const nodesGroup = new THREE.Group();
        const pathGroup = new THREE.Group();
        const labelTargets = [];
        const rangeTargets = [];

        const laneBuckets = new Map();
        items.forEach(item => {
            if (!laneBuckets.has(item.lane.id)) laneBuckets.set(item.lane.id, []);
            laneBuckets.get(item.lane.id).push(item);
        });

        laneBuckets.forEach((laneItems, laneId) => {
            const laneIndex = LANE_DEFS.findIndex(lane => lane.id === laneId);
            const laneColor = LANE_DEFS[laneIndex]?.color || '#94a3b8';
            const points = laneItems.map(item => new THREE.Vector3(laneX(laneIndex), laneY(item), dateToZ(item.anchorDate)));
            if (points.length > 1) {
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineBasicMaterial({
                    color: laneColor,
                    transparent: true,
                    opacity: 0.35
                });
                pathGroup.add(new THREE.Line(lineGeo, lineMat));
            }
        });

        items.forEach(item => {
            const laneIndex = LANE_DEFS.findIndex(lane => lane.id === item.lane.id);
            // Use event-specific color if available, otherwise use lane color
            const color = EVENT_COLORS[item.event.type] || item.lane.color;
            const x = laneX(laneIndex);
            const z = dateToZ(item.anchorDate);
            const y = laneY(item);

            const nodeGeo = new THREE.SphereGeometry(0.35, 24, 24);
            const nodeMat = new THREE.MeshStandardMaterial({
                color,
                emissive: new THREE.Color(color),
                emissiveIntensity: 0.85
            });
            const node = new THREE.Mesh(nodeGeo, nodeMat);
            node.position.set(x, y, z);
            nodesGroup.add(node);

            let rangeMidPos = null;
            if (item.startDate && item.endDate) {
                const startZ = dateToZ(item.startDate);
                const endZ = dateToZ(item.endDate);
                const minZ = Math.min(startZ, endZ);
                const maxZ = Math.max(startZ, endZ);
                const depth = Math.max(scale * 0.8, Math.abs(maxZ - minZ));
                const midZ = (minZ + maxZ) / 2;

                const barGeo = new THREE.BoxGeometry(1.1, 0.18, depth);
                const barMat = new THREE.MeshStandardMaterial({
                    color,
                    transparent: true,
                    opacity: 0.45
                });
                const bar = new THREE.Mesh(barGeo, barMat);
                bar.position.set(x, y - 0.3, midZ);
                nodesGroup.add(bar);

                const edgeGeo = new THREE.EdgesGeometry(barGeo);
                const edgeMat = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.2
                });
                const edges = new THREE.LineSegments(edgeGeo, edgeMat);
                edges.position.copy(bar.position);
                nodesGroup.add(edges);

                rangeMidPos = new THREE.Vector3(x, y - 0.3, midZ);
            }

            labelTargets.push({
                id: item.id,
                position: node.position.clone(),
                item
            });

            if (rangeMidPos && item.durationDays !== null) {
                const rangeStart = item.startDate || item.anchorDate;
                const rangeEnd = item.endDate || item.anchorDate;
                const rangeMid = new Date((rangeStart.getTime() + rangeEnd.getTime()) / 2);
                rangeTargets.push({
                    id: `range-${item.id}`,
                    position: rangeMidPos.clone(),
                    durationDays: item.durationDays,
                    lane: item.lane,
                    dayIndex: Math.max(0, differenceInDays(rangeMid, minDate))
                });
            }
        });

        const alertTargets = (alerts || []).map(alert => {
            const z = dateToZ(alert.date);
            return {
                ...alert,
                position: new THREE.Vector3(0, 7.5, z) // Elevated significantly to clear event labels
            };
        });

        scene.add(pathGroup);
        scene.add(nodesGroup);

        const vector = new THREE.Vector3();
        const updateLabels = () => {
            const { width: currentWidth, height: currentHeight } = getSize();
            const cameraPos = camera.position;

            const maxOrder = totalDays || 1;
            const projected = labelTargets.map(target => {
                vector.copy(target.position).project(camera);
                const x = (vector.x * 0.5 + 0.5) * currentWidth;
                const y = (-vector.y * 0.5 + 0.5) * currentHeight;
                const visible = vector.z > -1 && vector.z < 1;

                const distance = cameraPos.distanceTo(target.position);

                return {
                    id: target.id,
                    x,
                    y,
                    visible,
                    item: target.item,
                    depth: target.position.z,
                    distance,
                    order: maxOrder - (target.item.dayIndex ?? 0)
                };
            });

            const projectedRange = rangeTargets.map(target => {
                vector.copy(target.position).project(camera);
                return {
                    id: target.id,
                    x: (vector.x * 0.5 + 0.5) * currentWidth,
                    y: (-vector.y * 0.5 + 0.5) * currentHeight,
                    visible: vector.z > -1 && vector.z < 1,
                    durationDays: target.durationDays,
                    lane: target.lane,
                    order: maxOrder - (target.dayIndex ?? 0)
                };
            });

            const projectedMarker = markerTargets.map(target => {
                vector.copy(target.position).project(camera);
                return {
                    id: target.id,
                    x: (vector.x * 0.5 + 0.5) * currentWidth,
                    y: (-vector.y * 0.5 + 0.5) * currentHeight,
                    visible: vector.z > -1 && vector.z < 1,
                    label: target.label,
                    kind: target.kind,
                    order: maxOrder - (target.dayIndex ?? 0)
                };
            });

            const projectedAlert = alertTargets.map(target => {
                vector.copy(target.position).project(camera);
                return {
                    ...target,
                    x: (vector.x * 0.5 + 0.5) * currentWidth,
                    y: (-vector.y * 0.5 + 0.5) * currentHeight,
                    visible: vector.z > -1 && vector.z < 1,
                    order: maxOrder - (target.dayIndex ?? 0)
                };
            });

            setProjectedLabels(projected);
            setProjectedRanges(projectedRange);
            setProjectedMarkers(projectedMarker);
            setProjectedAlerts(projectedAlert);
        };

        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
            updateLabels();
        };

        animate();

        const handleResize = () => {
            const { width: nextWidth, height: nextHeight } = getSize();
            camera.aspect = nextWidth / nextHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(nextWidth, nextHeight);
        };
        window.addEventListener('resize', handleResize);

        const handleKeyDown = (e) => {
            const moveStep = 2.5;
            let xDelta = 0;
            let zDelta = 0;

            switch (e.key) {
                case 'ArrowUp':
                    zDelta = -moveStep;
                    break;
                case 'ArrowDown':
                    zDelta = moveStep;
                    break;
                case 'ArrowLeft':
                    xDelta = -moveStep;
                    break;
                case 'ArrowRight':
                    xDelta = moveStep;
                    break;
                default:
                    return;
            }

            camera.position.x += xDelta;
            camera.position.z += zDelta;
            controls.target.x += xDelta;
            controls.target.z += zDelta;
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            cancelAnimationFrame(requestRef.current);
            renderer.dispose();
            grid.geometry.dispose();
            grid.material.dispose();
            guidesGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            railsGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            pathGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            nodesGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        };
    }, [timelineData]);

    const { minDate, maxDate, totalDays } = timelineData;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
                fontFamily: 'Outfit, sans-serif'
            }}
        >
            <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 100000 }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: 'white',
                        padding: '12px 28px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 8px 30px -10px rgba(0, 0, 0, 0.5)'
                    }}
                    onMouseEnter={event => {
                        event.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
                        event.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.35)';
                    }}
                    onMouseLeave={event => {
                        event.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)';
                        event.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                    }}
                >
                    ← Dashboard
                </button>
            </div>

            <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 100000 }}>
                <div
                    style={{
                        background: 'rgba(15, 23, 42, 0.82)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '16px',
                        padding: '16px 18px',
                        color: 'white',
                        minWidth: '220px',
                        boxShadow: '0 12px 30px -18px rgba(15, 23, 42, 0.8)'
                    }}
                >
                    <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65 }}>
                        Chemins
                    </div>
                    <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                        {LANE_DEFS.map(lane => (
                            <div key={lane.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                    style={{
                                        width: '26px',
                                        height: '4px',
                                        borderRadius: '999px',
                                        background: lane.color,
                                        opacity: 0.9
                                    }}
                                />
                                <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9 }}>{lane.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '6rem', left: '2rem', zIndex: 100000 }}>
                <div
                    style={{
                        background: 'rgba(15, 23, 42, 0.82)',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                        borderRadius: '16px',
                        padding: '14px 18px',
                        color: 'white',
                        minWidth: '240px'
                    }}
                >
                    <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65 }}>
                        Période globale
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>
                        {minDate && maxDate ? `${formatDate(minDate)} → ${formatDate(maxDate)}` : '—'}
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.75 }}>
                        {totalDays ? `${totalDays} jours couverts` : 'Aucun événement'}
                    </div>
                </div>
            </div>

            <canvas ref={canvasRef} style={{ display: 'block' }} />

            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {projectedMarkers.map(marker => (
                    marker.visible && (
                        <div
                            key={marker.id}
                            style={{
                                position: 'absolute',
                                left: marker.x,
                                top: marker.y,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 1000 + marker.order,
                                color: marker.kind === 'year' ? 'rgba(226, 232, 240, 0.95)' : 'rgba(148, 163, 184, 0.95)',
                                fontSize: marker.kind === 'year' ? '12px' : '10px',
                                fontWeight: marker.kind === 'year' ? 700 : 600,
                                letterSpacing: marker.kind === 'year' ? '0.06em' : '0.04em',
                                background: marker.kind === 'year' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.6)',
                                padding: marker.kind === 'year' ? '3px 10px' : '2px 8px',
                                borderRadius: '999px',
                                border: marker.kind === 'year'
                                    ? '1px solid rgba(148, 163, 184, 0.5)'
                                    : '1px solid rgba(148, 163, 184, 0.25)',
                                textTransform: marker.kind === 'year' ? 'uppercase' : 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {marker.label}
                        </div>
                    )
                ))}

                {projectedRanges.map(range => (
                    range.visible && (
                        <div
                            key={range.id}
                            style={{
                                position: 'absolute',
                                left: range.x,
                                top: range.y,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 1200 + range.order,
                                color: 'rgba(226, 232, 240, 0.9)',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: 'rgba(15, 23, 42, 0.7)',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                border: `1px solid ${range.lane.color}66`,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Durée: {range.durationDays} j
                        </div>
                    )
                ))}

                {projectedLabels.map(label => {
                    if (!label.visible) return null;

                    const { item } = label;
                    const hasRange = item.startDate && item.endDate;
                    const title = buildEventTitle(item.event);
                    const mainLabel = getDisplayLabel(item.event);
                    const dateLine = hasRange
                        ? `${formatDate(item.startDate)} → ${formatDate(item.endDate)}`
                        : formatDate(item.anchorDate);

                    const scale = Math.max(0.4, Math.min(1, 35 / (label.distance || 35)));

                    const isRequest = title.includes('Demande');
                    const labelStyle = isRequest ? {
                        transform: `translate(calc(-100% - 24px), -50%) scale(${scale})`,
                        textAlign: 'right',
                        transformOrigin: 'right center'
                    } : {
                        transform: `translate(24px, -50%) scale(${scale})`,
                        textAlign: 'left',
                        transformOrigin: 'left center'
                    };

                    return (
                        <div
                            key={label.id}
                            style={{
                                position: 'absolute',
                                left: label.x,
                                top: label.y,
                                ...labelStyle,
                                zIndex: 1500 + label.order,
                                background: 'rgba(15, 23, 42, 0.96)',
                                backdropFilter: 'blur(10px)',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: `1px solid ${item.lane.color}cc`,
                                color: 'white',
                                minWidth: '180px',
                                maxWidth: '240px',
                                boxShadow: '0 8px 25px -10px rgba(0, 0, 0, 0.7)',
                                opacity: 1
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isRequest ? 'flex-end' : 'space-between',
                                gap: '8px',
                                flexDirection: isRequest ? 'row-reverse' : 'row'
                            }}>
                                <span style={{
                                    fontSize: '9px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    fontWeight: 700,
                                    color: item.lane.color
                                }}>
                                    {title}
                                </span>
                                <span style={{
                                    fontSize: '9px',
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    background: `${item.lane.color}22`,
                                    color: 'white',
                                    fontWeight: 600
                                }}>
                                    {item.lane.label}
                                </span>
                            </div>

                            <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '4px', marginBottom: '4px', lineHeight: '1.2' }}>
                                {mainLabel}
                            </div>

                            {item.submissionDate && hasRange && (
                                <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '2px' }}>
                                    Dépôt: {formatDate(item.submissionDate)}
                                </div>
                            )}

                            <div style={{ fontSize: '10px', opacity: 0.75 }}>
                                {hasRange ? '' : ''} {dateLine}
                            </div>

                            <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {item.durationDays !== null && (
                                    <span
                                        style={{
                                            fontSize: '9px',
                                            padding: '2px 6px',
                                            borderRadius: '999px',
                                            background: `${item.lane.color}22`,
                                            border: `1px solid ${item.lane.color}44`
                                        }}
                                    >
                                        Durée: {item.durationDays} j
                                    </span>
                                )}
                                {item.gapDays !== null && (
                                    <span
                                        style={{
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            background: 'rgba(148, 163, 184, 0.15)',
                                            border: '1px solid rgba(148, 163, 184, 0.2)'
                                        }}
                                    >
                                        Délai précédent: {item.gapDays} j
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
                {projectedAlerts.map(alert => (
                    alert.visible && (
                        <div
                            key={alert.id}
                            style={{
                                position: 'absolute',
                                left: alert.x,
                                top: alert.y,
                                // Stack upwards: -100% (base) - (index * 115%) to account for gap
                                transform: `translate(-50%, calc(-100% - ${alert.stackIndex * 115}%))`,
                                zIndex: 2500 + alert.order + alert.stackIndex, // Reduced z-index to allow overlapping main popups if needed
                                background: alert.type === 'error' ? 'rgba(220, 38, 38, 0.4)' : 'rgba(217, 119, 6, 0.4)',
                                backdropFilter: 'blur(10px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                                color: 'white',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: alert.type === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                                pointerEvents: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                minWidth: '180px',
                                maxWidth: '260px'
                            }}
                        >
                            <AlertTriangle size={14} />
                            <div style={{ fontSize: '10px', fontWeight: 600, lineHeight: '1.3' }}>
                                {alert.message}
                            </div>
                        </div>
                    )
                ))}
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: '2.5rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    color: 'rgba(226, 232, 240, 0.7)',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    background: 'rgba(15, 23, 42, 0.65)',
                    padding: '10px 24px',
                    borderRadius: '999px',
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                }}
            >
                <History size={14} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Timeline multidimensionnelle • Flèches = Décalage Caméra • Molette = Zoom • Glisser = Rotation
            </div>
        </div>
    );
};

export default Timeline3D;
