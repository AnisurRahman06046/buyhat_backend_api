import { Queue } from 'bullmq';
import { NotificationProvider } from '../../../shared/notifications';
import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationEvent } from '../events/notification-events';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationService } from './notification.service';
import { PreferenceService } from './preference.service';
import { TemplateService } from './template.service';

const makeNotification = (
  overrides: Partial<Notification> = {},
): Notification =>
  ({
    id: 'n-1',
    userId: 'user-1',
    channel: 'EMAIL',
    recipient: 'a@b.com',
    event: NotificationEvent.AUTH_VERIFY_EMAIL,
    category: 'TRANSACTIONAL',
    subject: 'Verify',
    body: 'token=abc',
    status: NotificationStatus.PENDING,
    attempts: 0,
    error: null,
    provider: 'logging',
    sentAt: null,
    createdAt: new Date(),
    ...overrides,
  }) as Notification;

describe('NotificationService', () => {
  let repo: jest.Mocked<NotificationRepository>;
  let templateService: jest.Mocked<TemplateService>;
  let preferenceService: jest.Mocked<PreferenceService>;
  let provider: jest.Mocked<NotificationProvider>;
  let queue: jest.Mocked<Queue>;
  let service: NotificationService;

  beforeEach(() => {
    repo = {
      create: jest.fn((x: Partial<Notification>) => x as Notification),
      save: jest.fn((x: Notification) =>
        Promise.resolve({ ...x, id: x.id ?? 'n-1' }),
      ),
      findById: jest.fn(),
      list: jest.fn(),
    } as unknown as jest.Mocked<NotificationRepository>;
    templateService = {
      resolve: jest.fn().mockResolvedValue({
        subject: 'Verify {{token}}',
        body: 'token={{token}}',
        isActive: true,
      }),
    } as unknown as jest.Mocked<TemplateService>;
    preferenceService = {
      isMarketingAllowed: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PreferenceService>;
    provider = {
      name: 'logging',
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
      sendPush: jest.fn().mockResolvedValue(undefined),
    };
    queue = {
      add: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Queue>;
    service = new NotificationService(
      repo,
      templateService,
      preferenceService,
      provider,
      queue,
    );
  });

  describe('dispatch', () => {
    it('renders the template, logs a PENDING row, and enqueues a job', async () => {
      await service.dispatch({
        event: NotificationEvent.AUTH_VERIFY_EMAIL,
        userId: 'user-1',
        to: { email: 'a@b.com' },
        data: { token: 'abc' },
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0] as Notification;
      expect(saved.channel).toBe('EMAIL');
      expect(saved.recipient).toBe('a@b.com');
      expect(saved.subject).toBe('Verify abc');
      expect(saved.body).toBe('token=abc');
      expect(saved.status).toBe(NotificationStatus.PENDING);
      expect(saved.provider).toBe('logging');
      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        { notificationId: 'n-1' },
        { jobId: 'n-1' },
      );
    });

    it('skips a MARKETING channel when the user opted out (D60)', async () => {
      preferenceService.isMarketingAllowed.mockResolvedValue(false);

      await service.dispatch({
        event: NotificationEvent.CART_ABANDONED,
        userId: 'user-1',
        to: { email: 'a@b.com' },
      });

      expect(repo.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('skips a channel with no matching contact (never throws)', async () => {
      await service.dispatch({
        event: NotificationEvent.AUTH_VERIFY_EMAIL,
        to: { phone: '0123' }, // no email for an EMAIL-only event
      });

      expect(repo.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('is best-effort: swallows errors from the pipeline', async () => {
      repo.save.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.dispatch({
          event: NotificationEvent.AUTH_VERIFY_EMAIL,
          to: { email: 'a@b.com' },
          data: { token: 'abc' },
        }),
      ).resolves.toBeUndefined();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('deliver', () => {
    it('sends via the adapter and marks SENT', async () => {
      repo.findById.mockResolvedValue(makeNotification());

      await service.deliver('n-1');

      expect(provider.sendEmail).toHaveBeenCalledWith(
        'a@b.com',
        'Verify',
        'token=abc',
      );
      const saved = repo.save.mock.calls[0][0] as Notification;
      expect(saved.status).toBe(NotificationStatus.SENT);
      expect(saved.attempts).toBe(1);
      expect(saved.sentAt).toBeInstanceOf(Date);
    });

    it('is a no-op for an already-SENT notification', async () => {
      repo.findById.mockResolvedValue(
        makeNotification({ status: NotificationStatus.SENT }),
      );

      await service.deliver('n-1');

      expect(provider.sendEmail).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('records the error and rethrows on provider failure (for BullMQ retry)', async () => {
      repo.findById.mockResolvedValue(makeNotification());
      provider.sendEmail.mockRejectedValueOnce(new Error('smtp 500'));

      await expect(service.deliver('n-1')).rejects.toThrow('smtp 500');
      const saved = repo.save.mock.calls[0][0] as Notification;
      expect(saved.status).toBe(NotificationStatus.PENDING);
      expect(saved.error).toContain('smtp 500');
    });
  });

  describe('markFailed', () => {
    it('marks the row FAILED with the error', async () => {
      repo.findById.mockResolvedValue(makeNotification({ attempts: 3 }));

      await service.markFailed('n-1', new Error('gave up'));

      const saved = repo.save.mock.calls[0][0] as Notification;
      expect(saved.status).toBe(NotificationStatus.FAILED);
      expect(saved.error).toContain('gave up');
    });
  });
});
