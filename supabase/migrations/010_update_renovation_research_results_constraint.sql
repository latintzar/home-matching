-- Update renovation_research_results category constraint to allow tier-specific categories
-- Drop the old constraint
ALTER TABLE renovation_research_results DROP CONSTRAINT renovation_research_results_category_check;

-- Add new constraint that allows tier-specific categories
ALTER TABLE renovation_research_results ADD CONSTRAINT renovation_research_results_category_check 
CHECK (
  category IN (
    'costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives',
    'costs_estandar', 'costs_optimo', 'costs_plus',
    'timings_estandar', 'timings_optimo', 'timings_plus', 
    'permits_estandar', 'permits_optimo', 'permits_plus',
    'laws_regulations_estandar', 'laws_regulations_optimo', 'laws_regulations_plus',
    'norms_standards_estandar', 'norms_standards_optimo', 'norms_standards_plus',
    'market_practices_estandar', 'market_practices_optimo', 'market_practices_plus',
    'incentives_estandar', 'incentives_optimo', 'incentives_plus'
  )
);
