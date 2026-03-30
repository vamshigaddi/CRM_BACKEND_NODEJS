import { Injectable } from '@nestjs/common';
import { LeadUrgency, LeadDataSource } from '../schemas/lead.schema';

@Injectable()
export class LeadScoringService {
  calculateLeadScore(leadData: any): number {
    let score = 10; // Base score

    // 1. Contact Quality (30 points max)
    if (leadData.email) score += 15;
    if (leadData.phoneNumber) score += 15;

    // 2. Intent & Urgency (40 points max)
    if (leadData.intent) {
      if (leadData.intent.urgency === LeadUrgency.HIGH) {
        score += 30;
      } else if (leadData.intent.urgency === LeadUrgency.MEDIUM) {
        score += 15;
      }

      if (leadData.intent.budget && leadData.intent.budget > 1000) {
        score += 10;
      }
    }

    // 3. Company Detail (20 points max)
    if (leadData.company) {
      if (leadData.company.name) score += 10;
      if (leadData.company.website) score += 10;
    }

    // 4. Data Source (10 points max)
    if (leadData.source) {
      if ([LeadDataSource.WHATSAPP, LeadDataSource.WEBSITE].includes(leadData.source)) {
        score += 10;
      }
    }

    return Math.min(Math.max(score, 0), 100);
  }
}
