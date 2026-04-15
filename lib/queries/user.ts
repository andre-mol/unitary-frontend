import { supabaseClient } from '../supabaseClient';
import { subscriptionService } from '../subscriptionService';

export type ProfileRecord = {
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export type UserSettings = {
  theme: 'system' | 'light' | 'dark';
  currency: 'BRL';
  locale: 'pt-BR';
  notificationsEmail: boolean;
  notificationsProductUpdates: boolean;
  marketingEmailsOptIn: boolean;
  productUpdatesOptIn: boolean;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  communicationsVersion: string | null;
  cacheOnDevice: boolean;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  currency: 'BRL',
  locale: 'pt-BR',
  notificationsEmail: true,
  notificationsProductUpdates: true,
  marketingEmailsOptIn: false,
  productUpdatesOptIn: true,
  termsAcceptedAt: null,
  termsVersion: null,
  privacyVersion: null,
  communicationsVersion: null,
  cacheOnDevice: false,
};

export async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  return {
    name: data.full_name ?? null,
    phone: data.phone ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}

export async function fetchUserSettings(userId: string): Promise<UserSettings> {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return DEFAULT_USER_SETTINGS;
  }

  return {
    theme: (row.theme ?? 'system') as UserSettings['theme'],
    currency: 'BRL',
    locale: 'pt-BR',
    notificationsEmail: row.notifications_email ?? true,
    notificationsProductUpdates: row.product_updates_opt_in ?? row.notifications_product_updates ?? true, // Compatibilidade: tenta novo nome, depois antigo
    marketingEmailsOptIn: row.marketing_emails_opt_in ?? row.marketing_emails ?? false, // Compatibilidade: tenta novo nome, depois antigo
    productUpdatesOptIn: row.product_updates_opt_in ?? row.notifications_product_updates ?? true, // Compatibilidade: tenta novo nome, depois antigo
    termsAcceptedAt: row.terms_accepted_at ?? null,
    termsVersion: row.terms_version ?? null,
    privacyVersion: row.privacy_version ?? null,
    communicationsVersion: row.communications_version ?? null,
    cacheOnDevice: DEFAULT_USER_SETTINGS.cacheOnDevice,
  };
}

export async function fetchSubscription() {
  return subscriptionService.getMySubscription();
}

export async function fetchUserRole(userId: string): Promise<'admin' | 'superadmin' | null> {
  const supabase = supabaseClient();

  const { data: profileWithId, error: errorId } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!errorId && profileWithId?.role) {
    return profileWithId.role as 'admin' | 'superadmin';
  }

  const { data: profileWithUserId, error: errorUserId } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (!errorUserId && profileWithUserId?.role) {
    return profileWithUserId.role as 'admin' | 'superadmin';
  }

  return null;
}
