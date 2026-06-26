import { NotificationCategory } from '../enums/notification-category.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';

/**
 * Business events that trigger a notification (D59). Each event maps to a
 * category + the channels it fans out to + an in-code default template per
 * channel. A DB `notification_template` row for the same (event, channel)
 * overrides the default (D62) — the system works with zero DB templates.
 */
export enum NotificationEvent {
  AUTH_VERIFY_EMAIL = 'auth.verify_email',
  AUTH_PASSWORD_RESET = 'auth.password_reset',
  ORDER_PAID = 'order.paid',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  CART_ABANDONED = 'cart.abandoned',
  INVENTORY_LOW_STOCK = 'inventory.low_stock',
  /** Synthetic event for staff ad-hoc sends through the same pipeline. */
  MANUAL = 'manual.send',
}

/** A default channel template. `subject` is only meaningful for EMAIL/PUSH. */
export interface ChannelTemplate {
  channel: NotificationChannel;
  subject?: string;
  body: string;
}

export interface EventDefinition {
  event: NotificationEvent;
  category: NotificationCategory;
  channels: ChannelTemplate[];
}

const { EMAIL } = NotificationChannel;
const { TRANSACTIONAL, MARKETING } = NotificationCategory;

/**
 * The event → (category, channels, default templates) registry. All current
 * events are EMAIL-only; SMS/PUSH are supported by the port + manual-send
 * endpoints and can be added to any event's `channels` later with no code change
 * elsewhere.
 */
export const EVENT_DEFINITIONS: Record<NotificationEvent, EventDefinition> = {
  [NotificationEvent.AUTH_VERIFY_EMAIL]: {
    event: NotificationEvent.AUTH_VERIFY_EMAIL,
    category: TRANSACTIONAL,
    channels: [
      {
        channel: EMAIL,
        subject: 'Verify your email',
        body: 'Welcome to BuyHat! Your verification token is: {{token}}',
      },
    ],
  },
  [NotificationEvent.AUTH_PASSWORD_RESET]: {
    event: NotificationEvent.AUTH_PASSWORD_RESET,
    category: TRANSACTIONAL,
    channels: [
      {
        channel: EMAIL,
        subject: 'Reset your password',
        body: 'Your password reset token is: {{token}}',
      },
    ],
  },
  [NotificationEvent.ORDER_PAID]: {
    event: NotificationEvent.ORDER_PAID,
    category: TRANSACTIONAL,
    channels: [
      {
        channel: EMAIL,
        subject: 'Your order {{orderNumber}} is confirmed',
        body: 'Thanks! Order {{orderNumber}} totalling {{currency}} {{amount}} is confirmed and being prepared.',
      },
    ],
  },
  [NotificationEvent.ORDER_SHIPPED]: {
    event: NotificationEvent.ORDER_SHIPPED,
    category: TRANSACTIONAL,
    channels: [
      {
        channel: EMAIL,
        subject: 'Your order {{orderNumber}} has shipped',
        body: 'Good news — order {{orderNumber}} is on its way.',
      },
    ],
  },
  [NotificationEvent.ORDER_DELIVERED]: {
    event: NotificationEvent.ORDER_DELIVERED,
    category: TRANSACTIONAL,
    channels: [
      {
        channel: EMAIL,
        subject: 'Your order {{orderNumber}} was delivered',
        body: 'Order {{orderNumber}} has been delivered. Enjoy!',
      },
    ],
  },
  [NotificationEvent.CART_ABANDONED]: {
    event: NotificationEvent.CART_ABANDONED,
    category: MARKETING,
    channels: [
      {
        channel: EMAIL,
        subject: 'You left something in your cart',
        body: 'Your cart is waiting. Complete your purchase before items sell out!',
      },
    ],
  },
  [NotificationEvent.INVENTORY_LOW_STOCK]: {
    event: NotificationEvent.INVENTORY_LOW_STOCK,
    category: TRANSACTIONAL,
    channels: [
      {
        channel: EMAIL,
        subject: 'Low stock: variant {{variantId}}',
        body: 'Variant {{variantId}} is low: available {{available}} ≤ reorder level {{reorderLevel}}.',
      },
    ],
  },
  [NotificationEvent.MANUAL]: {
    event: NotificationEvent.MANUAL,
    category: TRANSACTIONAL,
    // Manual sends supply their own subject/body; no channel default needed.
    channels: [],
  },
};
