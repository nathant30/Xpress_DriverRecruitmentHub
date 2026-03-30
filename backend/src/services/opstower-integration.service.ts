import { prisma } from '../server.js';
import { appConfig } from '../config/app.config.js';
import { Candidate, CandidateDocument, PipelineStage, ServiceType } from '@prisma/client';
import axios from 'axios';

// OpsTower API Client
const opstowerApi = axios.create({
  baseURL: appConfig.opstowerApiUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': appConfig.opstowerApiKey || '',
  },
});

// Request interceptor for auth
opstowerApi.interceptors.request.use((config) => {
  // Add auth token if using JWT instead of API key
  // config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface OpsTowerDriver {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: Date;
  address?: string;
  zoneId: string;
  serviceType: string;
  status: 'PENDING' | 'TRAINING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  documents: OpsTowerDocument[];
  createdAt: Date;
}

interface OpsTowerDocument {
  type: string;
  fileUrl: string;
  verifiedAt?: Date;
  verifiedBy?: string;
}

interface CreateDriverPayload {
  personalInfo: {
    fullName: string;
    phone: string;
    email?: string;
    dateOfBirth?: string;
    address?: string;
  };
  workInfo: {
    zoneId: string;
    serviceType: string;
    employmentType: string;
  };
  documents: Array<{
    type: string;
    fileUrl: string;
    ocrData?: any;
  }>;
  source: {
    channel: string;
    referralId?: string;
    recruitmentHubCandidateId: string;
  };
}

export class OpsTowerIntegrationService {
  /**
   * Main method: Transfer a candidate from Recruitment Hub to OpsTower
   * This creates the driver record and syncs all data
   */
  static async transferCandidateToOpsTower(candidateId: string): Promise<{
    success: boolean;
    driverId?: string;
    error?: string;
  }> {
    try {
      // 1. Fetch complete candidate data
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          documents: true,
          zone: true,
          interactionLogs: {
            orderBy: { loggedAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!candidate) {
        return { success: false, error: 'Candidate not found' };
      }

      if (!candidate.documents || candidate.documents.length === 0) {
        return { success: false, error: 'No documents to transfer' };
      }

      // Check if all required documents are approved
      const unapprovedDocs = candidate.documents.filter(
        (d) => d.status !== 'APPROVED' && d.status !== 'SKIPPED_EXISTING_DRIVER'
      );
      
      if (unapprovedDocs.length > 0) {
        return { 
          success: false, 
          error: `${unapprovedDocs.length} documents not yet approved` 
        };
      }

      // 2. Prepare payload for OpsTower
      const payload = this.buildDriverPayload(candidate);

      // 3. Create driver in OpsTower
      const driver = await this.createDriverInOpsTower(payload);

      // 4. Update candidate record with driver_id
      await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          opstowerDriverId: driver.id,
          currentStage: PipelineStage.ONBOARDED,
          stageEnteredAt: new Date(),
        },
      });

      // 5. Log the integration event
      await prisma.candidateInteractionLog.create({
        data: {
          candidateId,
          recruiterId: candidate.assignedRecruiterId || 'system',
          interactionDate: new Date(),
          interactionType: 'NOTE',
          outcome: 'STAGE_ADVANCED',
          summary: `Successfully transferred to OpsTower. Driver ID: ${driver.id}`,
          stageBefore: PipelineStage.CONTRACT_SIGNING,
          stageAfter: PipelineStage.ONBOARDED,
          editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // 6. Notify Marketing Hub of successful driver onboarding (for referral bonuses)
      await this.notifyMarketingHub(candidate);

      return { success: true, driverId: driver.id };
    } catch (error: any) {
      console.error('OpsTower transfer failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Transfer failed' 
      };
    }
  }

  /**
   * Build the driver payload from candidate data
   */
  private static buildDriverPayload(candidate: Candidate & { 
    documents: CandidateDocument[];
    zone: { id: string; name: string };
  }): CreateDriverPayload {
    return {
      personalInfo: {
        fullName: candidate.fullName,
        phone: candidate.phonePrimary,
        email: candidate.email || undefined,
        dateOfBirth: candidate.dateOfBirth?.toISOString(),
        address: candidate.address || undefined,
      },
      workInfo: {
        zoneId: candidate.zoneId,
        serviceType: this.mapServiceType(candidate.serviceType),
        employmentType: candidate.employmentType || 'CONTRACTOR',
      },
      documents: candidate.documents
        .filter((d) => d.status === 'APPROVED' && d.fileUrl)
        .map((d) => ({
          type: this.mapDocumentType(d.documentType),
          fileUrl: d.fileUrl!,
          ocrData: d.ocrExtractedData,
        })),
      source: {
        channel: 'RECRUITMENT_HUB',
        referralId: candidate.sourceReferringDriverId || undefined,
        recruitmentHubCandidateId: candidate.id,
      },
    };
  }

  /**
   * Create driver in OpsTower via API
   */
  private static async createDriverInOpsTower(payload: CreateDriverPayload): Promise<OpsTowerDriver> {
    // If no OpsTower URL configured, create a mock driver (for development)
    if (!appConfig.opstowerApiUrl) {
      console.log('⚠️ No OpsTower API configured, creating mock driver');
      return this.createMockDriver(payload);
    }

    const response = await opstowerApi.post('/drivers', payload);
    return response.data;
  }

  /**
   * Mock driver creation for development/testing
   */
  private static createMockDriver(payload: CreateDriverPayload): OpsTowerDriver {
    const mockId = `DRV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    return {
      id: mockId,
      fullName: payload.personalInfo.fullName,
      phone: payload.personalInfo.phone,
      email: payload.personalInfo.email,
      dateOfBirth: payload.personalInfo.dateOfBirth ? new Date(payload.personalInfo.dateOfBirth) : undefined,
      address: payload.personalInfo.address,
      zoneId: payload.workInfo.zoneId,
      serviceType: payload.workInfo.serviceType,
      status: 'TRAINING',
      documents: payload.documents.map(d => ({
        type: d.type,
        fileUrl: d.fileUrl,
        verifiedAt: new Date(),
        verifiedBy: 'system',
      })),
      createdAt: new Date(),
    };
  }

  /**
   * Sync a single document to OpsTower
   */
  static async syncDocumentToOpsTower(
    driverId: string, 
    document: CandidateDocument
  ): Promise<boolean> {
    try {
      if (!appConfig.opstowerApiUrl) {
        console.log('⚠️ No OpsTower API configured, skipping document sync');
        return true;
      }

      await opstowerApi.post(`/drivers/${driverId}/documents`, {
        type: this.mapDocumentType(document.documentType),
        fileUrl: document.fileUrl,
        ocrData: document.ocrExtractedData,
        uploadedAt: document.submittedAt,
        verifiedAt: document.reviewedAt,
      });

      return true;
    } catch (error) {
      console.error('Document sync failed:', error);
      return false;
    }
  }

  /**
   * Validate that a driver ID exists in OpsTower
   */
  static async validateDriverId(driverId: string): Promise<{
    exists: boolean;
    status?: string;
    isActive?: boolean;
  }> {
    try {
      if (!appConfig.opstowerApiUrl) {
        // Mock validation for development
        return { exists: true, status: 'TRAINING', isActive: true };
      }

      const response = await opstowerApi.get(`/drivers/${driverId}`);
      const driver = response.data;

      return {
        exists: true,
        status: driver.status,
        isActive: ['TRAINING', 'ACTIVE'].includes(driver.status),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Handle OpsTower webhooks for bidirectional sync
   */
  static async handleWebhook(event: string, payload: any): Promise<void> {
    switch (event) {
      case 'driver.activated':
        await this.handleDriverActivated(payload);
        break;
      
      case 'driver.suspended':
        await this.handleDriverSuspended(payload);
        break;
      
      case 'driver.updated':
        await this.handleDriverUpdated(payload);
        break;
      
      case 'document.verified':
        await this.handleDocumentVerified(payload);
        break;
      
      default:
        console.log(`Unhandled OpsTower webhook event: ${event}`);
    }
  }

  /**
   * Handle driver activated webhook
   */
  private static async handleDriverActivated(payload: { driverId: string }): Promise<void> {
    const candidate = await prisma.candidate.findFirst({
      where: { opstowerDriverId: payload.driverId },
    });

    if (candidate && candidate.currentStage !== 'ONBOARDED') {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          currentStage: PipelineStage.ONBOARDED,
          stageEnteredAt: new Date(),
        },
      });

      await prisma.candidateInteractionLog.create({
        data: {
          candidateId: candidate.id,
          recruiterId: 'system',
          interactionDate: new Date(),
          interactionType: 'NOTE',
          outcome: 'POSITIVE',
          summary: 'Driver activated in OpsTower',
          stageBefore: candidate.currentStage,
          stageAfter: PipelineStage.ONBOARDED,
          editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  /**
   * Handle driver suspended webhook
   */
  private static async handleDriverSuspended(payload: { driverId: string; reason: string }): Promise<void> {
    const candidate = await prisma.candidate.findFirst({
      where: { opstowerDriverId: payload.driverId },
    });

    if (candidate) {
      await prisma.candidateInteractionLog.create({
        data: {
          candidateId: candidate.id,
          recruiterId: 'system',
          interactionDate: new Date(),
          interactionType: 'NOTE',
          outcome: 'NEEDS_FOLLOWUP',
          summary: `Driver suspended in OpsTower: ${payload.reason}`,
          stageBefore: candidate.currentStage,
          stageAfter: candidate.currentStage,
          editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  /**
   * Handle driver updated webhook
   */
  private static async handleDriverUpdated(payload: { driverId: string; changes: any }): Promise<void> {
    // Sync any relevant changes back to Recruitment Hub
    // This could include phone number updates, zone changes, etc.
    console.log(`Driver ${payload.driverId} updated in OpsTower:`, payload.changes);
  }

  /**
   * Handle document verified webhook
   */
  private static async handleDocumentVerified(payload: { 
    driverId: string; 
    documentType: string;
    verifiedAt: string;
  }): Promise<void> {
    // If a document is verified in OpsTower, sync status back
    const candidate = await prisma.candidate.findFirst({
      where: { opstowerDriverId: payload.driverId },
      include: { documents: true },
    });

    if (candidate) {
      const document = candidate.documents.find(
        (d) => this.mapDocumentType(d.documentType) === payload.documentType
      );

      if (document && document.status !== 'APPROVED') {
        await prisma.candidateDocument.update({
          where: { id: document.id },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(payload.verifiedAt),
            reviewedBy: 'opstower_sync',
          },
        });
      }
    }
  }

  /**
   * Notify Marketing Hub of successful driver onboarding
   * This triggers referral bonuses, etc.
   */
  private static async notifyMarketingHub(candidate: Candidate): Promise<void> {
    if (!appConfig.marketingHubApiUrl) return;

    try {
      await axios.post(`${appConfig.marketingHubApiUrl}/webhooks/driver-onboarded`, {
        driverId: candidate.opstowerDriverId,
        candidateId: candidate.id,
        sourceChannel: candidate.sourceChannel,
        sourceReferringDriverId: candidate.sourceReferringDriverId,
        zoneId: candidate.zoneId,
        serviceType: candidate.serviceType,
        onboardedAt: new Date().toISOString(),
      }, {
        headers: {
          'X-API-Key': appConfig.marketingHubApiKey || '',
        },
      });
    } catch (error) {
      console.error('Failed to notify Marketing Hub:', error);
      // Non-blocking - don't fail the transfer if notification fails
    }
  }

  /**
   * Map Recruitment Hub service type to OpsTower service type
   */
  private static mapServiceType(serviceType: ServiceType): string {
    const mapping: Record<ServiceType, string> = {
      'MOTO': 'MOTORCYCLE',
      'SEDAN_SUV': 'TNVS',
      'TAXI': 'TAXI',
      'ETRIKE': 'ETRIKE',
      'DELIVERY': 'DELIVERY',
    };
    return mapping[serviceType] || serviceType;
  }

  /**
   * Map Recruitment Hub document type to OpsTower document type
   */
  private static mapDocumentType(docType: string): string {
    const mapping: Record<string, string> = {
      'GOVERNMENT_ID': 'GOVERNMENT_ID',
      'DRIVERS_LICENSE': 'DRIVERS_LICENSE',
      'NBI_CLEARANCE': 'NBI_CLEARANCE',
      'PROOF_OF_ADDRESS': 'PROOF_OF_ADDRESS',
      'VEHICLE_OR_CR': 'VEHICLE_REGISTRATION',
      'VEHICLE_PHOTO_FRONT': 'VEHICLE_PHOTO',
      'VEHICLE_PHOTO_REAR': 'VEHICLE_PHOTO',
      'INSURANCE_CERTIFICATE': 'INSURANCE',
      'LTFRB_FRANCHISE': 'FRANCHISE',
      'MEDICAL_CERTIFICATE': 'MEDICAL',
      'DRUG_TEST_RESULT': 'DRUG_TEST',
      'SELFIE_PHOTO': 'SELFIE',
      'FOOD_HANDLING_CERTIFICATE': 'FOOD_HANDLING',
      'CONTRACT': 'DRIVER_CONTRACT',
      'BANK_DOCUMENT': 'BANK_INFO',
    };
    return mapping[docType] || docType;
  }

  /**
   * Get sync status for a candidate
   */
  static async getSyncStatus(candidateId: string): Promise<{
    isSynced: boolean;
    driverId?: string;
    lastSyncAt?: Date;
    syncErrors?: string[];
  }> {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        opstowerDriverId: true,
        currentStage: true,
        updatedAt: true,
      },
    });

    if (!candidate) {
      return { isSynced: false, syncErrors: ['Candidate not found'] };
    }

    const isSynced = !!candidate.opstowerDriverId && candidate.currentStage === 'ONBOARDED';

    return {
      isSynced,
      driverId: candidate.opstowerDriverId || undefined,
      lastSyncAt: candidate.updatedAt,
    };
  }
}
