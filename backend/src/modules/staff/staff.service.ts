import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffAccountAuthMode } from '@prisma/client';

import { hashPassword } from '../../common/utils/bcrypt.util';
import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffAccountDto } from './dto/create-staff-account.dto';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { LinkStaffAccountTelegramDto } from './dto/link-staff-account-telegram.dto';
import { ResetStaffAccountPasswordDto } from './dto/reset-staff-account-password.dto';
import { UpdateStaffAccountDto } from './dto/update-staff-account.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';

const staffMemberInclude = {
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      isActive: true,
    },
  },
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  assignedRoles: {
    where: {
      deletedAt: null,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
  staffAccounts: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    select: {
      id: true,
      organizationId: true,
      staffMemberId: true,
      loginIdentifier: true,
      telegramUserId: true,
      authMode: true,
      isActive: true,
      mustChangePassword: true,
      sessionVersion: true,
      lastLoginAt: true,
      verifiedAt: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.StaffMemberInclude;

type StaffMemberRecord = Prisma.StaffMemberGetPayload<{
  include: typeof staffMemberInclude;
}>;

type StaffPrismaClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user?: AuthenticatedUser, organizationId?: string) {
    const staffMembers = await this.prisma.staffMember.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      include: staffMemberInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return staffMembers.map((staffMember) =>
      this.serializeStaffMember(staffMember),
    );
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const staffMember = await this.findStaffMemberOrThrow(
      this.prisma,
      id,
      user,
    );
    return this.serializeStaffMember(staffMember);
  }

  async findProfile(id: string, user?: AuthenticatedUser) {
    const staffMember = await this.findOne(id, user);
    const organizationId = staffMember.organizationId;

    const [
      activeTasks,
      recentCompletedTasks,
      recentAssignments,
      requestedApprovals,
      approvedApprovals,
      recentPayments,
      taskCounts,
      assignmentCounts,
      approvedApprovalCounts,
      paymentAggregate,
    ] = await Promise.all([
      this.prisma.orderTask.findMany({
        where: {
          organizationId,
          assignedStaffId: id,
          deletedAt: null,
          status: {
            in: ['pending', 'in_progress', 'waiting_parts'],
          },
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              openedAt: true,
              client: {
                select: {
                  fullName: true,
                },
              },
              asset: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.orderTask.findMany({
        where: {
          organizationId,
          assignedStaffId: id,
          deletedAt: null,
          status: 'completed',
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              closedAt: true,
              deliveredAt: true,
              client: {
                select: {
                  fullName: true,
                },
              },
              asset: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 10,
      }),
      this.prisma.orderAssignment.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [{ toStaffId: id }, { assignedByStaffId: id }],
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
          orderTask: {
            select: {
              id: true,
              title: true,
            },
          },
          fromStaff: {
            select: {
              id: true,
              fullName: true,
            },
          },
          toStaff: {
            select: {
              id: true,
              fullName: true,
            },
          },
          assignedByStaff: {
            select: {
              id: true,
              fullName: true,
            },
          },
          acceptedByStaff: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [{ assignedAt: 'desc' }],
        take: 10,
      }),
      this.prisma.orderApproval.findMany({
        where: {
          organizationId,
          requestedByStaffId: id,
          deletedAt: null,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
          approvedByStaff: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [{ requestedAt: 'desc' }],
        take: 10,
      }),
      this.prisma.orderApproval.findMany({
        where: {
          organizationId,
          approvedByStaffId: id,
          deletedAt: null,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
          requestedByStaff: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [{ decidedAt: 'desc' }, { requestedAt: 'desc' }],
        take: 10,
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId,
          receivedByStaffId: id,
          deletedAt: null,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              client: {
                select: {
                  fullName: true,
                },
              },
              asset: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: [{ paidAt: 'desc' }],
        take: 10,
      }),
      this.prisma.orderTask.groupBy({
        by: ['status'],
        where: {
          organizationId,
          assignedStaffId: id,
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.orderAssignment.groupBy({
        by: ['status'],
        where: {
          organizationId,
          toStaffId: id,
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.orderApproval.groupBy({
        by: ['status'],
        where: {
          organizationId,
          approvedByStaffId: id,
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          receivedByStaffId: id,
          deletedAt: null,
        },
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const taskCountByStatus = this.mapGroupCounts(taskCounts);
    const assignmentCountByStatus = this.mapGroupCounts(assignmentCounts);
    const approvedApprovalCountByStatus = this.mapGroupCounts(
      approvedApprovalCounts,
    );

    const totalTaskCount = Object.values(taskCountByStatus).reduce(
      (sum, count) => sum + count,
      0,
    );
    const completedTaskCount = taskCountByStatus.completed ?? 0;
    const activeTaskCount =
      (taskCountByStatus.pending ?? 0) +
      (taskCountByStatus.in_progress ?? 0) +
      (taskCountByStatus.waiting_parts ?? 0);

    return {
      staffMember,
      summary: {
        totalTaskCount,
        activeTaskCount,
        completedTaskCount,
        pausedTaskCount: taskCountByStatus.paused ?? 0,
        completionRate:
          totalTaskCount > 0
            ? Math.round((completedTaskCount / totalTaskCount) * 100)
            : 0,
        assignedOrderCount: new Set(
          [...activeTasks, ...recentCompletedTasks].map(
            (task) => task.order.id,
          ),
        ).size,
        activeAssignmentCount:
          (assignmentCountByStatus.assigned ?? 0) +
          (assignmentCountByStatus.accepted ?? 0),
        completedAssignmentCount: assignmentCountByStatus.completed ?? 0,
        requestedApprovalCount: requestedApprovals.length,
        approvedDecisionCount: approvedApprovalCountByStatus.approved ?? 0,
        rejectedDecisionCount: approvedApprovalCountByStatus.rejected ?? 0,
        pendingDecisionCount: approvedApprovalCountByStatus.pending ?? 0,
        paymentCount: paymentAggregate._count._all,
        collectedAmount: this.decimalToNumber(paymentAggregate._sum.amount),
      },
      activeTasks,
      recentCompletedTasks,
      recentAssignments,
      recentApprovals: [
        ...requestedApprovals.map((approval) => ({
          ...approval,
          perspective: 'requested',
        })),
        ...approvedApprovals.map((approval) => ({
          ...approval,
          perspective: 'decided',
        })),
      ]
        .sort((left, right) => {
          const leftDate = new Date(
            left.decidedAt ?? left.requestedAt ?? left.createdAt,
          ).getTime();
          const rightDate = new Date(
            right.decidedAt ?? right.requestedAt ?? right.createdAt,
          ).getTime();
          return rightDate - leftDate;
        })
        .slice(0, 10),
      recentPayments,
    };
  }

  async create(payload: CreateStaffMemberDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureOrganizationExists(tx, payload.organizationId);

      const staffMember = await tx.staffMember.create({
        data: {
          organizationId: payload.organizationId,
          userId: null,
          fullName: payload.fullName,
          primaryRole: payload.primaryRole,
          isActive: payload.isActive ?? true,
          hiredAt: payload.hiredAt ? new Date(payload.hiredAt) : undefined,
        },
        include: staffMemberInclude,
      });

      const accountPayload = this.extractAccountPayload(payload);
      if (accountPayload) {
        await this.createStaffAccountInternal(tx, staffMember, accountPayload);
      }

      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, staffMember.id),
      );
    });
  }

  async update(
    id: string,
    payload: UpdateStaffMemberDto,
    user?: AuthenticatedUser,
  ) {
    const existingStaff = await this.findStaffMemberOrThrow(
      this.prisma,
      id,
      user,
    );

    if (
      payload.organizationId &&
      payload.organizationId !== existingStaff.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing staff member is not supported. Create a new staff member in the target organization instead.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.staffMember.update({
        where: { id },
        data: {
          fullName: payload.fullName,
          primaryRole: payload.primaryRole,
          isActive: payload.isActive,
          hiredAt: payload.hiredAt ? new Date(payload.hiredAt) : undefined,
        },
      });

      const accountPayload = this.extractAccountPayload(payload);
      if (accountPayload) {
        const currentAccount = await this.findCurrentStaffAccount(tx, id);
        if (currentAccount) {
          await this.updateStaffAccountInternal(
            tx,
            existingStaff,
            currentAccount.id,
            accountPayload,
          );
        } else {
          await this.createStaffAccountInternal(
            tx,
            existingStaff,
            accountPayload,
          );
        }
      }

      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, id),
      );
    });
  }

  async createAccount(
    staffMemberId: string,
    payload: CreateStaffAccountDto,
    user?: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const staffMember = await this.findStaffMemberOrThrow(
        tx,
        staffMemberId,
        user,
      );
      await this.createStaffAccountInternal(tx, staffMember, payload);
      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, staffMemberId),
      );
    });
  }

  async updateAccount(
    staffMemberId: string,
    payload: UpdateStaffAccountDto,
    user?: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const staffMember = await this.findStaffMemberOrThrow(
        tx,
        staffMemberId,
        user,
      );
      const currentAccount = await this.findCurrentStaffAccountOrThrow(
        tx,
        staffMemberId,
      );
      await this.updateStaffAccountInternal(
        tx,
        staffMember,
        currentAccount.id,
        payload,
      );
      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, staffMemberId),
      );
    });
  }

  async resetAccountPassword(
    staffMemberId: string,
    payload: ResetStaffAccountPasswordDto,
    user?: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.findStaffMemberOrThrow(tx, staffMemberId, user);
      const currentAccount = await this.findCurrentStaffAccountOrThrow(
        tx,
        staffMemberId,
      );
      const passwordHash = await hashPassword(payload.newPassword);

      await tx.staffAccount.update({
        where: {
          id: currentAccount.id,
        },
        data: {
          passwordHash,
          authMode: currentAccount.telegramUserId
            ? StaffAccountAuthMode.password_and_telegram
            : StaffAccountAuthMode.password,
          mustChangePassword: payload.mustChangePassword ?? true,
          verifiedAt: new Date(),
          sessionVersion: {
            increment: 1,
          },
        },
      });

      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, staffMemberId),
      );
    });
  }

  async linkTelegram(
    staffMemberId: string,
    payload: LinkStaffAccountTelegramDto,
    user?: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const staffMember = await this.findStaffMemberOrThrow(
        tx,
        staffMemberId,
        user,
      );
      const currentAccount = await this.findCurrentStaffAccountOrThrow(
        tx,
        staffMemberId,
      );
      const telegramUserId = this.normalizeTelegramUserId(
        payload.telegramUserId,
      );

      await this.ensureUniqueTelegramUserId(
        tx,
        staffMember.organizationId,
        telegramUserId,
        currentAccount.id,
      );

      await tx.staffAccount.update({
        where: {
          id: currentAccount.id,
        },
        data: {
          telegramUserId,
          authMode: currentAccount.passwordHash
            ? StaffAccountAuthMode.password_and_telegram
            : StaffAccountAuthMode.telegram,
          verifiedAt: currentAccount.verifiedAt ?? new Date(),
          sessionVersion: {
            increment: 1,
          },
        },
      });

      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, staffMemberId),
      );
    });
  }

  async unlinkTelegram(staffMemberId: string, user?: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.findStaffMemberOrThrow(tx, staffMemberId, user);
      const currentAccount = await this.findCurrentStaffAccountOrThrow(
        tx,
        staffMemberId,
      );

      if (!currentAccount.telegramUserId) {
        return this.serializeStaffMember(
          await this.findStaffMemberOrThrow(tx, staffMemberId),
        );
      }

      if (!currentAccount.passwordHash) {
        throw new BadRequestException(
          'Cannot unlink Telegram from a telegram-only account without setting a password first.',
        );
      }

      await tx.staffAccount.update({
        where: {
          id: currentAccount.id,
        },
        data: {
          telegramUserId: null,
          authMode: StaffAccountAuthMode.password,
          sessionVersion: {
            increment: 1,
          },
        },
      });

      return this.serializeStaffMember(
        await this.findStaffMemberOrThrow(tx, staffMemberId),
      );
    });
  }

  async remove(id: string, user?: AuthenticatedUser) {
    await this.findStaffMemberOrThrow(this.prisma, id, user);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const currentAccount = await this.findCurrentStaffAccount(tx, id);

      await tx.staffMember.update({
        where: { id },
        data: {
          deletedAt: now,
          isActive: false,
        },
      });

      if (currentAccount) {
        await tx.staffAccount.update({
          where: {
            id: currentAccount.id,
          },
          data: {
            deletedAt: now,
            isActive: false,
          },
        });
      }

      return {
        success: true,
        staffMemberId: id,
      };
    });
  }

  private async createStaffAccountInternal(
    prisma: StaffPrismaClient,
    staffMember: StaffMemberRecord,
    payload: CreateStaffAccountDto,
  ) {
    const existingAccount = await this.findCurrentStaffAccount(
      prisma,
      staffMember.id,
    );
    if (existingAccount) {
      throw new ConflictException(
        'This staff member already has an active organization account.',
      );
    }

    const accountData = await this.prepareStaffAccountData(
      prisma,
      staffMember,
      payload,
    );

    await prisma.staffAccount.create({
      data: {
        organizationId: staffMember.organizationId,
        staffMemberId: staffMember.id,
        ...accountData,
      },
    });
  }

  private async updateStaffAccountInternal(
    prisma: StaffPrismaClient,
    staffMember: StaffMemberRecord,
    accountId: string,
    payload: UpdateStaffAccountDto,
  ) {
    const existingAccount = await this.findCurrentStaffAccountOrThrow(
      prisma,
      staffMember.id,
    );
    const accountData = await this.prepareStaffAccountData(
      prisma,
      staffMember,
      payload,
      existingAccount,
    );

    await prisma.staffAccount.update({
      where: {
        id: accountId,
      },
      data: {
        ...accountData,
        sessionVersion: {
          increment: 1,
        },
      },
    });
  }

  private async prepareStaffAccountData(
    prisma: StaffPrismaClient,
    staffMember: StaffMemberRecord,
    payload: CreateStaffAccountDto | UpdateStaffAccountDto,
    existingAccount?: {
      id: string;
      loginIdentifier: string;
      passwordHash: string | null;
      telegramUserId: string | null;
      authMode: StaffAccountAuthMode;
      isActive: boolean;
      mustChangePassword: boolean;
      verifiedAt: Date | null;
    },
  ) {
    const loginIdentifier = this.normalizeLoginIdentifier(
      payload.loginIdentifier ?? existingAccount?.loginIdentifier,
    );
    const passwordHash = payload.password
      ? await hashPassword(payload.password)
      : (existingAccount?.passwordHash ?? null);
    const telegramUserId =
      payload.telegramUserId !== undefined
        ? this.normalizeTelegramUserId(payload.telegramUserId)
        : (existingAccount?.telegramUserId ?? null);
    const authMode = this.resolveAuthMode(
      payload.authMode,
      passwordHash,
      telegramUserId,
    );
    const isActive = payload.isActive ?? existingAccount?.isActive ?? true;
    const mustChangePassword =
      payload.mustChangePassword ??
      existingAccount?.mustChangePassword ??
      false;

    await this.ensureUniqueLoginIdentifier(
      prisma,
      staffMember.organizationId,
      loginIdentifier,
      existingAccount?.id,
    );

    if (telegramUserId) {
      await this.ensureUniqueTelegramUserId(
        prisma,
        staffMember.organizationId,
        telegramUserId,
        existingAccount?.id,
      );
    }

    return {
      loginIdentifier,
      passwordHash,
      telegramUserId,
      authMode,
      isActive,
      mustChangePassword,
      verifiedAt:
        existingAccount?.verifiedAt ??
        (passwordHash || telegramUserId ? new Date() : null),
    };
  }

  private async ensureOrganizationExists(
    prisma: StaffPrismaClient,
    organizationId: string,
  ) {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
  }

  private async findStaffMemberOrThrow(
    prisma: StaffPrismaClient,
    id: string,
    user?: AuthenticatedUser,
  ): Promise<StaffMemberRecord> {
    const staffMember = await prisma.staffMember.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: staffMemberInclude,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found.');
    }

    this.ensureUserHasOrganizationAccess(user, staffMember.organizationId);
    return staffMember;
  }

  private async findCurrentStaffAccount(
    prisma: StaffPrismaClient,
    staffMemberId: string,
  ) {
    return prisma.staffAccount.findFirst({
      where: {
        staffMemberId,
        deletedAt: null,
      },
      select: {
        id: true,
        loginIdentifier: true,
        passwordHash: true,
        telegramUserId: true,
        authMode: true,
        isActive: true,
        mustChangePassword: true,
        verifiedAt: true,
      },
    });
  }

  private async findCurrentStaffAccountOrThrow(
    prisma: StaffPrismaClient,
    staffMemberId: string,
  ) {
    const account = await this.findCurrentStaffAccount(prisma, staffMemberId);

    if (!account) {
      throw new NotFoundException('Staff account not found.');
    }

    return account;
  }

  private async ensureUniqueLoginIdentifier(
    prisma: StaffPrismaClient,
    organizationId: string,
    loginIdentifier: string,
    excludingAccountId?: string,
  ) {
    const existingAccount = await prisma.staffAccount.findFirst({
      where: {
        organizationId,
        loginIdentifier,
        deletedAt: null,
        ...(excludingAccountId
          ? {
              id: {
                not: excludingAccountId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingAccount) {
      throw new ConflictException(
        'This login identifier is already used inside the selected organization.',
      );
    }
  }

  private async ensureUniqueTelegramUserId(
    prisma: StaffPrismaClient,
    organizationId: string,
    telegramUserId: string,
    excludingAccountId?: string,
  ) {
    const existingAccount = await prisma.staffAccount.findFirst({
      where: {
        organizationId,
        telegramUserId,
        deletedAt: null,
        ...(excludingAccountId
          ? {
              id: {
                not: excludingAccountId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingAccount) {
      throw new ConflictException(
        'This Telegram identity is already linked inside the selected organization.',
      );
    }
  }

  private extractAccountPayload(
    payload: CreateStaffMemberDto | UpdateStaffMemberDto,
  ): CreateStaffAccountDto | UpdateStaffAccountDto | undefined {
    const mergedPayload = {
      ...payload.account,
      loginIdentifier: payload.account?.loginIdentifier ?? payload.email,
      password: payload.account?.password ?? payload.password,
      telegramUserId: payload.account?.telegramUserId ?? payload.telegramUserId,
    };

    const hasExplicitAccountInput =
      Boolean(payload.account) ||
      payload.email !== undefined ||
      payload.password !== undefined ||
      payload.telegramUserId !== undefined;

    if (!hasExplicitAccountInput) {
      return undefined;
    }

    return mergedPayload;
  }

  private resolveAuthMode(
    requestedAuthMode: StaffAccountAuthMode | undefined,
    passwordHash: string | null,
    telegramUserId: string | null,
  ) {
    const inferredAuthMode = (() => {
      if (passwordHash && telegramUserId) {
        return StaffAccountAuthMode.password_and_telegram;
      }

      if (telegramUserId) {
        return StaffAccountAuthMode.telegram;
      }

      if (passwordHash) {
        return StaffAccountAuthMode.password;
      }

      return null;
    })();

    const authMode = requestedAuthMode ?? inferredAuthMode;

    if (!authMode) {
      throw new BadRequestException(
        'Staff account must have at least one authentication factor.',
      );
    }

    if (
      (authMode === StaffAccountAuthMode.password ||
        authMode === StaffAccountAuthMode.password_and_telegram) &&
      !passwordHash
    ) {
      throw new BadRequestException('Selected auth mode requires a password.');
    }

    if (
      (authMode === StaffAccountAuthMode.telegram ||
        authMode === StaffAccountAuthMode.password_and_telegram) &&
      !telegramUserId
    ) {
      throw new BadRequestException(
        'Selected auth mode requires a Telegram identity.',
      );
    }

    return authMode;
  }

  private normalizeLoginIdentifier(value?: string | null) {
    const normalizedValue = value?.trim().toLowerCase();

    if (!normalizedValue) {
      throw new BadRequestException('loginIdentifier is required.');
    }

    return normalizedValue;
  }

  private normalizeTelegramUserId(value?: string | null) {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      throw new BadRequestException('telegramUserId cannot be empty.');
    }

    return normalizedValue;
  }

  private getOrganizationScope(
    user?: AuthenticatedUser,
    organizationId?: string,
  ): Record<string, unknown> {
    if (!user || user.isPlatformAdmin) {
      return organizationId ? { organizationId } : {};
    }

    if (organizationId) {
      this.ensureUserHasOrganizationAccess(user, organizationId);
      return { organizationId };
    }

    return { organizationId: { in: user.organizationIds } };
  }

  private ensureUserHasOrganizationAccess(
    user: AuthenticatedUser | undefined,
    organizationId: string,
  ) {
    if (
      user &&
      !user.isPlatformAdmin &&
      !user.organizationIds.includes(organizationId)
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
  }

  private serializeStaffMember(staffMember: StaffMemberRecord) {
    const currentAccount = staffMember.staffAccounts[0] ?? null;

    return {
      ...staffMember,
      account: currentAccount,
      staffAccounts: undefined,
    };
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value) : 0;
  }

  private mapGroupCounts<
    T extends { status: string; _count: { _all: number } },
  >(rows: T[]) {
    return rows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.status] = row._count._all;
      return accumulator;
    }, {});
  }
}
