# Firestore Security Specification

## 1. Data Invariants

1.  **Ownership**: Every document (except UserProfile which is keyed by UID) must have an `ownerId` field that matches the `request.auth.uid`.
2.  **Immutability**: The `ownerId` and `createdAt` fields must be immutable after creation.
3.  **Entity Integrity**:
    *   `Goal` must reference an existing `Hiea` (if `hieaId` provided).
    *   `Conference` must reference an existing `Hiea`, `Project`, or `Goal` if IDs are provided.
4.  **Schema Enforcement**: All writes must conform to the strict schema defined in the validation helpers (type checks, size limits, required fields).
5.  **PII Isolation**: User profiles contain sensitive information (`email`) and must only be readable by the owner.

## 2. The "Dirty Dozen" Payloads

### Payload 1: Identity Spoofing (Create)
**Target**: `/projects/malicious-project`
**Payload**: `{ "name": "Fake Project", "ownerId": "victim-uid", "status": "upcoming", "startDate": "2024-01-01", "endDate": "2024-12-31" }`
**Expectation**: `PERMISSION_DENIED` (ownerId must match auth.uid)

### Payload 2: Identity Spoofing (Update)
**Target**: `/projects/my-project`
**Payload**: `{ "ownerId": "new-owner-uid" }`
**Expectation**: `PERMISSION_DENIED` (ownerId is immutable)

### Payload 3: Resource Poisoning (Long String)
**Target**: `/goals/new-goal`
**Payload**: `{ "name": "A".repeat(2000), ... }`
**Expectation**: `PERMISSION_DENIED` (name size exceeds limit)

### Payload 4: Update Gap (Shadow Field)
**Target**: `/hieas/my-hiea`
**Payload**: `{ "isVerifiedByAdmin": true, "name": "Updated Name" }`
**Expectation**: `PERMISSION_DENIED` (affectedKeys().hasOnly() violation)

### Payload 5: Unauthorized Read (PII Leak)
**Target**: `get(/users/victim-uid)`
**Expectation**: `PERMISSION_DENIED` (only owner can read their profile)

### Payload 6: Orphaned Write (Missing Parent)
**Target**: `/goals/child-goal`
**Payload**: `{ "hieaId": "non-existent-hiea", ... }`
**Expectation**: `PERMISSION_DENIED` (exists check fails)

### Payload 7: State Shortcutting
**Target**: `/projects/my-project`
**Payload**: `{ "status": "completed", "progress": 100 }` (when starting from 0)
**Expectation**: `PERMISSION_DENIED` (If rules enforce valid state transitions - though here we mostly use action-based updates)

### Payload 8: Denial of Wallet (Large Array)
**Target**: `/projects/my-project`
**Payload**: `{ "tags": ["a"].repeat(5000) }`
**Expectation**: `PERMISSION_DENIED` (array size limit)

### Payload 9: Invisible PII Read (List Query)
**Target**: `queries.collection('users').get()`
**Expectation**: `PERMISSION_DENIED` (list queries must be restricted or blocked for users collection)

### Payload 10: ID Poisoning (Path Variable)
**Target**: `/projects/!!malicious_id!!` (1.5KB string)
**Expectation**: `PERMISSION_DENIED` (isValidId check fails)

### Payload 11: Future/Past Spoofing (Timestamp)
**Target**: `/projects/my-project`
**Payload**: `{ "createdAt": "2000-01-01T00:00:00Z" }`
**Expectation**: `PERMISSION_DENIED` (createdAt must match request.time)

### Payload 12: Admin Claim Spoofing
**Target**: `/users/my-uid` (setting isAdmin: true)
**Payload**: `{ "isAdmin": true }`
**Expectation**: `PERMISSION_DENIED` (isAdmin is immutable for non-admin users)

## 3. The Test Runner (Mock)

```typescript
// firestore.rules.test.ts
// This is a conceptual test file as the environment doesn't support execution
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Strategic App Security', () => {
  it('blocks identity spoofing on create', async () => {
    const db = env.authenticatedContext('attacker').firestore();
    await assertFails(db.collection('projects').add({ 
      name: 'Spoofed', 
      ownerId: 'victim' 
    }));
  });

  it('blocks unauthorized PII read', async () => {
    const db = env.authenticatedContext('user1').firestore();
    await assertFails(db.collection('users').doc('user2').get());
  });

  // ... more tests mapping to the Dirty Dozen
});
```
