import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Simple health check
apiRoutes.get('/health', async (c) => {
  return c.json({ 
    success: true, 
    message: 'NEW API is working - simplified version',
    timestamp: new Date().toISOString(),
    version: '2.0'
  });
});

// Test endpoint
apiRoutes.get('/test-new-api', async (c) => {
  return c.json({
    message: 'This is the NEW simplified API',
    working: true,
    timestamp: new Date().toISOString()
  });
});

// Get all nutrients (hardcoded demo data)
apiRoutes.get('/nutrients', async (c) => {
  return c.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Vitamin D3',
        synonyms: ["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"],
        standard_unit: 'IE',
        dge_recommended: 800,
        study_recommended: 2000,
        max_safe_dose: 4000,
        warning_threshold: 4000
      },
      {
        id: 2,
        name: 'Vitamin B12',
        synonyms: ["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin"],
        standard_unit: 'µg',
        dge_recommended: 4,
        study_recommended: 250,
        max_safe_dose: 1000,
        warning_threshold: 1000
      },
      {
        id: 3,
        name: 'Magnesium',
        synonyms: ["Mg", "Magnium"],
        standard_unit: 'mg',
        dge_recommended: 300,
        study_recommended: 400,
        max_safe_dose: 350,
        warning_threshold: 350
      },
      {
        id: 4,
        name: 'Omega-3',
        synonyms: ["Omega 3", "Fischöl", "Algenöl", "Marine Omega"],
        standard_unit: 'mg',
        dge_recommended: 250,
        study_recommended: 1000,
        max_safe_dose: 5000,
        warning_threshold: 5000
      },
      {
        id: 5,
        name: 'Zink',
        synonyms: ["Zn", "Zinc", "Bisglycinat", "Citrat"],
        standard_unit: 'mg',
        dge_recommended: 10,
        study_recommended: 15,
        max_safe_dose: 25,
        warning_threshold: 25
      },
      {
        id: 6,
        name: 'Vitamin C',
        synonyms: ["C", "Ascorbinsäure", "Ester-C"],
        standard_unit: 'mg',
        dge_recommended: 110,
        study_recommended: 1000,
        max_safe_dose: 1000,
        warning_threshold: 1000
      }
    ]
  });
});

// Get nutrient by ID with recommendations
apiRoutes.get('/nutrients/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  
  const nutrients = [
    {
      id: 1,
      name: 'Vitamin D3',
      synonyms: ["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"],
      standard_unit: 'IE',
      dge_recommended: 800,
      study_recommended: 2000,
      max_safe_dose: 4000,
      warning_threshold: 4000
    },
    {
      id: 2,
      name: 'Vitamin B12',
      synonyms: ["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin"],
      standard_unit: 'µg',
      dge_recommended: 4,
      study_recommended: 250,
      max_safe_dose: 1000,
      warning_threshold: 1000
    },
    {
      id: 3,
      name: 'Magnesium',
      synonyms: ["Mg", "Magnium"],
      standard_unit: 'mg',
      dge_recommended: 300,
      study_recommended: 400,
      max_safe_dose: 350,
      warning_threshold: 350
    }
  ];
  
  const nutrient = nutrients.find(n => n.id === id);
  
  if (!nutrient) {
    return c.json({ 
      success: false, 
      error: 'Nährstoff nicht gefunden' 
    }, 404);
  }

  // Build recommendations from existing data
  const recommendations = [];
  
  if (nutrient.dge_recommended) {
    recommendations.push({
      source: 'DGE',
      amount: nutrient.dge_recommended,
      unit: nutrient.standard_unit,
      description: 'Deutsche Gesellschaft für Ernährung Empfehlung'
    });
  }
  
  if (nutrient.study_recommended) {
    recommendations.push({
      source: 'Studien',
      amount: nutrient.study_recommended,
      unit: nutrient.standard_unit,
      description: 'Studienbasierte Empfehlung'
    });
  }

  return c.json({ 
    success: true, 
    data: {
      ...nutrient,
      recommendations: recommendations
    }
  });
});

// Get all categories
apiRoutes.get('/categories', async (c) => {
  return c.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Vitamine',
        description: 'Fettlösliche und wasserlösliche Vitamine',
        sort_order: 1
      },
      {
        id: 2,
        name: 'Mineralstoffe',
        description: 'Mengen- und Spurenelemente',
        sort_order: 2
      },
      {
        id: 3,
        name: 'Aminosäuren',
        description: 'Essentielle und nicht-essentielle Aminosäuren',
        sort_order: 3
      },
      {
        id: 4,
        name: 'Fettsäuren',
        description: 'Omega-3/6/9 Fettsäuren',
        sort_order: 4
      }
    ]
  });
});

// Get guideline sources (hardcoded for demo compatibility)
apiRoutes.get('/guideline-sources', async (c) => {
  return c.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'DGE',
        code: 'dge',
        description: 'Deutsche Gesellschaft für Ernährung'
      },
      {
        id: 2,
        name: 'Studien',
        code: 'studien', 
        description: 'Studienbasierte Empfehlungen'
      },
      {
        id: 3,
        name: 'Influencer',
        code: 'influencer',
        description: 'Influencer Empfehlungen'
      }
    ]
  });
});