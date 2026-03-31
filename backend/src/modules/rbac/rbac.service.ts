import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  findRoles(user?: AuthenticatedUser, organizationId?: string) {
    return this.prisma.role.findMany({
      where: {
        deletedAt: null,
        ...this.getRoleScope(user, organizationId),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [{ isSystemRole: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findRoleById(id: string, user?: AuthenticatedUser) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    this.ensureUserCanReadRole(user, role);
    return role;
  }

  async createRole(payload: CreateRoleDto, user?: AuthenticatedUser) {
    const isSystemRole = payload.isSystemRole ?? false;

    if (isSystemRole && payload.organizationId) {
      throw new BadRequestException(
        'System roles cannot belong to an organization.',
      );
    }

    if (!isSystemRole && !payload.organizationId) {
      throw new BadRequestException(
        'Organization role requires organizationId.',
      );
    }

    if (user && !user.isPlatformAdmin) {
      if (isSystemRole) {
        throw new ForbiddenException(
          'Only platform administrators can create system roles.',
        );
      }

      this.ensureUserHasOrganizationAccess(user, payload.organizationId ?? '');
    }

    const role = await this.prisma.role.create({
      data: {
        organizationId: payload.organizationId,
        code: payload.code,
        name: payload.name,
        description: payload.description,
        isSystemRole,
        isActive: payload.isActive ?? true,
      },
    });

    if (payload.permissionIds?.length) {
      await this.prisma.rolePermission.createMany({
        data: payload.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    return this.findRoleById(role.id, user);
  }

  async updateRole(
    id: string,
    payload: UpdateRoleDto,
    user?: AuthenticatedUser,
  ) {
    const existingRole = await this.findRoleById(id, user);

    if (existingRole.isSystemRole && user && !user.isPlatformAdmin) {
      throw new ForbiddenException(
        'Only platform administrators can modify system roles.',
      );
    }

    if (
      payload.organizationId !== undefined &&
      payload.organizationId !== existingRole.organizationId
    ) {
      throw new BadRequestException(
        'Changing organization of an existing role is not supported.',
      );
    }

    if (
      payload.isSystemRole !== undefined &&
      payload.isSystemRole !== existingRole.isSystemRole
    ) {
      throw new BadRequestException(
        'Changing system role type of an existing role is not supported.',
      );
    }

    await this.prisma.role.update({
      where: { id },
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        isActive: payload.isActive,
      },
    });

    if (payload.permissionIds) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      if (payload.permissionIds.length) {
        await this.prisma.rolePermission.createMany({
          data: payload.permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return this.findRoleById(id, user);
  }

  async removeRole(id: string, user?: AuthenticatedUser) {
    const role = await this.findRoleById(id, user);

    if (role.isSystemRole && user && !user.isPlatformAdmin) {
      throw new ForbiddenException(
        'Only platform administrators can remove system roles.',
      );
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  findPermissions() {
    return this.prisma.permission.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findPermissionById(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found.');
    }

    return permission;
  }

  createPermission(payload: CreatePermissionDto) {
    return this.prisma.permission.create({
      data: payload,
    });
  }

  async updatePermission(id: string, payload: UpdatePermissionDto) {
    await this.findPermissionById(id);
    return this.prisma.permission.update({
      where: { id },
      data: payload,
    });
  }

  async removePermission(id: string) {
    await this.findPermissionById(id);
    return this.prisma.permission.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  findAssignments(user?: AuthenticatedUser, organizationId?: string) {
    return this.prisma.staffMemberRole.findMany({
      where: {
        deletedAt: null,
        ...this.getAssignmentScope(user, organizationId),
      },
      include: {
        staffMember: true,
        role: true,
        organization: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async assignRole(payload: AssignRoleDto, user?: AuthenticatedUser) {
    this.ensureUserHasOrganizationAccess(user, payload.organizationId);

    const [staffMember, role, assignedByStaff] = await Promise.all([
      this.prisma.staffMember.findFirst({
        where: {
          id: payload.staffMemberId,
          organizationId: payload.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      }),
      this.prisma.role.findFirst({
        where: {
          id: payload.roleId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          organizationId: true,
          isSystemRole: true,
        },
      }),
      payload.assignedByStaffId
        ? this.prisma.staffMember.findFirst({
            where: {
              id: payload.assignedByStaffId,
              organizationId: payload.organizationId,
              deletedAt: null,
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!staffMember) {
      throw new BadRequestException(
        'Staff member does not belong to the selected organization.',
      );
    }

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (!role.isSystemRole && role.organizationId !== payload.organizationId) {
      throw new BadRequestException(
        'Role does not belong to the selected organization.',
      );
    }

    if (payload.assignedByStaffId && !assignedByStaff) {
      throw new BadRequestException(
        'Assigned-by staff member does not belong to the selected organization.',
      );
    }

    return this.prisma.staffMemberRole.create({
      data: {
        organizationId: payload.organizationId,
        staffMemberId: payload.staffMemberId,
        roleId: payload.roleId,
        assignedByStaffId: payload.assignedByStaffId,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      },
      include: {
        staffMember: true,
        role: true,
        organization: true,
      },
    });
  }

  async removeAssignment(id: string, user?: AuthenticatedUser) {
    const assignment = await this.prisma.staffMemberRole.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Role assignment not found.');
    }

    this.ensureUserHasOrganizationAccess(user, assignment.organizationId);
    return this.prisma.staffMemberRole.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private getRoleScope(
    user?: AuthenticatedUser,
    organizationId?: string,
  ): Record<string, unknown> {
    if (!user || user.isPlatformAdmin) {
      return organizationId
        ? {
            OR: [
              { organizationId },
              { isSystemRole: true, organizationId: null },
            ],
          }
        : {};
    }

    if (organizationId) {
      this.ensureUserHasOrganizationAccess(user, organizationId);
      return {
        OR: [{ organizationId }, { isSystemRole: true, organizationId: null }],
      };
    }

    return {
      OR: [
        { organizationId: { in: user.organizationIds } },
        { isSystemRole: true, organizationId: null },
      ],
    };
  }

  private getAssignmentScope(
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

    return {
      organizationId: {
        in: user.organizationIds,
      },
    };
  }

  private ensureUserCanReadRole(
    user: AuthenticatedUser | undefined,
    role: { organizationId: string | null; isSystemRole: boolean },
  ) {
    if (!user || user.isPlatformAdmin || role.isSystemRole) {
      return;
    }

    if (
      !role.organizationId ||
      !user.organizationIds.includes(role.organizationId)
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization.',
      );
    }
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
