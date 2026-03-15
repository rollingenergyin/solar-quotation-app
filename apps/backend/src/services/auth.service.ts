import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config/index.js';
import type { JwtPayload } from '../types/index.js';

const prisma = new PrismaClient();

export interface LoginInput {
  /** Email or User ID (login identifier) */
  emailOrUserId: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  userId?: string;
  phone?: string;
  designation?: string;
  role?: Role;
}

export async function login({ emailOrUserId, password, rememberMe }: LoginInput) {
  const isEmail = emailOrUserId.includes('@');
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: emailOrUserId.trim().toLowerCase() } })
    : await prisma.user.findUnique({ where: { userId: emailOrUserId.trim() } });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.status === 'DISABLED') {
    throw new Error('Account is disabled. Contact admin.');
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
      phone: user.phone,
      designation: user.designation,
      role: user.role,
      status: user.status,
    },
  };
}

export async function register({ email, password, name, userId, phone, designation, role = 'SALES' }: RegisterInput) {
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error('Email already registered');
  }
  const loginId = userId?.trim() || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
  const existingUserId = await prisma.user.findUnique({ where: { userId: loginId } });
  if (existingUserId) {
    throw new Error('User ID already taken');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      userId: loginId,
      password: hashedPassword,
      name,
      phone: phone?.trim() || null,
      designation: designation?.trim() || null,
      role,
    },
  });

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user.id,
      userId: user.userId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      designation: user.designation,
      role: user.role,
      status: user.status,
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      userId: true,
      email: true,
      name: true,
      phone: true,
      designation: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { quotations: true } },
    },
  });
  if (!user) {
    throw new Error('User not found');
  }
  const { _count, ...rest } = user;
  return { ...rest, quotationsCount: _count.quotations };
}
