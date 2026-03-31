import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodCode, Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllOrganizations(user: AuthenticatedUser) {
    return this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(user.isPlatformAdmin
          ? {}
          : {
              id: {
                in: user.organizationIds,
              },
            }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        branches: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findOrganizationById(id: string, user?: AuthenticatedUser) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branches: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, organization.id);
    }

    return organization;
  }

  createOrganization(payload: CreateOrganizationDto) {
    return this.prisma.$transaction(async (tx) => {
      const slug = await this.resolveUniqueSlug(
        tx,
        payload.slug ?? payload.name,
      );
      const organization = await tx.organization.create({
        data: {
          name: payload.name,
          slug,
          businessTypeCode: payload.businessTypeCode ?? 'auto_service',
          timezone: payload.timezone ?? 'Asia/Tashkent',
          currencyCode: payload.currencyCode ?? 'UZS',
          isActive: payload.isActive ?? true,
        },
      });

      await tx.paymentMethodTypeOrg.createMany({
        data: Object.values(PaymentMethodCode).map((paymentMethodCode) => ({
          organizationId: organization.id,
          paymentMethodCode,
          isActive: true,
        })),
      });

      return organization;
    });
  }

  async updateOrganization(id: string, payload: UpdateOrganizationDto) {
    const organization = await this.findOrganizationById(id);
    const slug = payload.slug
      ? await this.resolveUniqueSlug(this.prisma, payload.slug, organization.id)
      : undefined;

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...payload,
        ...(slug ? { slug } : {}),
      },
    });
  }

  async removeOrganization(id: string) {
    await this.findOrganizationById(id);
    return this.prisma.organization.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  findBranches(user: AuthenticatedUser, organizationId?: string) {
    return this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        AND: [
          ...(organizationId ? [{ organizationId }] : []),
          ...(user.isPlatformAdmin
            ? []
            : [
                {
                  organizationId: {
                    in: user.organizationIds,
                  },
                },
              ]),
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findBranchById(id: string, user?: AuthenticatedUser) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found.');
    }

    if (user) {
      this.ensureUserHasOrganizationAccess(user, branch.organizationId);
    }

    return branch;
  }

  async createBranch(payload: CreateBranchDto, user?: AuthenticatedUser) {
    if (user) {
      this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    }

    await this.findOrganizationById(payload.organizationId, user);

    return this.prisma.branch.create({
      data: {
        organizationId: payload.organizationId,
        name: payload.name,
        code: payload.code,
        phone: payload.phone,
        addressLine: payload.addressLine,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateBranch(
    id: string,
    payload: UpdateBranchDto,
    user?: AuthenticatedUser,
  ) {
    const branch = await this.findBranchById(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== branch.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing branch is not supported. Create a new branch in the target organization instead.',
      );
    }

    return this.prisma.branch.update({
      where: { id },
      data: payload,
    });
  }

  async removeBranch(id: string, user?: AuthenticatedUser) {
    await this.findBranchById(id, user);
    return this.prisma.branch.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  private async resolveUniqueSlug(
    prisma: Pick<PrismaService, 'organization'> | Prisma.TransactionClient,
    sourceValue: string,
    excludingOrganizationId?: string,
  ) {
    const baseSlug = this.slugify(sourceValue);
    let candidateSlug = baseSlug;
    let suffix = 2;

    while (true) {
      const existingOrganization = await prisma.organization.findFirst({
        where: {
          slug: candidateSlug,
          deletedAt: null,
          ...(excludingOrganizationId
            ? {
                id: {
                  not: excludingOrganizationId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

      if (!existingOrganization) {
        return candidateSlug;
      }

      candidateSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'organization';
  }

  private ensureUserHasOrganizationAccess(
    user: AuthenticatedUser,
    organizationId: string,
  ) {
    if (
      !user.isPlatformAdmin &&
      !user.organizationIds.includes(organizationId)
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
  }
}
