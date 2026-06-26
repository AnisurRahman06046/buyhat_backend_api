import { AudienceTarget } from '../enums/audience-target.enum';
import { CmsPopupRepository } from '../repositories/cms-popup.repository';
import { PopupService } from './popup.service';

describe('PopupService (audience targeting, D50)', () => {
  let repository: jest.Mocked<CmsPopupRepository>;
  let service: PopupService;

  beforeEach(() => {
    repository = {
      findActiveForAudiences: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CmsPopupRepository>;
    service = new PopupService(repository);
  });

  it('serves GUESTS + EVERYONE to anonymous callers', async () => {
    await service.activeForAudience(false);
    const [audiences] = repository.findActiveForAudiences.mock.calls[0];
    expect(audiences).toEqual(
      expect.arrayContaining([AudienceTarget.EVERYONE, AudienceTarget.GUESTS]),
    );
    expect(audiences).not.toContain(AudienceTarget.LOGGED_IN);
  });

  it('serves LOGGED_IN + EVERYONE to authenticated callers', async () => {
    await service.activeForAudience(true);
    const [audiences] = repository.findActiveForAudiences.mock.calls[0];
    expect(audiences).toEqual(
      expect.arrayContaining([
        AudienceTarget.EVERYONE,
        AudienceTarget.LOGGED_IN,
      ]),
    );
    expect(audiences).not.toContain(AudienceTarget.GUESTS);
  });
});
