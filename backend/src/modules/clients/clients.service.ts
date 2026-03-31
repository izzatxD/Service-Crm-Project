import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateVehicleProfileDto } from './dto/create-vehicle-profile.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateVehicleProfileDto } from './dto/update-vehicle-profile.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findClients(user?: AuthenticatedUser, organizationId?: string) {
    return this.prisma.client.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      include: {
        assets: {
          where: {
            deletedAt: null,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findClientById(id: string, user?: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        assets: {
          where: {
            deletedAt: null,
          },
          include: {
            vehicleProfile: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    this.ensureUserHasOrganizationAccess(user, client.organizationId);
    return client;
  }

  createClient(payload: CreateClientDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);
    return this.prisma.client.create({
      data: payload,
    });
  }

  async updateClient(
    id: string,
    payload: UpdateClientDto,
    user?: AuthenticatedUser,
  ) {
    const client = await this.findClientById(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== client.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing client is not supported.',
      );
    }

    return this.prisma.client.update({
      where: { id },
      data: payload,
    });
  }

  async removeClient(id: string, user?: AuthenticatedUser) {
    await this.findClientById(id, user);
    return this.prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async findAssets(
    user?: AuthenticatedUser,
    organizationId?: string,
    clientId?: string,
  ) {
    if (clientId) {
      const client = await this.ensureClientExists(clientId);
      this.ensureUserHasOrganizationAccess(user, client.organizationId);

      if (organizationId && client.organizationId !== organizationId) {
        throw new BadRequestException(
          'Client does not belong to the selected organization.',
        );
      }
    }

    return this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: true,
        vehicleProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findAssetById(id: string, user?: AuthenticatedUser) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        client: true,
        vehicleProfile: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    this.ensureUserHasOrganizationAccess(user, asset.organizationId);
    return asset;
  }

  async createAsset(payload: CreateAssetDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);

    const client = await this.ensureClientExists(payload.clientId);
    if (client.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Client does not belong to the selected organization.',
      );
    }

    return this.prisma.asset.create({
      data: payload,
    });
  }

  async updateAsset(
    id: string,
    payload: UpdateAssetDto,
    user?: AuthenticatedUser,
  ) {
    const asset = await this.findAssetById(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== asset.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing asset is not supported.',
      );
    }

    if (payload.clientId) {
      const client = await this.ensureClientExists(payload.clientId);
      if (client.organizationId !== asset.organizationId) {
        throw new BadRequestException(
          'Client does not belong to the selected organization.',
        );
      }
    }

    return this.prisma.asset.update({
      where: { id },
      data: payload,
    });
  }

  async removeAsset(id: string, user?: AuthenticatedUser) {
    await this.findAssetById(id, user);
    return this.prisma.asset.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  findVehicleProfiles(user?: AuthenticatedUser, organizationId?: string) {
    return this.prisma.vehicleProfile.findMany({
      where: {
        deletedAt: null,
        ...this.getOrganizationScope(user, organizationId),
      },
      include: {
        asset: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findVehicleProfileById(id: string, user?: AuthenticatedUser) {
    const vehicleProfile = await this.prisma.vehicleProfile.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        asset: true,
      },
    });

    if (!vehicleProfile) {
      throw new NotFoundException('Vehicle profile not found.');
    }

    this.ensureUserHasOrganizationAccess(user, vehicleProfile.organizationId);
    return vehicleProfile;
  }

  async createVehicleProfile(
    payload: CreateVehicleProfileDto,
    user?: AuthenticatedUser,
  ) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);

    const asset = await this.ensureAssetExists(payload.assetId);
    if (asset.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Asset does not belong to the selected organization.',
      );
    }

    return this.prisma.vehicleProfile.create({
      data: payload,
    });
  }

  async updateVehicleProfile(
    id: string,
    payload: UpdateVehicleProfileDto,
    user?: AuthenticatedUser,
  ) {
    const vehicleProfile = await this.findVehicleProfileById(id, user);

    if (
      payload.organizationId &&
      payload.organizationId !== vehicleProfile.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing vehicle profile is not supported.',
      );
    }

    if (payload.assetId) {
      const asset = await this.ensureAssetExists(payload.assetId);
      if (asset.organizationId !== vehicleProfile.organizationId) {
        throw new BadRequestException(
          'Asset does not belong to the selected organization.',
        );
      }
    }

    return this.prisma.vehicleProfile.update({
      where: { id },
      data: payload,
    });
  }

  async removeVehicleProfile(id: string, user?: AuthenticatedUser) {
    await this.findVehicleProfileById(id, user);
    return this.prisma.vehicleProfile.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async ensureClientExists(id: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  private async ensureAssetExists(id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    return asset;
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
}
