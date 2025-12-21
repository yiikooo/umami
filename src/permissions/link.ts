import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants';
import type { Auth } from '@/lib/types';
import { getLink } from '@/queries/prisma';

export async function canViewLink({ user }: Auth, linkId: string) {
  if (user?.isAdmin) {
    return true;
  }

  const link = await getLink(linkId);

  if (link.userId) {
    return user.id === link.userId;
  }

  return false;
}

export async function canUpdateLink({ user }: Auth, linkId: string) {
  if (user.isAdmin) {
    return true;
  }

  const link = await getLink(linkId);

  if (link.userId) {
    return user.id === link.userId;
  }

  return false;
}

export async function canDeleteLink({ user }: Auth, linkId: string) {
  if (user.isAdmin) {
    return true;
  }

  const link = await getLink(linkId);

  if (link.userId) {
    return user.id === link.userId;
  }

  return false;
}
