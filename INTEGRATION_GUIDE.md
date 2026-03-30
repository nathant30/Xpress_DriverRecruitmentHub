# OpsTower Integration Guide

This guide explains how the Driver Recruitment Hub seamlessly integrates with OpsTower V3.

## Overview

The integration enables **one-click transfer** of candidates from Recruitment Hub to OpsTower, eliminating manual data entry and ensuring data consistency across both systems.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRIVER RECRUITMENT HUB                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Candidate   │───▶│   Transfer   │───▶│   OpsTower   │       │
│  │   Record     │    │   Service    │    │    API       │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         │            ┌──────┴──────┐           │                │
│         │            │   Webhooks  │◀──────────┘                │
│         │            │  (optional) │                             │
│         │            └─────────────┘                             │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │  Marketing   │◀──────────────────────────────────────────────┤
│  │     Hub      │         Referral Bonus Trigger                │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Add these to your `backend/.env`:

```env
# OpsTower Integration
OPSTOWER_API_URL="https://api.opstower.xpress.ph/v1"
OPSTOWER_API_KEY="your-opstower-api-key"

# Marketing Hub Integration (for referral bonuses)
MARKETING_HUB_API_URL="https://api.marketing.xpress.ph/v1"
MARKETING_HUB_API_KEY="your-marketing-hub-api-key"

# Webhook Security (optional)
WEBHOOK_SECRET="your-webhook-signing-secret"
```

## Transfer Flow

### 1. Recruiter Initiates Transfer

When a candidate reaches the **CONTRACT_SIGNING** stage and all documents are approved:

1. Recruiter clicks **"Transfer to OpsTower"** button
2. System validates all requirements:
   - ✅ All documents approved
   - ✅ Personal information complete
   - ✅ Contract signed
3. Confirmation modal shows transfer preview

### 2. Automatic Data Migration

The integration service maps and transfers:

| Recruitment Hub | OpsTower Field | Notes |
|----------------|----------------|-------|
| `fullName` | `personalInfo.fullName` | Direct mapping |
| `phonePrimary` | `personalInfo.phone` | Direct mapping |
| `email` | `personalInfo.email` | Optional |
| `dateOfBirth` | `personalInfo.dateOfBirth` | ISO format |
| `address` | `personalInfo.address` | Full address |
| `zoneId` | `workInfo.zoneId` | UUID reference |
| `serviceType` | `workInfo.serviceType` | Mapped enum |
| `employmentType` | `workInfo.employmentType` | CONTRACTOR/SALARIED/OPERATOR |
| `documents[].fileUrl` | `documents[].fileUrl` | S3 URLs transferred |
| `documents[].ocrData` | `documents[].ocrData` | Extracted data |
| `sourceChannel` | `source.channel` | Attribution |
| `sourceReferringDriverId` | `source.referralId` | For bonuses |
| `id` | `source.recruitmentHubCandidateId` | Link back |

### 3. Document Synchronization

All approved documents are automatically transferred:

```typescript
// Documents transferred:
- GOVERNMENT_ID → GOVERNMENT_ID
- DRIVERS_LICENSE → DRIVERS_LICENSE
- NBI_CLEARANCE → NBI_CLEARANCE
- VEHICLE_OR_CR → VEHICLE_REGISTRATION
- INSURANCE_CERTIFICATE → INSURANCE
// ... etc
```

### 4. Bidirectional Sync (Webhooks)

OpsTower can notify Recruitment Hub of changes:

**Endpoint:** `POST /api/webhooks/opstower`

**Events:**
- `driver.activated` → Updates candidate to ONBOARDED
- `driver.suspended` → Logs alert in interaction log
- `driver.updated` → Syncs changes back
- `document.verified` → Updates document status

**Payload Example:**
```json
{
  "event": "driver.activated",
  "payload": {
    "driverId": "DRV-123456789",
    "activatedAt": "2026-03-30T10:00:00Z",
    "activatedBy": "admin@xpress.ph"
  },
  "timestamp": "2026-03-30T10:00:00Z"
}
```

## API Endpoints

### Transfer Candidate

