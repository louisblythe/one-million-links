UPDATE squares SET category = CASE category
  WHEN 'AI' THEN 'AI Agents & Infrastructure'
  WHEN 'SaaS' THEN 'Productivity & Personal Tools'
  WHEN 'Ecommerce' THEN 'Ecommerce & Retail'
  WHEN 'Agency' THEN 'Agencies, Studios & Services'
  WHEN 'Media' THEN 'Media & News'
  WHEN 'Developer tools' THEN 'Developer Tools'
  WHEN 'Finance' THEN 'Business, Finance & Legal'
  WHEN 'Local business' THEN 'Travel, Local & Lifestyle'
  ELSE category
END;

UPDATE category_sponsorships SET category = CASE category
  WHEN 'AI' THEN 'AI Agents & Infrastructure'
  WHEN 'SaaS' THEN 'Productivity & Personal Tools'
  WHEN 'Ecommerce' THEN 'Ecommerce & Retail'
  WHEN 'Agency' THEN 'Agencies, Studios & Services'
  WHEN 'Media' THEN 'Media & News'
  WHEN 'Developer tools' THEN 'Developer Tools'
  WHEN 'Finance' THEN 'Business, Finance & Legal'
  WHEN 'Local business' THEN 'Travel, Local & Lifestyle'
  ELSE category
END;

UPDATE category_sponsor_payments SET category = CASE category
  WHEN 'AI' THEN 'AI Agents & Infrastructure'
  WHEN 'SaaS' THEN 'Productivity & Personal Tools'
  WHEN 'Ecommerce' THEN 'Ecommerce & Retail'
  WHEN 'Agency' THEN 'Agencies, Studios & Services'
  WHEN 'Media' THEN 'Media & News'
  WHEN 'Developer tools' THEN 'Developer Tools'
  WHEN 'Finance' THEN 'Business, Finance & Legal'
  WHEN 'Local business' THEN 'Travel, Local & Lifestyle'
  ELSE category
END;
