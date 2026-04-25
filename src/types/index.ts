// User types
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  role: 'user' | 'admin' | 'owner';
  stripeCustomerId?: string;
  trialEndsAt?: Date;
  trialUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Key types
export interface ApiKey {
  id: string;
  keyHash: string;
  encryptedKey?: string;
  userId: string;
  botId?: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
}

// Bot types
export interface Bot {
  id: string;
  userId: string;
  name: string;
  phoneNumber?: string;
  webhookUrl?: string;
  autoResponseEnabled: boolean;
  status: 'connecting' | 'qr_required' | 'connected' | 'disconnected';
  qrCode?: string;
  isActive: boolean;
  connectionProcessId?: number;
  connectionHostname?: string;
  connectionUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Message types
export interface Message {
  id: string;
  botId: string;
  whatsappMessageId?: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  recipientType?: 'contact' | 'group';
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive';
  content: MessageContent;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  cost?: number;
  timestamp: Date;
  updatedAt: Date;
}

export interface MessageContent {
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  base64?: string;
  filename?: string;
  buttons?: Button[];
  caption?: string;
}

export interface Button {
  id: string;
  type: 'reply' | 'url';
  title: string;
  payload?: string;
  url?: string;
}

// Balance and Transaction types
export interface Balance {
  userId: string;
  amount: number;
  currency: string;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'topup' | 'deduction' | 'withdrawal';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Media types
export interface MediaFile {
  id: string;
  botId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  createdAt: Date;
}

// Auto Response types
export interface AutoResponseRule {
  id: string;
  botId: string;
  keyword: string;
  response: string;
  isActive: boolean;
  createdAt: Date;
}

// Webhook types
export interface WebhookDelivery {
  id: string;
  botId: string;
  eventType: 'message.received' | 'message.status' | 'button.clicked';
  eventData: Record<string, any>;
  url: string;
  attempts: number;
  status: 'pending' | 'delivered' | 'failed';
  lastAttemptAt?: Date;
  responseCode?: number;
  createdAt: Date;
}

// Auth types
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Subscription types
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  messageQuota: number;
  botLimit: number;
  features: string[];
  stripePriceId?: string;
  stripePriceIdYearly?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'suspended';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  messagesUsed: number;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  billingInterval: 'monthly' | 'yearly';
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  renewalCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionEvent {
  id: string;
  userId: string;
  planId?: string;
  eventType: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_expired' | 'subscription_renewed' | 'plan_changed' | 'payment_failed' | 'payment_succeeded';
  stripeEventId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Error types
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
  timestamp: Date;
}

// Request types
export interface SendMessageRequest {
  botId: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive';
  content: MessageContent;
}

export interface MessageResponse {
  messageId: string;
  status: string;
  timestamp: Date;
  cost: number;
}
