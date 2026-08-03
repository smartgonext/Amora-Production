import { useCompany } from '../context/CompanyContext';

export function useCatalogSettings() {
  const { company } = useCompany();
  
  const catalogMode = company?.settings?.business_catalog_type || 'both';

  const isProductOnly = catalogMode === 'product';
  const isServiceOnly = catalogMode === 'service';
  const isBoth = catalogMode === 'both';

  const catalogLabel = isServiceOnly ? 'Services' : isProductOnly ? 'Products' : 'Products & Services';

  return {
    catalogMode,
    isProductOnly,
    isServiceOnly,
    isBoth,
    catalogLabel
  };
}
