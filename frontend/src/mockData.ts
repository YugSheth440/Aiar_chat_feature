import type { Hazard } from './types';

export const MOCK_HAZARDS: Hazard[] = [
  {
    id: 'hz-001',
    title: 'Overheating Detected',
    subtitle: 'Possible Loose Connection',
    riskLevel: 'CRITICAL',
    confidence: 98,
    component: 'Upper Terminal',
    reading: '101.3',
    readingUnit: '°F',
    description: 'Your circuit breaker is overheating. This is likely caused by an overloaded circuit or a loose connection.',
    reason: 'Overloading occurs when more current flows through a breaker than its rated capacity. Over time, heat degrades the internal contacts.',
    whyItMatters: 'Left unaddressed, an overheating breaker can cause an electrical fire within hours.',
    tags: ['Heat Source', 'Panel Board'],
    boundingBox: { top: '22%', left: '20%', width: '52%', height: '42%' },
    actions: [
      {
        id: 'act-1', stepNumber: 1, icon: 'shield-alert',
        title: 'Maintain safe distance',
        subtitle: 'Stay at least 2 meters away',
        isCritical: true, estimatedTime: '~10 sec',
      },
      {
        id: 'act-2', stepNumber: 2, icon: 'zap-off',
        title: 'Turn off main power',
        subtitle: "If it's safe to do so",
        isCritical: true, estimatedTime: '~30 sec',
      },
      {
        id: 'act-3', stepNumber: 3, icon: 'search',
        title: 'Inspect connection',
        subtitle: 'Look for loose or burnt wires',
        isCritical: false, estimatedTime: '~5 min',
      },
    ],
  },
  {
    id: 'hz-002',
    title: 'Corrosion Detected',
    subtitle: 'Oxidation on Bus Bar',
    riskLevel: 'MEDIUM',
    confidence: 84,
    component: 'Bus Bar',
    reading: '73.2',
    readingUnit: '°F',
    description: 'Corrosion is visible on the main bus bar. This may increase electrical resistance and cause heating over time.',
    reason: 'Moisture ingress or chemical exposure can cause oxidation on copper bus bars, leading to poor conductivity.',
    whyItMatters: 'Unresolved corrosion can escalate to overheating or partial disconnection, affecting downstream circuits.',
    tags: ['Corrosion', 'Bus Bar'],
    boundingBox: { top: '55%', left: '30%', width: '35%', height: '20%' },
    actions: [
      {
        id: 'act-4', stepNumber: 1, icon: 'power-off',
        title: 'De-energize circuit',
        subtitle: 'Switch off upstream breaker',
        isCritical: true, estimatedTime: '~1 min',
      },
      {
        id: 'act-5', stepNumber: 2, icon: 'brush',
        title: 'Clean with wire brush',
        subtitle: 'Use dry non-conductive brush',
        isCritical: false, estimatedTime: '~10 min',
      },
    ],
  },
];
