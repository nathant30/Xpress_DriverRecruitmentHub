import { Calendar, MapPin, Car } from 'lucide-react';

interface PeriodFilters {
  period: '30d' | '90d' | '6m' | '12m';
  zoneId?: string;
  serviceType?: string;
}

interface Props {
  filters: PeriodFilters;
  onChange: (filters: PeriodFilters) => void;
}

export function FilterBar({ filters, onChange }: Props) {
  const periods = [
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '6m', label: '6 Months' },
    { value: '12m', label: '1 Year' },
  ] as const;

  const serviceTypes = [
    { value: '', label: 'All Services' },
    { value: 'MOTO', label: 'Motorcycle' },
    { value: 'SEDAN_SUV', label: 'Sedan/SUV' },
    { value: 'TAXI', label: 'Taxi' },
    { value: 'ETRIKE', label: 'E-Trike' },
    { value: 'DELIVERY', label: 'Delivery' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period Selector */}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <select
          value={filters.period}
          onChange={(e) => onChange({ ...filters, period: e.target.value as PeriodFilters['period'] })}
          className="pl-9 pr-8 py-2 bg-white border rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Service Type Selector */}
      <div className="relative">
        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <select
          value={filters.serviceType || ''}
          onChange={(e) => onChange({ 
            ...filters, 
            serviceType: e.target.value || undefined 
          })}
          className="pl-9 pr-8 py-2 bg-white border rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {serviceTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Zone Selector - simplified, would be populated from API */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <select
          value={filters.zoneId || ''}
          onChange={(e) => onChange({ 
            ...filters, 
            zoneId: e.target.value || undefined 
          })}
          className="pl-9 pr-8 py-2 bg-white border rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Zones</option>
          <option value="metro-manila">Metro Manila</option>
          <option value="cebu">Cebu</option>
          <option value="davao">Davao</option>
          <option value="pampanga">Pampanga</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      {(filters.zoneId || filters.serviceType) && (
        <button
          onClick={() => onChange({ period: filters.period })}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
