import { OwnershipMetrics } from '../OwnershipMetrics';
import { maskResourceId, hashTenantId } from '../../utils/logSafety.util';

describe('OwnershipMetrics', () => {
  beforeEach(() => OwnershipMetrics.reset());
  afterAll(() => OwnershipMetrics.reset());

  it('increments per service/resource and exposes only those labels', async () => {
    OwnershipMetrics.ownershipDeniedTotal.inc({ service: 'inventory', resource: 'workPackage' });
    OwnershipMetrics.ownershipDeniedTotal.inc({ service: 'inventory', resource: 'workPackage' });
    const out = await OwnershipMetrics.getRegistry().metrics();
    expect(out).toContain('ownership_denied_total{service="inventory",resource="workPackage"} 2');
  });
});

describe('maskResourceId / hashTenantId', () => {
  const id = '507f1f77bcf86cd799439011';

  it('keeps only the last 4 chars of an id', () => {
    expect(maskResourceId(id)).toBe('****9011');
  });
  it('fully masks short / non-string input and strips control characters', () => {
    expect(maskResourceId('abc')).toBe('****');
    expect(maskResourceId(undefined)).toBe('****');
    expect(maskResourceId('aaaa\nbbbb')).toBe('****bbbb');
  });
  it('hashes tenant id deterministically without leaking it', () => {
    expect(hashTenantId(id)).toMatch(/^[0-9a-f]{12}$/);
    expect(hashTenantId(id)).toBe(hashTenantId(id));
    expect(id).not.toContain(hashTenantId(id));
    expect(hashTenantId(undefined)).toBe('unknown');
  });
});
