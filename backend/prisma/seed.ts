import { PrismaClient, UserRole, PipelineStage, SourceChannel, ServiceType } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create zones
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { id: 'zone-metro-manila' },
      update: {},
      create: {
        id: 'zone-metro-manila',
        name: 'Metro Manila',
        region: 'NCR',
        description: 'Metro Manila coverage area',
      },
    }),
    prisma.zone.upsert({
      where: { id: 'zone-cebu' },
      update: {},
      create: {
        id: 'zone-cebu',
        name: 'Cebu City',
        region: 'Central Visayas',
        description: 'Cebu City and surrounding areas',
      },
    }),
    prisma.zone.upsert({
      where: { id: 'zone-davao' },
      update: {},
      create: {
        id: 'zone-davao',
        name: 'Davao City',
        region: 'Davao Region',
        description: 'Davao City coverage',
      },
    }),
  ]);
  console.log(`✅ Created ${zones.length} zones`);

  // Create admin user
  const adminPassword = await argon2.hash('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@xpress.ph' },
    update: {},
    create: {
      email: 'admin@xpress.ph',
      fullName: 'Admin User',
      role: UserRole.ADMIN,
      passwordHash: adminPassword,
      assignedZones: { connect: zones.map((z) => ({ id: z.id })) },
    },
  });
  console.log('✅ Created admin user: admin@xpress.ph / admin123');

  // Create recruitment manager
  const managerPassword = await argon2.hash('manager123');
  const manager = await prisma.user.upsert({
    where: { email: 'manager@xpress.ph' },
    update: {},
    create: {
      email: 'manager@xpress.ph',
      fullName: 'Recruitment Manager',
      role: UserRole.RECRUITMENT_MANAGER,
      passwordHash: managerPassword,
      assignedZones: { connect: zones.map((z) => ({ id: z.id })) },
    },
  });
  console.log('✅ Created recruitment manager: manager@xpress.ph / manager123');

  // Create recruiter
  const recruiterPassword = await argon2.hash('recruiter123');
  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@xpress.ph' },
    update: {},
    create: {
      email: 'recruiter@xpress.ph',
      fullName: 'Sample Recruiter',
      role: UserRole.RECRUITER,
      passwordHash: recruiterPassword,
      assignedZones: { connect: [{ id: zones[0].id }] },
    },
  });
  console.log('✅ Created recruiter: recruiter@xpress.ph / recruiter123');

  // Create sample candidates
  const sampleCandidates = [
    {
      fullName: 'Juan Dela Cruz',
      phonePrimary: '09171234567',
      email: 'juan@example.com',
      address: '123 Makati Ave, Makati City',
      zoneId: zones[0].id,
      serviceType: ServiceType.MOTO,
      sourceChannel: SourceChannel.WEBSITE_ORGANIC,
      currentStage: PipelineStage.SCREENING,
    },
    {
      fullName: 'Maria Santos',
      phonePrimary: '09181234568',
      email: 'maria@example.com',
      address: '456 Cebu Business Park, Cebu City',
      zoneId: zones[1].id,
      serviceType: ServiceType.SEDAN_SUV,
      sourceChannel: SourceChannel.SOCIAL_AD,
      currentStage: PipelineStage.DOCS_SUBMITTED,
    },
    {
      fullName: 'Pedro Reyes',
      phonePrimary: '09191234569',
      email: 'pedro@example.com',
      address: '789 Davao Pearl, Davao City',
      zoneId: zones[2].id,
      serviceType: ServiceType.TAXI,
      sourceChannel: SourceChannel.JOBBoard,
      currentStage: PipelineStage.APPLICATION,
    },
  ];

  for (const candidateData of sampleCandidates) {
    const portalToken = Math.random().toString(36).substring(2, 34);
    
    const candidate = await prisma.candidate.create({
      data: {
        ...candidateData,
        candidatePortalToken: portalToken,
        stageEnteredAt: new Date(),
        assignedRecruiterId: recruiter.id,
      },
    });

    // Create sample interaction log
    await prisma.candidateInteractionLog.create({
      data: {
        candidateId: candidate.id,
        recruiterId: recruiter.id,
        interactionDate: new Date(),
        interactionType: 'NOTE',
        outcome: 'POSITIVE',
        summary: 'Initial candidate record created',
        stageBefore: candidateData.currentStage,
        stageAfter: candidateData.currentStage,
        editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Create document checklist
    const { CandidateService } = await import('../src/services/candidate.service.js');
    await CandidateService.createDocumentChecklist(candidate.id, candidateData.serviceType);
  }
  console.log(`✅ Created ${sampleCandidates.length} sample candidates`);

  // Create default application flow
  const flow = await prisma.applicationFlow.create({
    data: {
      name: 'Default Driver Application',
      description: 'Standard application flow for all driver candidates',
      versions: {
        create: {
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedBy: admin.id,
          changeSummary: 'Initial published flow',
          steps: {
            create: [
              {
                stepNumber: 1,
                stepType: 'WELCOME',
                title: 'Welcome to Xpress',
                description: 'Become a driver partner',
                config: {
                  headline: 'Become an Xpress Driver',
                  bodyText: 'Join the leading ride-hailing platform in the Philippines',
                  ctaLabel: 'Apply Now',
                },
              },
              {
                stepNumber: 2,
                stepType: 'SERVICE_TYPE_SELECTION',
                title: 'Select Service Type',
                description: 'Choose your preferred service',
                config: {
                  options: ['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY'],
                },
              },
              {
                stepNumber: 3,
                stepType: 'PERSONAL_DETAILS',
                title: 'Personal Information',
                description: 'Tell us about yourself',
                config: {},
                fields: {
                  create: [
                    { fieldKey: 'firstName', fieldType: 'TEXT', label: 'First Name', isRequired: true, orderIndex: 1 },
                    { fieldKey: 'lastName', fieldType: 'TEXT', label: 'Last Name', isRequired: true, orderIndex: 2 },
                    { fieldKey: 'dateOfBirth', fieldType: 'DATE', label: 'Date of Birth', isRequired: true, orderIndex: 3 },
                    { fieldKey: 'phone', fieldType: 'PHONE', label: 'Mobile Number', isRequired: true, orderIndex: 4 },
                    { fieldKey: 'email', fieldType: 'EMAIL', label: 'Email Address', isRequired: false, orderIndex: 5 },
                    { fieldKey: 'address', fieldType: 'TEXTAREA', label: 'Current Address', isRequired: true, orderIndex: 6 },
                  ],
                },
              },
              {
                stepNumber: 4,
                stepType: 'DOCUMENT_UPLOAD',
                title: 'Upload Documents',
                description: 'Upload required documents',
                config: {
                  allowPartialSubmission: true,
                  maxFileSize: 10 * 1024 * 1024, // 10MB
                },
              },
              {
                stepNumber: 5,
                stepType: 'DECLARATIONS_AGREEMENTS',
                title: 'Terms & Conditions',
                description: 'Please read and accept',
                config: {
                  declarations: [
                    {
                      title: 'Data Privacy Consent',
                      text: 'I consent to Xpress processing my personal data...',
                      required: true,
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });
  console.log('✅ Created default application flow');

  // Create document requirements
  const documentTypes = [
    { type: 'GOVERNMENT_ID', required: true, serviceTypes: ['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY'] },
    { type: 'DRIVERS_LICENSE', required: true, serviceTypes: ['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY'] },
    { type: 'NBI_CLEARANCE', required: true, serviceTypes: ['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY'] },
    { type: 'PROOF_OF_ADDRESS', required: true, serviceTypes: ['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY'] },
    { type: 'SELFIE_PHOTO', required: true, serviceTypes: ['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY'] },
    { type: 'VEHICLE_OR_CR', required: false, serviceTypes: ['MOTO', 'SEDAN_SUV', 'ETRIKE', 'DELIVERY'] },
    { type: 'INSURANCE_CERTIFICATE', required: false, serviceTypes: ['MOTO', 'SEDAN_SUV', 'ETRIKE'] },
  ];

  for (const doc of documentTypes) {
    for (const serviceType of doc.serviceTypes) {
      await prisma.documentRequirement.upsert({
        where: {
          serviceType_documentType: {
            serviceType: serviceType as ServiceType,
            documentType: doc.type as any,
          },
        },
        update: {},
        create: {
          serviceType: serviceType as ServiceType,
          documentType: doc.type as any,
          isRequired: doc.required,
          requiresOcr: ['DRIVERS_LICENSE', 'NBI_CLEARANCE', 'VEHICLE_OR_CR'].includes(doc.type),
          orderIndex: documentTypes.indexOf(doc),
        },
      });
    }
  }
  console.log('✅ Created document requirements');

  console.log('\n✨ Seeding completed!');
  console.log('Login credentials:');
  console.log('  Admin: admin@xpress.ph / admin123');
  console.log('  Manager: manager@xpress.ph / manager123');
  console.log('  Recruiter: recruiter@xpress.ph / recruiter123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
