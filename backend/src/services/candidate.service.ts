import { ServiceType, DocumentType } from '@prisma/client';
import { prisma } from '../server.js';

// Document requirements by service type
const DOCUMENT_REQUIREMENTS: Record<ServiceType, DocumentType[]> = {
  MOTO: [
    DocumentType.GOVERNMENT_ID,
    DocumentType.SELFIE_PHOTO,
    DocumentType.NBI_CLEARANCE,
    DocumentType.PROOF_OF_ADDRESS,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.VEHICLE_OR_CR,
    DocumentType.VEHICLE_PHOTO_FRONT,
    DocumentType.VEHICLE_PHOTO_REAR,
    DocumentType.INSURANCE_CERTIFICATE,
  ],
  SEDAN_SUV: [
    DocumentType.GOVERNMENT_ID,
    DocumentType.SELFIE_PHOTO,
    DocumentType.NBI_CLEARANCE,
    DocumentType.PROOF_OF_ADDRESS,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.VEHICLE_OR_CR,
    DocumentType.VEHICLE_PHOTO_FRONT,
    DocumentType.VEHICLE_PHOTO_REAR,
    DocumentType.INSURANCE_CERTIFICATE,
    DocumentType.LTFRB_FRANCHISE,
  ],
  TAXI: [
    DocumentType.GOVERNMENT_ID,
    DocumentType.SELFIE_PHOTO,
    DocumentType.NBI_CLEARANCE,
    DocumentType.PROOF_OF_ADDRESS,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.LTFRB_FRANCHISE,
    DocumentType.MEDICAL_CERTIFICATE,
    DocumentType.DRUG_TEST_RESULT,
  ],
  ETRIKE: [
    DocumentType.GOVERNMENT_ID,
    DocumentType.SELFIE_PHOTO,
    DocumentType.NBI_CLEARANCE,
    DocumentType.PROOF_OF_ADDRESS,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.VEHICLE_OR_CR,
    DocumentType.VEHICLE_PHOTO_FRONT,
    DocumentType.LTFRB_FRANCHISE,
  ],
  DELIVERY: [
    DocumentType.GOVERNMENT_ID,
    DocumentType.SELFIE_PHOTO,
    DocumentType.NBI_CLEARANCE,
    DocumentType.PROOF_OF_ADDRESS,
    DocumentType.DRIVERS_LICENSE,
    DocumentType.VEHICLE_OR_CR,
    DocumentType.FOOD_HANDLING_CERTIFICATE,
  ],
};

// Documents that require OCR
const OCR_DOCUMENTS = [
  DocumentType.DRIVERS_LICENSE,
  DocumentType.NBI_CLEARANCE,
  DocumentType.VEHICLE_OR_CR,
  DocumentType.GOVERNMENT_ID,
];

export class CandidateService {
  /**
   * Create document checklist for a candidate based on service type
   */
  static async createDocumentChecklist(candidateId: string, serviceType: ServiceType): Promise<void> {
    const requiredDocs = DOCUMENT_REQUIREMENTS[serviceType] || DOCUMENT_REQUIREMENTS.MOTO;

    await prisma.candidateDocument.createMany({
      data: requiredDocs.map((docType) => ({
        candidateId,
        documentType: docType,
        status: 'NOT_SUBMITTED' as const,
      })),
    });
  }

  /**
   * Calculate document completion percentage
   */
  static async getDocumentProgress(candidateId: string): Promise<{ total: number; approved: number; percentage: number }> {
    const [total, approved] = await Promise.all([
      prisma.candidateDocument.count({ where: { candidateId } }),
      prisma.candidateDocument.count({ where: { candidateId, status: 'APPROVED' } }),
    ]);

    return {
      total,
      approved,
      percentage: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }

  /**
   * Check if all required documents are submitted
   */
  static async areAllDocumentsSubmitted(candidateId: string): Promise<boolean> {
    const pendingDocs = await prisma.candidateDocument.count({
      where: { 
        candidateId, 
        status: { in: ['NOT_SUBMITTED', 'REJECTED'] } 
      },
    });
    return pendingDocs === 0;
  }

  /**
   * Get SLA status for a candidate
   */
  static getSlaStatus(stageEnteredAt: Date, slaDays: number): {
    daysInStage: number;
    slaPercent: number;
    status: 'green' | 'amber' | 'red';
  } {
    const now = new Date();
    const daysInStage = Math.floor((now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
    const slaPercent = Math.min(100, Math.round((daysInStage / slaDays) * 100));

    let status: 'green' | 'amber' | 'red' = 'green';
    if (slaPercent >= 100) {
      status = 'red';
    } else if (slaPercent >= 80) {
      status = 'amber';
    }

    return { daysInStage, slaPercent, status };
  }

  /**
   * Get pipeline metrics for dashboard
   */
  static async getPipelineMetrics(zoneIds?: string[]): Promise<{
    stageCounts: Record<string, number>;
    conversionRates: Record<string, number>;
    totalActive: number;
  }> {
    const where = zoneIds ? { zoneId: { in: zoneIds } } : {};

    // Exclude terminal stages
    const activeWhere = {
      ...where,
      currentStage: { notIn: ['ONBOARDED', 'REJECTED', 'WITHDRAWN'] },
    };

    const stageCounts = await prisma.candidate.groupBy({
      by: ['currentStage'],
      where: activeWhere,
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const sc of stageCounts) {
      counts[sc.currentStage] = sc._count.id;
    }

    // Total active
    const totalActive = Object.values(counts).reduce((a, b) => a + b, 0);

    // Conversion rate (applications to onboarded - last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [applications, onboarded] = await Promise.all([
      prisma.candidate.count({
        where: { ...where, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.candidate.count({
        where: { ...where, currentStage: 'ONBOARDED', updatedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const conversionRate = applications > 0 ? Math.round((onboarded / applications) * 100) : 0;

    return {
      stageCounts: counts,
      conversionRates: { applicationToOnboarded: conversionRate },
      totalActive,
    };
  }

  /**
   * Get candidates needing attention (SLA breaches)
   */
  static async getSlaBreaches(zoneIds?: string[]): Promise<Array<{
    id: string;
    fullName: string;
    currentStage: string;
    daysInStage: number;
    slaDays: number;
    assignedRecruiterId: string | null;
  }>> {
    // SLA configuration by stage
    const SLA_DAYS: Record<string, number> = {
      APPLICATION: 1,
      SCREENING: 3,
      DOCS_SUBMITTED: 5,
      DOCS_VERIFIED: 3,
      BACKGROUND_CHECK: 7,
      TRAINING: 14,
      VEHICLE_INSPECTION: 5,
      CONTRACT_SIGNING: 3,
    };

    const candidates = await prisma.candidate.findMany({
      where: {
        ...(zoneIds ? { zoneId: { in: zoneIds } } : {}),
        currentStage: { notIn: ['ONBOARDED', 'REJECTED', 'WITHDRAWN'] },
      },
      select: {
        id: true,
        fullName: true,
        currentStage: true,
        stageEnteredAt: true,
        assignedRecruiterId: true,
      },
    });

    return candidates
      .map((c) => {
        const slaDays = SLA_DAYS[c.currentStage] || 7;
        const { daysInStage } = this.getSlaStatus(c.stageEnteredAt, slaDays);
        return { ...c, daysInStage, slaDays };
      })
      .filter((c) => c.daysInStage >= c.slaDays * 0.8) // 80% of SLA or more
      .sort((a, b) => b.daysInStage - a.daysInStage);
  }
}
