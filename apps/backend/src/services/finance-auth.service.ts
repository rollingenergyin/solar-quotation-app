import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { JwtPayload } from '../types/index.js';

const prisma = new PrismaClient();

/** Finance login: only ADMIN and FINANCE roles can access */
export async function financeLogin(email: string, password: string, rememberMe = false) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.status === 'DISABLED') {
    throw new Error('Account is disabled. Contact admin.');
  }

  if (user.role !== 'ADMIN' && user.role !== 'FINANCE') {
    throw new Error('Access denied. Finance panel is for Admin and Finance roles only.');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const expiresIn = rememberMe ? config.jwt.rememberMeExpiresIn : config.jwt.expiresIn;
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user.id,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
  };
}
