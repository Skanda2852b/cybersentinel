export interface RiskFactors {
  baseSeverityWeight: number;
  ruleConfidence: number;
  sourceReputation: number;
  assetCriticality: number;
  timeOfDay: number;
  userBehaviorAnomaly: number;
  mlAnomalyScore: number;
}

export interface RiskBreakdown {
  baseScore: number;
  adjustments: {
    ruleConfidence: number;
    sourceReputation: number;
    assetCriticality: number;
    timeOfDay: number;
    userBehaviorAnomaly: number;
    mlAnomalyScore: number;
  };
  finalScore: number;
}

const WEIGHTS = {
  baseSeverityWeight: 0.30,
  ruleConfidence: 0.10,
  sourceReputation: 0.15,
  assetCriticality: 0.10,
  timeOfDay: 0.10,
  userBehaviorAnomaly: 0.10,
  mlAnomalyScore: 0.15,
};

export class RiskEngine {
  calculate(factors: RiskFactors): number {
    const breakdown = this.getBreakdown(factors);
    return Math.round(Math.min(100, Math.max(0, breakdown.finalScore)));
  }

  getBreakdown(factors: RiskFactors): RiskBreakdown {
    const baseScore = factors.baseSeverityWeight;

    const ruleConfidenceAdj = (factors.ruleConfidence - 0.5) * 20;
    const sourceReputationAdj = (factors.sourceReputation - 0.5) * 30;
    const assetCriticalityAdj = (factors.assetCriticality - 0.5) * 20;
    const timeOfDayAdj = (factors.timeOfDay - 0.5) * 20;
    const userBehaviorAdj = (factors.userBehaviorAnomaly - 0.5) * 20;
    const mlAnomalyAdj = (factors.mlAnomalyScore - 0.5) * 30;

    const adjustments = {
      ruleConfidence: ruleConfidenceAdj,
      sourceReputation: sourceReputationAdj,
      assetCriticality: assetCriticalityAdj,
      timeOfDay: timeOfDayAdj,
      userBehaviorAnomaly: userBehaviorAdj,
      mlAnomalyScore: mlAnomalyAdj,
    };

    const finalScore = baseScore * WEIGHTS.baseSeverityWeight +
      (50 + ruleConfidenceAdj) * WEIGHTS.ruleConfidence +
      (50 + sourceReputationAdj) * WEIGHTS.sourceReputation +
      (50 + assetCriticalityAdj) * WEIGHTS.assetCriticality +
      (50 + timeOfDayAdj) * WEIGHTS.timeOfDay +
      (50 + userBehaviorAdj) * WEIGHTS.userBehaviorAnomaly +
      (50 + mlAnomalyAdj) * WEIGHTS.mlAnomalyScore;

    return {
      baseScore,
      adjustments,
      finalScore: Math.min(100, Math.max(0, finalScore)),
    };
  }

  calculateFromAlert(alert: any, mlAnomalyScore?: number): number {
    const severityWeights = { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, INFO: 10 };
    const baseSeverityWeight = severityWeights[alert.severity as keyof typeof severityWeights] || 10;

    const factors: RiskFactors = {
      baseSeverityWeight,
      ruleConfidence: 0.8,
      sourceReputation: 0.5,
      assetCriticality: 0.5,
      timeOfDay: 0.5,
      userBehaviorAnomaly: 0.5,
      mlAnomalyScore: mlAnomalyScore || 0.5,
    };

    return this.calculate(factors);
  }
}

export const riskEngine = new RiskEngine();