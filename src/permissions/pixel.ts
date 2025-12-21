import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants';
import type { Auth } from '@/lib/types';
import { getPixel } from '@/queries/prisma';

export async function canViewPixel({ user }: Auth, pixelId: string) {
  if (user?.isAdmin) {
    return true;
  }

  const pixel = await getPixel(pixelId);

  if (pixel.userId) {
    return user.id === pixel.userId;
  }

  return false;
}

export async function canUpdatePixel({ user }: Auth, pixelId: string) {
  if (user.isAdmin) {
    return true;
  }

  const pixel = await getPixel(pixelId);

  if (pixel.userId) {
    return user.id === pixel.userId;
  }

  return false;
}

export async function canDeletePixel({ user }: Auth, pixelId: string) {
  if (user.isAdmin) {
    return true;
  }

  const pixel = await getPixel(pixelId);

  if (pixel.userId) {
    return user.id === pixel.userId;
  }

  return false;
}
