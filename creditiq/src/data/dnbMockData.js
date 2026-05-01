export const mockDnBDatabase = {
  C001: {
    duns: '04-920-1234',
    companyName: 'Apex Manufacturing LLC',
    reportDate: '2026-04-15',
    paydex: {
      score: 80,
      industryMedian: 74,
      paymentBehavior: 'Pays within terms',
    },
    financialStressScore: {
      score: 1423,
      riskLevel: 'Low',
      nationalPercentile: 82,
    },
    delinquencyScore: {
      score: 415,
      probabilityBand: 'Low',
      nationalPercentile: 79,
    },
    failureScore: {
      score: 1654,
      riskLevel: 'Low',
      nationalPercentile: 84,
    },
    dbt: {
      value: 3,
      industryMedian: 8,
    },
    dnbRating: {
      raw: '3A2',
      sizeCode: '3A',
      compositeAppraisal: '2',
      description: 'Good',
    },
    tradelines: {
      totalExperiences: 42,
      satisfactoryCount: 38,
      slowCount: 3,
      negativeCount: 1,
    },
    alerts: [],
  },

  C002: {
    duns: '07-381-5502',
    companyName: 'Brightstone Retail Group Inc',
    reportDate: '2026-04-10',
    paydex: {
      score: 63,
      industryMedian: 70,
      paymentBehavior: 'Pays 15 days beyond terms',
    },
    financialStressScore: {
      score: 1189,
      riskLevel: 'Moderate',
      nationalPercentile: 44,
    },
    delinquencyScore: {
      score: 382,
      probabilityBand: 'Moderate',
      nationalPercentile: 41,
    },
    failureScore: {
      score: 1210,
      riskLevel: 'Moderate',
      nationalPercentile: 47,
    },
    dbt: {
      value: 18,
      industryMedian: 11,
    },
    dnbRating: {
      raw: '1A3',
      sizeCode: '1A',
      compositeAppraisal: '3',
      description: 'Fair',
    },
    tradelines: {
      totalExperiences: 27,
      satisfactoryCount: 19,
      slowCount: 6,
      negativeCount: 2,
    },
    alerts: ['Payment slowdown detected in last 90 days'],
  },

  C003: {
    duns: '11-004-7891',
    companyName: 'Crestview Logistics Partners',
    reportDate: '2026-03-28',
    paydex: {
      score: 49,
      industryMedian: 67,
      paymentBehavior: 'Pays 30 days beyond terms',
    },
    financialStressScore: {
      score: 987,
      riskLevel: 'High',
      nationalPercentile: 21,
    },
    delinquencyScore: {
      score: 298,
      probabilityBand: 'High',
      nationalPercentile: 18,
    },
    failureScore: {
      score: 1042,
      riskLevel: 'High',
      nationalPercentile: 23,
    },
    dbt: {
      value: 34,
      industryMedian: 9,
    },
    dnbRating: {
      raw: 'BA4',
      sizeCode: 'BA',
      compositeAppraisal: '4',
      description: 'Limited',
    },
    tradelines: {
      totalExperiences: 18,
      satisfactoryCount: 9,
      slowCount: 6,
      negativeCount: 3,
    },
    alerts: ['Collection account reported', 'Judgment filed Q1 2026'],
  },

  C004: {
    duns: '09-552-3317',
    companyName: 'Delta Precision Components',
    reportDate: '2026-04-20',
    paydex: {
      score: 90,
      industryMedian: 76,
      paymentBehavior: 'Pays within terms, some discounts taken',
    },
    financialStressScore: {
      score: 1731,
      riskLevel: 'Low',
      nationalPercentile: 93,
    },
    delinquencyScore: {
      score: 458,
      probabilityBand: 'Low',
      nationalPercentile: 91,
    },
    failureScore: {
      score: 1802,
      riskLevel: 'Low',
      nationalPercentile: 95,
    },
    dbt: {
      value: 0,
      industryMedian: 7,
    },
    dnbRating: {
      raw: '4A1',
      sizeCode: '4A',
      compositeAppraisal: '1',
      description: 'High',
    },
    tradelines: {
      totalExperiences: 61,
      satisfactoryCount: 61,
      slowCount: 0,
      negativeCount: 0,
    },
    alerts: [],
  },

  C005: {
    duns: '06-118-9043',
    companyName: 'Eastfield Construction Services',
    reportDate: '2026-04-05',
    paydex: {
      score: 72,
      industryMedian: 68,
      paymentBehavior: 'Pays within terms',
    },
    financialStressScore: {
      score: 1344,
      riskLevel: 'Low',
      nationalPercentile: 67,
    },
    delinquencyScore: {
      score: 401,
      probabilityBand: 'Low',
      nationalPercentile: 63,
    },
    failureScore: {
      score: 1388,
      riskLevel: 'Low',
      nationalPercentile: 70,
    },
    dbt: {
      value: 7,
      industryMedian: 12,
    },
    dnbRating: {
      raw: '2A2',
      sizeCode: '2A',
      compositeAppraisal: '2',
      description: 'Good',
    },
    tradelines: {
      totalExperiences: 33,
      satisfactoryCount: 30,
      slowCount: 2,
      negativeCount: 1,
    },
    alerts: [],
  },

  C006: {
    duns: '14-773-6620',
    companyName: 'FrontRange Healthcare Solutions',
    reportDate: '2026-04-18',
    paydex: {
      score: 55,
      industryMedian: 72,
      paymentBehavior: 'Pays 22 days beyond terms',
    },
    financialStressScore: {
      score: 1098,
      riskLevel: 'Moderate',
      nationalPercentile: 33,
    },
    delinquencyScore: {
      score: 341,
      probabilityBand: 'Moderate',
      nationalPercentile: 30,
    },
    failureScore: {
      score: 1155,
      riskLevel: 'Moderate',
      nationalPercentile: 36,
    },
    dbt: {
      value: 24,
      industryMedian: 10,
    },
    dnbRating: {
      raw: 'BB3',
      sizeCode: 'BB',
      compositeAppraisal: '3',
      description: 'Fair',
    },
    tradelines: {
      totalExperiences: 22,
      satisfactoryCount: 14,
      slowCount: 5,
      negativeCount: 3,
    },
    alerts: ['Significant payment slowdown vs prior year'],
  },

  C007: {
    duns: '03-294-8801',
    companyName: 'Granite Peak Technology Corp',
    reportDate: '2026-04-12',
    paydex: {
      score: 85,
      industryMedian: 79,
      paymentBehavior: 'Pays within terms',
    },
    financialStressScore: {
      score: 1589,
      riskLevel: 'Low',
      nationalPercentile: 88,
    },
    delinquencyScore: {
      score: 441,
      probabilityBand: 'Low',
      nationalPercentile: 86,
    },
    failureScore: {
      score: 1620,
      riskLevel: 'Low',
      nationalPercentile: 89,
    },
    dbt: {
      value: 2,
      industryMedian: 6,
    },
    dnbRating: {
      raw: '3A1',
      sizeCode: '3A',
      compositeAppraisal: '1',
      description: 'High',
    },
    tradelines: {
      totalExperiences: 54,
      satisfactoryCount: 52,
      slowCount: 2,
      negativeCount: 0,
    },
    alerts: [],
  },

  C008: {
    duns: '08-661-2294',
    companyName: 'Harbor View Wholesale Distributors',
    reportDate: '2026-03-31',
    paydex: {
      score: 38,
      industryMedian: 65,
      paymentBehavior: 'Pays 60+ days beyond terms',
    },
    financialStressScore: {
      score: 812,
      riskLevel: 'Very High',
      nationalPercentile: 9,
    },
    delinquencyScore: {
      score: 211,
      probabilityBand: 'Very High',
      nationalPercentile: 7,
    },
    failureScore: {
      score: 879,
      riskLevel: 'Very High',
      nationalPercentile: 10,
    },
    dbt: {
      value: 67,
      industryMedian: 13,
    },
    dnbRating: {
      raw: 'CB4',
      sizeCode: 'CB',
      compositeAppraisal: '4',
      description: 'Limited',
    },
    tradelines: {
      totalExperiences: 14,
      satisfactoryCount: 4,
      slowCount: 5,
      negativeCount: 5,
    },
    alerts: [
      'Tax lien filed March 2026',
      'Multiple collection accounts',
      'Suit filed by creditor',
    ],
  },

  C009: {
    duns: '12-405-5567',
    companyName: 'Ironwood Capital Advisors',
    reportDate: '2026-04-22',
    paydex: {
      score: 76,
      industryMedian: 73,
      paymentBehavior: 'Pays within terms',
    },
    financialStressScore: {
      score: 1412,
      riskLevel: 'Low',
      nationalPercentile: 74,
    },
    delinquencyScore: {
      score: 419,
      probabilityBand: 'Low',
      nationalPercentile: 72,
    },
    failureScore: {
      score: 1444,
      riskLevel: 'Low',
      nationalPercentile: 76,
    },
    dbt: {
      value: 5,
      industryMedian: 8,
    },
    dnbRating: {
      raw: '2A2',
      sizeCode: '2A',
      compositeAppraisal: '2',
      description: 'Good',
    },
    tradelines: {
      totalExperiences: 38,
      satisfactoryCount: 35,
      slowCount: 3,
      negativeCount: 0,
    },
    alerts: [],
  },

  C010: {
    duns: '05-839-1102',
    companyName: 'Juniper Valley Foods Inc',
    reportDate: '2026-04-08',
    paydex: {
      score: 61,
      industryMedian: 69,
      paymentBehavior: 'Pays 18 days beyond terms',
    },
    financialStressScore: {
      score: 1162,
      riskLevel: 'Moderate',
      nationalPercentile: 40,
    },
    delinquencyScore: {
      score: 368,
      probabilityBand: 'Moderate',
      nationalPercentile: 37,
    },
    failureScore: {
      score: 1190,
      riskLevel: 'Moderate',
      nationalPercentile: 42,
    },
    dbt: {
      value: 20,
      industryMedian: 11,
    },
    dnbRating: {
      raw: '1A3',
      sizeCode: '1A',
      compositeAppraisal: '3',
      description: 'Fair',
    },
    tradelines: {
      totalExperiences: 24,
      satisfactoryCount: 17,
      slowCount: 5,
      negativeCount: 2,
    },
    alerts: ['Slight increase in slow payment trend'],
  },

  C011: {
    duns: '16-047-3388',
    companyName: 'Keystone Industrial Supply',
    reportDate: '2026-04-17',
    paydex: {
      score: 94,
      industryMedian: 77,
      paymentBehavior: 'Pays promptly, often takes discounts',
    },
    financialStressScore: {
      score: 1789,
      riskLevel: 'Low',
      nationalPercentile: 97,
    },
    delinquencyScore: {
      score: 471,
      probabilityBand: 'Low',
      nationalPercentile: 96,
    },
    failureScore: {
      score: 1844,
      riskLevel: 'Low',
      nationalPercentile: 97,
    },
    dbt: {
      value: 0,
      industryMedian: 9,
    },
    dnbRating: {
      raw: '5A1',
      sizeCode: '5A',
      compositeAppraisal: '1',
      description: 'High',
    },
    tradelines: {
      totalExperiences: 78,
      satisfactoryCount: 78,
      slowCount: 0,
      negativeCount: 0,
    },
    alerts: [],
  },

  C012: {
    duns: '10-223-7744',
    companyName: 'Lakeshore Media Ventures',
    reportDate: '2026-03-20',
    paydex: {
      score: 44,
      industryMedian: 66,
      paymentBehavior: 'Pays 45 days beyond terms',
    },
    financialStressScore: {
      score: 901,
      riskLevel: 'High',
      nationalPercentile: 14,
    },
    delinquencyScore: {
      score: 264,
      probabilityBand: 'High',
      nationalPercentile: 12,
    },
    failureScore: {
      score: 958,
      riskLevel: 'High',
      nationalPercentile: 15,
    },
    dbt: {
      value: 52,
      industryMedian: 10,
    },
    dnbRating: {
      raw: 'BA4',
      sizeCode: 'BA',
      compositeAppraisal: '4',
      description: 'Limited',
    },
    tradelines: {
      totalExperiences: 16,
      satisfactoryCount: 7,
      slowCount: 5,
      negativeCount: 4,
    },
    alerts: ['UCC filing active', 'Collection action initiated'],
  },

  C013: {
    duns: '13-760-9921',
    companyName: 'Meridian Staffing Solutions LLC',
    reportDate: '2026-04-14',
    paydex: {
      score: 79,
      industryMedian: 71,
      paymentBehavior: 'Pays within terms',
    },
    financialStressScore: {
      score: 1498,
      riskLevel: 'Low',
      nationalPercentile: 78,
    },
    delinquencyScore: {
      score: 432,
      probabilityBand: 'Low',
      nationalPercentile: 76,
    },
    failureScore: {
      score: 1521,
      riskLevel: 'Low',
      nationalPercentile: 80,
    },
    dbt: {
      value: 4,
      industryMedian: 7,
    },
    dnbRating: {
      raw: '2A2',
      sizeCode: '2A',
      compositeAppraisal: '2',
      description: 'Good',
    },
    tradelines: {
      totalExperiences: 45,
      satisfactoryCount: 42,
      slowCount: 3,
      negativeCount: 0,
    },
    alerts: [],
  },

  C014: {
    duns: '02-589-4416',
    companyName: 'Northgate Energy Resources',
    reportDate: '2026-04-01',
    paydex: {
      score: 68,
      industryMedian: 70,
      paymentBehavior: 'Pays 8 days beyond terms',
    },
    financialStressScore: {
      score: 1271,
      riskLevel: 'Low',
      nationalPercentile: 58,
    },
    delinquencyScore: {
      score: 390,
      probabilityBand: 'Low',
      nationalPercentile: 55,
    },
    failureScore: {
      score: 1305,
      riskLevel: 'Low',
      nationalPercentile: 61,
    },
    dbt: {
      value: 11,
      industryMedian: 10,
    },
    dnbRating: {
      raw: '3A2',
      sizeCode: '3A',
      compositeAppraisal: '2',
      description: 'Good',
    },
    tradelines: {
      totalExperiences: 29,
      satisfactoryCount: 25,
      slowCount: 4,
      negativeCount: 0,
    },
    alerts: [],
  },

  C015: {
    duns: '15-112-8835',
    companyName: 'Oakridge Pharmaceutical Group',
    reportDate: '2026-04-19',
    paydex: {
      score: 57,
      industryMedian: 74,
      paymentBehavior: 'Pays 20 days beyond terms',
    },
    financialStressScore: {
      score: 1044,
      riskLevel: 'Moderate',
      nationalPercentile: 28,
    },
    delinquencyScore: {
      score: 312,
      probabilityBand: 'Moderate',
      nationalPercentile: 25,
    },
    failureScore: {
      score: 1088,
      riskLevel: 'Moderate',
      nationalPercentile: 31,
    },
    dbt: {
      value: 28,
      industryMedian: 12,
    },
    dnbRating: {
      raw: 'BB3',
      sizeCode: 'BB',
      compositeAppraisal: '3',
      description: 'Fair',
    },
    tradelines: {
      totalExperiences: 20,
      satisfactoryCount: 13,
      slowCount: 4,
      negativeCount: 3,
    },
    alerts: ['Pending litigation — contract dispute', 'DBT worsening trend Q1 2026'],
  },
};

export async function mockDnBAPI(customerId) {
  const delay = 800 + Math.random() * 400;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const record = mockDnBDatabase[customerId];
  if (!record) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `No D&B record found for customer ID: ${customerId}`,
    };
  }

  return { error: false, data: record };
}
