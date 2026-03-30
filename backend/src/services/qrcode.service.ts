import { prisma } from '../server.js';
import { v4 as uuidv4 } from 'uuid';

export class QRCodeService {
  // ==========================================
  // GENERATE REFERRAL QR CODE
  // ==========================================

  static async generateReferralQRCode(data: {
    zoneId: string;
    serviceType: string;
    fieldOfficerId: string;
    expiresIn?: number;
    maxUses?: number;
  }) {
    const qrCode = await prisma.referralQRCode.create({
      data: {
        id: `qr_${uuidv4().slice(0, 12)}`,
        zoneId: data.zoneId,
        serviceType: data.serviceType,
        fieldOfficerId: data.fieldOfficerId,
        expiresAt: new Date(Date.now() + (data.expiresIn || 7) * 24 * 60 * 60 * 1000),
        maxUses: data.maxUses || 50,
        useCount: 0,
        isActive: true,
        createdAt: new Date(),
      },
    });

    // Generate QR data payload
    const payload = {
      v: '1.0', // Version
      type: 'FO_REFERRAL',
      id: qrCode.id,
      fo: data.fieldOfficerId,
      zone: data.zoneId,
      svc: data.serviceType,
      exp: qrCode.expiresAt.toISOString(),
    };

    const qrData = Buffer.from(JSON.stringify(payload)).toString('base64');

    // In production: Generate actual QR image using qrcode library
    // For now, return data for frontend to generate
    return {
      ...qrCode,
      qrData,
      qrUrl: `https://xpress.com/r/${qrCode.id}`,
    };
  }

  // ==========================================
  // GET QR CODE IMAGE
  // ==========================================

  static async getQRCodeImage(qrCodeId: string): Promise<Buffer> {
    try {
      // Dynamically import qrcode library
      const QRCode = await import('qrcode');
      
      const qrData = JSON.stringify({
        v: '1.0',
        type: 'FO_REFERRAL',
        id: qrCodeId,
      });
      
      // Generate PNG buffer
      const buffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 500,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      return buffer;
    } catch (error) {
      console.error('QR Code generation failed:', error);
      throw new Error('Failed to generate QR code image');
    }
  }

  // ==========================================
  // PROCESS QR CODE SCAN
  // ==========================================

  static async processQRCodeScan(data: {
    qrCodeId: string;
    driverInfo: {
      fullName: string;
      phonePrimary: string;
    };
    scannedBy: string;
  }) {
    const qrCode = await prisma.referralQRCode.findUnique({
      where: { id: data.qrCodeId },
      include: {
        fieldOfficer: {
          select: { fullName: true, phone: true },
        },
      },
    });

    if (!qrCode) {
      return {
        success: false,
        error: 'Invalid QR code',
      };
    }

    // Check expiration
    if (new Date() > qrCode.expiresAt) {
      return {
        success: false,
        error: 'QR code has expired',
      };
    }

    // Check max uses
    if (qrCode.useCount >= qrCode.maxUses) {
      return {
        success: false,
        error: 'QR code usage limit reached',
      };
    }

    // Check if already registered
    const existing = await prisma.candidate.findUnique({
      where: { phonePrimary: data.driverInfo.phonePrimary },
    });

    if (existing) {
      return {
        success: false,
        error: 'Phone number already registered',
        candidateId: existing.id,
      };
    }

    // Create candidate from QR scan
    const candidate = await prisma.candidate.create({
      data: {
        id: `cand_${uuidv4().slice(0, 8)}`,
        fullName: data.driverInfo.fullName,
        phonePrimary: data.driverInfo.phonePrimary,
        serviceType: qrCode.serviceType,
        zoneId: qrCode.zoneId,
        currentStage: 'APPLICATION',
        sourceChannel: 'FO_REFERRAL',
        referralSource: 'QR_CODE_SCAN',
        assignedRecruiterId: qrCode.fieldOfficerId,
        qrCodeId: qrCode.id,
        isFieldRecruited: true,
      },
    });

    // Increment use count
    await prisma.referralQRCode.update({
      where: { id: qrCode.id },
      data: { useCount: { increment: 1 } },
    });

    // Create referral bonus record
    await prisma.referralBonus.create({
      data: {
        id: `bonus_${uuidv4().slice(0, 8)}`,
        candidateId: candidate.id,
        referrerId: qrCode.fieldOfficerId,
        referrerType: 'FIELD_OFFICER',
        amount: 500, // ₱500 for QR scan referral
        status: 'PENDING',
        triggerStage: 'ONBOARDED',
        source: 'QR_CODE',
      },
    });

    return {
      success: true,
      candidate,
      fieldOfficer: qrCode.fieldOfficer,
      message: 'Registration successful! The field officer will contact you soon.',
    };
  }

  // ==========================================
  // VALIDATE QR CODE
  // ==========================================

  static async validateQRCode(qrCodeId: string) {
    const qrCode = await prisma.referralQRCode.findUnique({
      where: { id: qrCodeId },
    });

    if (!qrCode) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (!qrCode.isActive) {
      return { valid: false, reason: 'INACTIVE' };
    }

    if (new Date() > qrCode.expiresAt) {
      return { valid: false, reason: 'EXPIRED' };
    }

    if (qrCode.useCount >= qrCode.maxUses) {
      return { valid: false, reason: 'MAX_USES' };
    }

    return {
      valid: true,
      zoneId: qrCode.zoneId,
      serviceType: qrCode.serviceType,
      remainingUses: qrCode.maxUses - qrCode.useCount,
    };
  }

  // ==========================================
  // DEACTIVATE QR CODE
  // ==========================================

  static async deactivateQRCode(qrCodeId: string, fieldOfficerId: string) {
    const qrCode = await prisma.referralQRCode.findFirst({
      where: {
        id: qrCodeId,
        fieldOfficerId,
      },
    });

    if (!qrCode) {
      throw new Error('QR code not found or not owned by you');
    }

    return prisma.referralQRCode.update({
      where: { id: qrCodeId },
      data: { isActive: false },
    });
  }

  // ==========================================
  // GET MY QR CODES
  // ==========================================

  static async getMyQRCodes(fieldOfficerId: string) {
    return prisma.referralQRCode.findMany({
      where: {
        fieldOfficerId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
