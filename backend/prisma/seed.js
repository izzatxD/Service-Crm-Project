const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  ['order.create', 'Create Orders', 'Create new service orders.'],
  ['order.read', 'Read Orders', 'View order lists and order details.'],
  ['order.update', 'Update Orders', 'Edit order details.'],
  ['order.assign', 'Assign Orders', 'Assign order work to staff members.'],
  ['order.approve', 'Approve Orders', 'Approve estimates or protected order actions.'],
  ['task.update', 'Update Tasks', 'Update task progress and notes.'],
  ['payment.create', 'Create Payments', 'Record customer payments.'],
  ['payment.read', 'Read Payments', 'View payment history and balances.'],
  ['expense.create', 'Create Expenses', 'Record expense transactions.'],
  ['inventory.read', 'Read Inventory', 'View stock levels and item lists.'],
  ['inventory.adjust', 'Adjust Inventory', 'Create stock adjustments and corrections.'],
  ['staff.read', 'Read Staff', 'View staff directory and assignments.'],
  ['staff.manage', 'Manage Staff', 'Create staff records and manage staff access.'],
  ['report.read', 'Read Reports', 'View dashboards and reports.'],
  ['system.settings', 'Manage System Settings', 'Manage organization-wide system settings.'],
];

const DEFAULT_ROLES = {
  admin: ['order.create', 'order.read', 'order.update', 'order.assign', 'order.approve', 'task.update', 'payment.create', 'payment.read', 'expense.create', 'inventory.read', 'inventory.adjust', 'staff.read', 'staff.manage', 'report.read', 'system.settings'],
  manager: ['order.create', 'order.read', 'order.update', 'order.assign', 'order.approve', 'payment.read', 'inventory.read', 'staff.read', 'report.read'],
  worker: ['order.read', 'task.update', 'inventory.read'],
  cashier: ['order.read', 'payment.create', 'payment.read', 'report.read'],
  viewer: ['order.read', 'payment.read', 'inventory.read', 'staff.read', 'report.read'],
};

const DEFAULT_PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'online', 'other'];
const DEMO_ROLE_CODES = ['admin', 'manager', 'worker', 'cashier', 'viewer'];

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'organization';
}

async function resolveUniqueOrganizationSlug(sourceValue, excludingOrganizationId) {
  const baseSlug = slugify(sourceValue);
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

async function findRoleByCode(code) {
  return prisma.role.findFirst({
    where: {
      code,
      isSystemRole: true,
      organizationId: null,
    },
  });
}

async function upsertPermissions() {
  for (const [code, name, description] of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name, description, deletedAt: null },
      create: { code, name, description },
    });
  }
}