```http
POST /api/candidates/:id/transfer-to-opstower
```

**Response:**
```json
{
  "success": true,
  "message": "Candidate successfully transferred to OpsTower",
  "driverId": "DRV-123456789"
}
```

**Error Cases:**
```json
{
  "error": "Invalid stage",
  "message": "Candidate must be in CONTRACT_SIGNING stage to transfer to OpsTower"
}
```

```json
{
  "error": "Documents pending",
  "message": "2 documents are not yet approved",
  "documents": ["DRIVERS_LICENSE", "NBI_CLEARANCE"]
}
```

### Check Sync Status

```http
GET /api/candidates/:id/sync-status
```

**Response:**
```json
{
  "isSynced": true,
  "driverId": "DRV-123456789",
  "lastSyncAt": "2026-03-30T10:00:00Z"
}
```

### Validate Driver ID

```http
POST /api/candidates/:id/validate-opstower-id
Content-Type: application/json

{
  "driverId": "DRV-123456789"
}
```

**Response:**
```json
{
  "valid": true,
  "status": "TRAINING",
  "isActive": true
}
```

## UI Components

### TransferToOpsTowerButton

Located in candidate detail page, this component:

1. **Shows disabled state** when:
   - Candidate not in CONTRACT_SIGNING stage
   - Documents pending approval

2. **Shows transfer button** when ready

3. **Shows confirmation modal** with:
   - Transfer preview
   - Document checklist
   - Confirm/Cancel actions

4. **Shows success state** when transferred:
   - Green checkmark badge
   - Driver ID displayed
   - Link to OpsTower driver profile

## Development Mode

If `OPSTOWER_API_URL` is not configured, the system operates in **mock mode**:

- Generates mock Driver IDs: `DRV-{timestamp}-{random}`
- Simulates API responses
- Logs actions to console
- Allows full UI testing without OpsTower connection

## Testing the Integration

### 1. Create Test Candidate

```bash
curl -X POST http://localhost:3001/api/candidates \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Driver",
    "phonePrimary": "09171234567",
    "zoneId": "zone-metro-manila",
    "serviceType": "MOTO",
    "sourceChannel": "WALK_IN"
  }'
```

### 2. Upload and Approve Documents

Use the candidate portal or API to upload and approve all required documents.

### 3. Advance to Contract Signing

```bash
curl -X PATCH http://localhost:3001/api/candidates/{id}/stage \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "CONTRACT_SIGNING"
  }'
```

### 4. Transfer to OpsTower

Click the **"Transfer to OpsTower"** button in the UI or:

```bash
curl -X POST http://localhost:3001/api/candidates/{id}/transfer-to-opstower \
  -H "Authorization: Bearer {token}"
```

## Troubleshooting

### Transfer Fails

**Check:**
1. All documents approved?
2. Candidate in CONTRACT_SIGNING stage?
3. OpsTower API accessible?
4. API key valid?

### Documents Not Syncing

**Check:**
1. Document has `fileUrl` (uploaded to S3)?
2. Document status is `APPROVED`?
3. S3 URLs are publicly accessible?

### Webhooks Not Received

**Check:**
1. OpsTower webhook URL configured correctly?
2. Firewall allowing requests?
3. Webhook signature verification passing?

## Security Considerations

1. **API Keys**: Store in environment variables, never commit to git
2. **Webhook Verification**: Implement HMAC signature verification
3. **Rate Limiting**: OpsTower API calls are rate-limited
4. **Data Validation**: Validate all incoming webhook payloads
5. **Audit Logging**: All transfers logged in interaction log

## Future Enhancements

### Phase 2
- [ ] Real-time sync via WebSockets
- [ ] Automatic conflict resolution
- [ ] Batch transfers for multiple candidates

### Phase 3
- [ ] Shared database (single source of truth)
- [ ] Service mesh integration
- [ ] GraphQL federation

## Support

For integration issues:
1. Check logs in Recruitment Hub backend
2. Verify OpsTower API health: `GET /health`
3. Review webhook delivery logs
4. Contact: devops@xpress.ph
