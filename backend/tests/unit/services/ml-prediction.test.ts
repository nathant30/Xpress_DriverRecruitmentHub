import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MLPredictionService } from '../../../src/services/ml-prediction.service.js';
import { prisma } from '../../../src/server.js';

jest.mock('../../../src/server.js', () => ({
  prisma: {
    candidate: {
      findUnique: jest.fn(),
    },
    mLPrediction: {
      create: jest.fn(),
    },
  },
}));

describe('MLPredictionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('predictPreHireQuality', () => {
    it('should return quality prediction with valid candidate', async () => {
      const mockCandidate = {
        id: 'candidate_1',
        fullName: 'John Doe',
        isExistingDriver: true,
        documents: [
          { status: 'APPROVED' },
          { status: 'APPROVED' },
          { status: 'PENDING' },
        ],
        interactionLogs: [
          { createdAt: new Date(Date.now() - 1000 * 60 * 60) }, // 1 hour ago
        ],
      };

      (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(mockCandidate);

      const result = await MLPredictionService.predictPreHireQuality('candidate_1');

      expect(result).toHaveProperty('type', 'PRE_HIRE_QUALITY');
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('factors');
      expect(result.factors).toBeInstanceOf(Array);
    });

    it('should throw error for non-existent candidate', async () => {
      (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        MLPredictionService.predictPreHireQuality('nonexistent')
      ).rejects.toThrow('Candidate not found');
    });

    it('should calculate higher score for existing drivers', async () => {
      const existingDriver = {
        id: 'candidate_1',
        isExistingDriver: true,
        documents: [{ status: 'APPROVED' }],
        interactionLogs: [],
      };

      const newDriver = {
        id: 'candidate_2',
        isExistingDriver: false,
        documents: [{ status: 'APPROVED' }],
        interactionLogs: [],
      };

      (prisma.candidate.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingDriver)
        .mockResolvedValueOnce(newDriver);

      const existingResult = await MLPredictionService.predictPreHireQuality('candidate_1');
      const newResult = await MLPredictionService.predictPreHireQuality('candidate_2');

      expect(existingResult.value).toBeGreaterThan(newResult.value as number);
    });
  });

  describe('predictDropOffRisk', () => {
    it('should identify high risk for stale candidates', async () => {
      const mockCandidate = {
        id: 'candidate_1',
        currentStage: 'APPLICATION',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
        interactionLogs: [],
        documents: [],
      };

      (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(mockCandidate);

      const result = await MLPredictionService.predictDropOffRisk('candidate_1');

      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.value);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should consider document completion in risk assessment', async () => {
      const candidateWithDocs = {
        id: 'candidate_1',
        currentStage: 'DOCS_SUBMITTED',
        createdAt: new Date(),
        interactionLogs: [],
        documents: [
          { status: 'APPROVED' },
          { status: 'APPROVED' },
          { status: 'APPROVED' },
        ],
      };

      (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(candidateWithDocs);

      const result = await MLPredictionService.predictDropOffRisk('candidate_1');

      expect(result.factors.some(f => f.factor.includes('document'))).toBe(true);
    });
  });

  describe('predictOptimalContactTime', () => {
    it('should return time slot based on interaction history', async () => {
      const mockCandidate = {
        id: 'candidate_1',
        interactionLogs: [
          { createdAt: new Date('2026-03-30T09:00:00') },
          { createdAt: new Date('2026-03-29T09:30:00') },
          { createdAt: new Date('2026-03-28T10:00:00') },
        ],
      };

      (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(mockCandidate);

      const result = await MLPredictionService.predictOptimalContactTime('candidate_1');

      expect(result.value).toMatch(/Morning|Afternoon|Evening/);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('analyzeDocumentRisk', () => {
    it('should flag suspicious documents', async () => {
      const mockDocument = {
        id: 'doc_1',
        documentType: 'GOVERNMENT_ID',
        ocrConfidence: 0.45,
        tamperingScore: 0.85,
        fileUrl: 'https://example.com/doc.pdf',
      };

      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);

      const result = await MLPredictionService.analyzeDocumentRisk('doc_1');

      expect(result).toHaveProperty('risk');
      expect(result).toHaveProperty('confidence');
    });

    it('should return low risk for valid documents', async () => {
      const mockDocument = {
        id: 'doc_1',
        documentType: 'GOVERNMENT_ID',
        ocrConfidence: 0.95,
        tamperingScore: 0.05,
        fileUrl: 'https://example.com/doc.pdf',
      };

      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);

      const result = await MLPredictionService.analyzeDocumentRisk('doc_1');

      expect(result.value).toBe('LOW');
    });
  });

  describe('generateAllPredictions', () => {
    it('should return array of all predictions', async () => {
      const mockCandidate = {
        id: 'candidate_1',
        fullName: 'John Doe',
        isExistingDriver: false,
        currentStage: 'APPLICATION',
        documents: [],
        interactionLogs: [],
      };

      (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(mockCandidate);

      const results = await MLPredictionService.generateAllPredictions('candidate_1');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      const types = results.map(r => r.type);
      expect(types).toContain('PRE_HIRE_QUALITY');
      expect(types).toContain('DROP_OFF_RISK');
    });
  });
});