async function upsertRoles() {
  for (const [code, permissionCodes] of Object.entries(DEFAULT_ROLES)) {
    const existingRole = await findRoleByCode(code);
    const role = existingRole
      ? await prisma.role.update({
          where: { id: existingRole.id },
          data: {
            name: code[0].toUpperCase() + code.slice(1),
            description: `${code} system role`,
            isSystemRole: true,
            isActive: true,
            deletedAt: null,
          },
        })
      : await prisma.role.create({
          data: {
            code,
            name: code[0].toUpperCase() + code.slice(1),
            description: `${code} system role`,
            isSystemRole: true,
            isActive: true,
          },
        });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUnique({
        where: { code: permissionCode },
      });
      if (!permission) continue;
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function upsertPlatformAdmin() {
  const isPlatformSeedEnabled =
    process.env.SEED_PLATFORM_ENABLED == null
      ? true
      : isTruthy(process.env.SEED_PLATFORM_ENABLED);

  if (!isPlatformSeedEnabled) return;

  const email = String(process.env.SEED_PLATFORM_EMAIL ?? '')
    .trim()
    .toLowerCase();
  const password = process.env.SEED_PLATFORM_PASSWORD;

  if (!email || !password) return;

  const existingOtherSuperAdmin = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      isSuperuser: true,
      email: {
        not: email,
      },
      platformAdminProfile: {
        is: {
          roleCode: 'super_admin',
          isActive: true,
          deletedAt: null,
        },
      },
    },
    select: {
      email: true,
    },
  });

  if (existingOtherSuperAdmin) {
    console.log(
      `Skipping platform admin seed for ${email} because super admin ${existingOtherSuperAdmin.email} already exists.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: process.env.SEED_PLATFORM_NAME ?? 'Platform Owner',
      isActive: true,
      isStaff: true,
      isSuperuser: true,
      deletedAt: null,
    },
    create: {
      email,
      fullName: process.env.SEED_PLATFORM_NAME ?? 'Platform Owner',
      isActive: true,
      isStaff: true,
      isSuperuser: true,
    },
  });

  const identity = await prisma.userAuthIdentity.findFirst({
    where: {
      userId: user.id,
      provider: 'password',
    },
  });

  if (identity) {
    await prisma.userAuthIdentity.update({
      where: { id: identity.id },
      data: {
        providerUserId: email,
        passwordHash,
        isPrimary: true,
        deletedAt: null,
      },
    });
  } else {
    await prisma.userAuthIdentity.create({
      data: {
        userId: user.id,
        provider: 'password',
        providerUserId: email,
        passwordHash,
        isPrimary: true,
      },
    });
  }

  const platformAdmin = await prisma.platformAdministrator.findFirst({
    where: { userId: user.id },
  });

  if (platformAdmin) {
    await prisma.platformAdministrator.update({
      where: { id: platformAdmin.id },
      data: {
        roleCode: 'super_admin',
        isActive: true,
        deletedAt: null,
      },
    });
  } else {
    await prisma.platformAdministrator.create({
      data: {
        userId: user.id,
        roleCode: 'super_admin',
        isActive: true,
      },
    });
  }
}

async function upsertOrganizationPaymentMethods() {
  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  for (const organization of organizations) {
    for (const paymentMethodCode of DEFAULT_PAYMENT_METHODS) {
      const existing = await prisma.paymentMethodTypeOrg.findFirst({
        where: {
          organizationId: organization.id,
          paymentMethodCode,
        },
      });

      if (existing) {
        await prisma.paymentMethodTypeOrg.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            deletedAt: null,
          },
        });
      } else {
        await prisma.paymentMethodTypeOrg.create({
          data: {
            organizationId: organization.id,
            paymentMethodCode,
            isActive: true,
          },
        });
      }
    }
  }
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'y', 'on'].includes(
    String(value ?? '').trim().toLowerCase(),
  );
}

async function upsertUserWithPassword({
  email,
  password,
  fullName,
  phone,
  isSuperuser = false,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName,
      phone: phone ?? null,
      isActive: true,
      isStaff: true,
      isSuperuser,
      deletedAt: null,
    },
    create: {
      email: normalizedEmail,
      fullName,
      phone,
      isActive: true,
      isStaff: true,
      isSuperuser,
    },
  });

  const identity = await prisma.userAuthIdentity.findFirst({
    where: {
      userId: user.id,
      provider: 'password',
    },
  });

  if (identity) {
    await prisma.userAuthIdentity.update({
      where: { id: identity.id },
      data: {
        providerUserId: normalizedEmail,
        passwordHash,
        isPrimary: true,
        deletedAt: null,
      },
    });
  } else {
    await prisma.userAuthIdentity.create({
      data: {
        userId: user.id,
        provider: 'password',
        providerUserId: normalizedEmail,
        passwordHash,
        isPrimary: true,
      },
    });
  }

  return user;
}

async function upsertDemoOrganization() {
  const organizationName =
    process.env.SEED_DEMO_ORG_NAME ?? 'AvtoUSTA Demo Service';
  const requestedOrganizationSlug =
    process.env.SEED_DEMO_ORG_SLUG ?? organizationName;
  const branchName =
    process.env.SEED_DEMO_BRANCH_NAME ?? 'Sergeli Demo Filial';
  const branchCode = process.env.SEED_DEMO_BRANCH_CODE ?? 'DEMO-1';
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo12345!';
  const emailPrefix = process.env.SEED_DEMO_EMAIL_PREFIX ?? 'demo';
  const phonePrefix = process.env.SEED_DEMO_PHONE_PREFIX ?? '+998900000';

  const existingOrganization = await prisma.organization.findFirst({
    where: {
      name: organizationName,
    },
    select: { id: true },
  });
  const organizationSlug = await resolveUniqueOrganizationSlug(
    requestedOrganizationSlug,
    existingOrganization?.id,
  );

  const organization = existingOrganization
    ? await prisma.organization.update({
        where: { id: existingOrganization.id },
        data: {
          name: organizationName,
          slug: organizationSlug,
          businessTypeCode: 'auto_service',
          timezone: 'Asia/Tashkent',
          currencyCode: 'UZS',
          isActive: true,
          deletedAt: null,
        },
      })
    : await prisma.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
          businessTypeCode: 'auto_service',
          timezone: 'Asia/Tashkent',
          currencyCode: 'UZS',
          isActive: true,
        },
      });

  const existingBranch = await prisma.branch.findFirst({
    where: {
      organizationId: organization.id,
      code: branchCode,
    },
    select: { id: true },
  });

  const branch = existingBranch
    ? await prisma.branch.update({
        where: { id: existingBranch.id },
        data: {
          name: branchName,
          code: branchCode,
          phone: '+998712000001',
          addressLine: 'Toshkent, Sergeli tumani',
          isActive: true,
          deletedAt: null,
        },
      })
    : await prisma.branch.create({
        data: {
          organizationId: organization.id,
          name: branchName,
          code: branchCode,
          phone: '+998712000001',
          addressLine: 'Toshkent, Sergeli tumani',
          isActive: true,
        },
      });

  for (const roleCode of DEMO_ROLE_CODES) {
    const email = `${emailPrefix}+${roleCode}@crm.local`;
    const fullName = `Demo ${roleCode[0].toUpperCase()}${roleCode.slice(1)}`;
    const phone = `${phonePrefix}${DEMO_ROLE_CODES.indexOf(roleCode) + 1}`;
    const user = await upsertUserWithPassword({
      email,
      password: demoPassword,
      fullName,
      phone,
    });

    const existingStaffMember = await prisma.staffMember.findFirst({
      where: {
        organizationId: organization.id,
        userId: user.id,
      },
      select: { id: true },
    });

    const staffMember = existingStaffMember
      ? await prisma.staffMember.update({
          where: { id: existingStaffMember.id },
          data: {
            fullName,
            primaryRole: roleCode,
            isActive: true,
            deletedAt: null,
          },
        })
      : await prisma.staffMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            fullName,
            primaryRole: roleCode,
            isActive: true,
          },
        });

    const existingStaffAccount = await prisma.staffAccount.findFirst({
      where: {
        organizationId: organization.id,
        staffMemberId: staffMember.id,
      },
      select: {
        id: true,
        telegramUserId: true,
        verifiedAt: true,
      },
    });
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    if (existingStaffAccount) {
      await prisma.staffAccount.update({
        where: { id: existingStaffAccount.id },
        data: {
          loginIdentifier: email,
          passwordHash,
          authMode: existingStaffAccount.telegramUserId
            ? 'password_and_telegram'
            : 'password',
          isActive: true,
          mustChangePassword: false,
          verifiedAt: existingStaffAccount.verifiedAt ?? new Date(),
          legacyUserId: user.id,
          deletedAt: null,
        },
      });
    } else {
      await prisma.staffAccount.create({
        data: {
          organizationId: organization.id,
          staffMemberId: staffMember.id,
          loginIdentifier: email,
          passwordHash,
          authMode: 'password',
          isActive: true,
          mustChangePassword: false,
          verifiedAt: new Date(),
          legacyUserId: user.id,
        },
      });
    }

    const role = await findRoleByCode(roleCode);
    if (role) {
      const existingAssignment = await prisma.staffMemberRole.findFirst({
        where: {
          organizationId: organization.id,
          staffMemberId: staffMember.id,
          roleId: role.id,
        },
      });

      if (existingAssignment) {
        await prisma.staffMemberRole.update({
          where: { id: existingAssignment.id },
          data: {
            deletedAt: null,
          },
        });
      } else {
        await prisma.staffMemberRole.create({
          data: {
            organizationId: organization.id,
            staffMemberId: staffMember.id,
            roleId: role.id,
          },
        });
      }
    }
  }

  return { organization, branch, demoPassword, emailPrefix, organizationSlug };
}

async function main() {
  await upsertPermissions();
  await upsertRoles();
  await upsertPlatformAdmin();
  if (isTruthy(process.env.SEED_DEMO_ENABLED)) {
    const demo = await upsertDemoOrganization();
    console.log(
      `Demo seed ready for ${demo.organization.name} / ${demo.branch.name}. Password: ${demo.demoPassword}`,
    );
    console.log(`Demo organization slug: ${demo.organizationSlug}`);
    console.log(
      `Demo emails: ${DEMO_ROLE_CODES.map((roleCode) => `${demo.emailPrefix}+${roleCode}@crm.local`).join(', ')}`,
    );
  }
  await upsertOrganizationPaymentMethods();
  console.log('Prisma seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
