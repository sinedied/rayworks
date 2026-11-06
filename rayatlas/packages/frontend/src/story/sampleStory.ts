import type { StoryFocus, Story } from './types';

/*
 * Ridgeline Coffee is a fictional company. Places are real, but every site, route, volume, and
 * metric in this story comes from the bundled sample network and must stay labeled as sample data.
 */

const ORIGIN_CODES = ['origin-huila', 'origin-sidama', 'origin-minas'];
const EXPORT_PORT_CODES = ['port-cartagena', 'port-djibouti', 'port-santos'];
const INLAND_ROUTE_CODES = ['road-huila-cartagena', 'rail-sidama-djibouti', 'road-minas-santos'];
const SEA_ROUTE_CODES = ['sea-cartagena-hamburg', 'sea-djibouti-hamburg', 'sea-santos-hamburg'];
const DC_ROUTE_CODES = [
  'road-hamburg-berlin',
  'rail-hamburg-cologne',
  'rail-hamburg-lyon',
  'road-hamburg-copenhagen',
];

const WHOLE_NETWORK: StoryFocus = {
  siteRoles: ['origin', 'port', 'plant', 'distribution', 'customer'],
  routeModes: ['sea', 'rail', 'road', 'air'],
};

export const sampleStory: Story = {
  id: 'ridgeline-coffee',
  version: 1,
  title: 'Ridgeline Coffee: From ridge to cup',
  subtitle: 'Follow a year of green coffee from three highland origins to cafés across Europe.',
  chapters: [
    {
      id: 'overview',
      eyebrow: 'Ridgeline Coffee · Supply network',
      title: 'From ridge to cup',
      body: 'Every cup Ridgeline serves starts on a mountainside thousands of kilometers away. Follow one year of coffee across three continents to a single roastery and the cafés it supplies.',
      camera: { center: [-30, 20], zoom: 1.6, bearing: 0, pitch: 0 },
      focus: WHOLE_NETWORK,
      metrics: [
        { id: 'sites', label: 'Sites in the network', format: 'count', source: { kind: 'count', entity: 'site', filter: WHOLE_NETWORK } },
        { id: 'routes', label: 'Routes', format: 'count', source: { kind: 'count', entity: 'route', filter: WHOLE_NETWORK } },
      ],
      duration: 4000,
    },
    {
      id: 'origins',
      eyebrow: 'Origins',
      title: 'Grown where the air is thin',
      body: 'Ridgeline buys from grower cooperatives in Huila, Colombia; Sidama, Ethiopia; and Sul de Minas, Brazil. Cooler highland nights slow cherry ripening, giving each lot its distinct cup profile.',
      camera: { center: [-76.05, 1.85], zoom: 9.2, bearing: 20, pitch: 60 },
      focus: { siteRoles: ['origin'] },
      metrics: [
        { id: 'highest-farm', label: 'Highest origin', format: 'meters', source: { kind: 'max', entity: 'site', field: 'elevationMeters', filter: { siteRoles: ['origin'] } } },
        { id: 'average-altitude', label: 'Average origin altitude', format: 'meters', source: { kind: 'avg', entity: 'site', field: 'elevationMeters', filter: { siteRoles: ['origin'] } } },
      ],
      terrain: true,
      duration: 6000,
    },
    {
      id: 'export',
      eyebrow: 'First mile',
      title: 'Down the mountain to the port',
      body: 'Milled and bagged green coffee travels by truck and rail to three export ports. These inland legs look short on the map, but mountain roads and export paperwork set the pace.',
      camera: { center: [-20, 2], zoom: 2.1, bearing: 0, pitch: 20 },
      focus: { siteCodes: [...ORIGIN_CODES, ...EXPORT_PORT_CODES], routeCodes: INLAND_ROUTE_CODES, fit: true },
      metrics: [
        { id: 'longest-inland-leg', label: 'Longest inland leg', format: 'days', source: { kind: 'max', entity: 'route', field: 'transitDays', filter: { routeCodes: INLAND_ROUTE_CODES } } },
        { id: 'tonnes-to-port', label: 'Moved to port each year', format: 'tonnes', source: { kind: 'sum', entity: 'route', field: 'annualVolumeTonnes', filter: { routeCodes: INLAND_ROUTE_CODES } } },
      ],
      animateRoutes: true,
      duration: 5000,
    },
    {
      id: 'crossing',
      eyebrow: 'Ocean freight',
      title: 'Three sea lanes, one destination',
      body: 'Containers leave Cartagena, Djibouti, and Santos on scheduled liner services bound for Hamburg. Sea freight is the longest and heaviest stage of the journey, so lane reliability drives inventory planning at the roastery.',
      camera: { center: [-15, 25], zoom: 2.2, bearing: 0, pitch: 25 },
      focus: { siteCodes: [...EXPORT_PORT_CODES, 'port-hamburg'], routeCodes: SEA_ROUTE_CODES },
      metrics: [
        { id: 'sea-tonnes', label: 'Shipped by sea each year', format: 'tonnes', source: { kind: 'sum', entity: 'route', field: 'annualVolumeTonnes', filter: { routeCodes: SEA_ROUTE_CODES } } },
        { id: 'longest-crossing', label: 'Longest crossing', format: 'days', source: { kind: 'max', entity: 'route', field: 'transitDays', filter: { routeCodes: SEA_ROUTE_CODES } } },
      ],
      animateRoutes: true,
      duration: 6000,
    },
    {
      id: 'roastery',
      eyebrow: 'Roasting',
      title: 'Roasted on the Elbe',
      body: 'Every lot converges on the Hamburg roastery, minutes from the container terminals. Green coffee is cupped, blended, and roasted to order, so beans leave fresh rather than sitting in a warehouse.',
      camera: { center: [10.077, 53.535], zoom: 15.3, bearing: -20, pitch: 55 },
      focus: { siteCodes: ['plant-hamburg', 'port-hamburg'], routeCodes: ['road-port-roastery'] },
      metrics: [
        { id: 'roasting-capacity', label: 'Annual roasting capacity', format: 'tonnes', source: { kind: 'sum', entity: 'site', field: 'capacityTonnes', filter: { siteCodes: ['plant-hamburg'] } } },
      ],
      duration: 7000,
    },
    {
      id: 'distribution',
      eyebrow: 'Distribution',
      title: 'Fanning out across Europe',
      body: 'Roasted coffee moves by rail and road to regional distribution centers. Each one holds a few days of stock, so cafés can reorder in the evening and receive fresh coffee the next morning.',
      camera: { center: [8.5, 51], zoom: 4.2, bearing: -10, pitch: 35 },
      focus: { siteCodes: ['plant-hamburg'], siteRoles: ['distribution'], routeCodes: DC_ROUTE_CODES },
      metrics: [
        { id: 'dc-count', label: 'Distribution centers', format: 'count', source: { kind: 'count', entity: 'site', filter: { siteRoles: ['distribution'] } } },
        { id: 'dc-tonnes', label: 'Roasted coffee distributed', format: 'tonnes', source: { kind: 'sum', entity: 'route', field: 'annualVolumeTonnes', filter: { routeCodes: DC_ROUTE_CODES } } },
      ],
      animateRoutes: true,
      duration: 6000,
    },
    {
      id: 'customers',
      eyebrow: 'Last mile',
      title: 'Into the cup',
      body: 'From each distribution center, delivery vans serve cafés, hotels, and workplace accounts in major European cities. This is where freshness becomes a promise to the customer.',
      camera: { center: [7.5, 49.5], zoom: 4.5, bearing: 12, pitch: 45 },
      focus: { siteRoles: ['distribution', 'customer'], routeCodePrefixes: ['lastmile-'] },
      metrics: [
        { id: 'outlets', label: 'Outlets served', format: 'count', source: { kind: 'sum', entity: 'site', field: 'outlets', filter: { siteRoles: ['customer'] } } },
        { id: 'customer-accounts', label: 'Customer accounts', format: 'count', source: { kind: 'count', entity: 'site', filter: { siteRoles: ['customer'] } } },
      ],
      animateRoutes: true,
      duration: 5000,
    },
    {
      id: 'recap',
      eyebrow: 'Recap',
      title: 'One network, end to end',
      body: 'Three origins, one roastery, and a European distribution web, mapped together so planners can weigh volume, transit time, and emissions in one view.',
      camera: { center: [-5, 16], zoom: 2, bearing: 0, pitch: 0 },
      focus: WHOLE_NETWORK,
      metrics: [
        { id: 'origin-count', label: 'Origin regions', format: 'count', source: { kind: 'count', entity: 'site', filter: { siteCodes: ORIGIN_CODES } } },
        { id: 'imported-tonnes', label: 'Coffee imported each year', format: 'tonnes', source: { kind: 'sum', entity: 'route', field: 'annualVolumeTonnes', filter: { routeCodes: SEA_ROUTE_CODES } } },
        { id: 'logistics-co2', label: 'Logistics CO₂ each year', format: 'tonnes', source: { kind: 'sum', entity: 'route', field: 'co2Tonnes', filter: WHOLE_NETWORK } },
      ],
      duration: 5000,
    },
  ],
};
