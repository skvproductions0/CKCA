export interface GradingRule {
  grade: string;
  minPercent: number;
  maxPercent: number;
}

export const DEFAULT_GRADING: GradingRule[] = [
  { grade: 'A+', minPercent: 90, maxPercent: 100 },
  { grade: 'A', minPercent: 80, maxPercent: 89.99 },
  { grade: 'B+', minPercent: 70, maxPercent: 79.99 },
  { grade: 'B', minPercent: 60, maxPercent: 69.99 },
  { grade: 'C', minPercent: 50, maxPercent: 59.99 },
  { grade: 'D', minPercent: 40, maxPercent: 49.99 },
  { grade: 'F', minPercent: 0, maxPercent: 39.99 },
];

export function calculateGrade(percentage: number, rules: GradingRule[] = DEFAULT_GRADING): string {
  for (const rule of rules) {
    if (percentage >= rule.minPercent && percentage <= rule.maxPercent) {
      return rule.grade;
    }
  }
  return 'F';
}

export function calculatePercentage(obtained: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((obtained / max) * 10000) / 100;
}

export function calculateResult(percentage: number, passingMarks: number, maxMarks: number): 'PASS' | 'FAIL' {
  const passingPercent = (passingMarks / maxMarks) * 100;
  return percentage >= passingPercent ? 'PASS' : 'FAIL';
}
