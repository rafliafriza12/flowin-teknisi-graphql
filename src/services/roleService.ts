import { Role, IRoleDocument, IRolePermissions, User } from "../models";
import {
  notFoundError,
  validationError,
  conflictError,
  forbiddenError,
  handleError,
} from "../utils/errors";
import { clearRolePermissionsCache } from "../middlewares";

// ============ INTERFACES ============

interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  permissions: IRolePermissions;
}

interface UpdateRoleInput {
  name?: string;
  displayName?: string;
  description?: string;
  permissions?: Partial<IRolePermissions>;
}

interface UpdateRoleResult {
  role: IRoleDocument;
  affectedUsersCount: number;
}

interface DeleteRoleResult {
  success: boolean;
  affectedUsersCount: number;
}

// ============ SERVICE ============

const roleService = {
  /**
   * Get all roles
   */
  getRoles: async (): Promise<IRoleDocument[]> => {
    try {
      return await Role.find().sort({ isSystem: -1, name: 1 });
    } catch (error) {
      throw handleError(error, "RoleService.getRoles");
    }
  },

  /**
   * Get role by ID
   */
  getRoleById: async (id: string): Promise<IRoleDocument> => {
    try {
      const role = await Role.findById(id);
      if (!role) {
        throw notFoundError("Role not found", "Role");
      }
      return role;
    } catch (error) {
      throw handleError(error, "RoleService.getRoleById");
    }
  },

  /**
   * Get role by name
   */
  getRoleByName: async (name: string): Promise<IRoleDocument | null> => {
    try {
      return await Role.findOne({ name });
    } catch (error) {
      throw handleError(error, "RoleService.getRoleByName");
    }
  },

  /**
   * Create a new role
   */
  createRole: async (input: CreateRoleInput): Promise<IRoleDocument> => {
    try {
      // Check if role name already exists
      const existingRole = await Role.findOne({ name: input.name });
      if (existingRole) {
        throw conflictError(`Role "${input.name}" already exists`, "name");
      }

      const role = new Role({
        name: input.name,
        displayName: input.displayName,
        description: input.description || "",
        permissions: input.permissions,
        isSystem: false,
      });

      await role.save();
      return role;
    } catch (error) {
      throw handleError(error, "RoleService.createRole");
    }
  },

  /**
   * Update a role and cascade changes to users
   */
  updateRole: async (
    id: string,
    input: UpdateRoleInput
  ): Promise<UpdateRoleResult> => {
    try {
      const role = await Role.findById(id);
      if (!role) {
        throw notFoundError("Role not found", "Role");
      }

      // Check if trying to rename to an existing role name
      if (input.name && input.name !== role.name) {
        const existingRole = await Role.findOne({ name: input.name });
        if (existingRole) {
          throw conflictError(`Role "${input.name}" already exists`, "name");
        }
      }

      const oldRoleName = role.name;
      let affectedUsersCount = 0;

      // Update role fields
      if (input.name !== undefined) role.name = input.name;
      if (input.displayName !== undefined) role.displayName = input.displayName;
      if (input.description !== undefined) role.description = input.description;
      if (input.permissions) {
        role.permissions = {
          ...role.permissions,
          ...input.permissions,
        } as IRolePermissions;
      }

      await role.save();

      // Clear the permissions cache for this role
      clearRolePermissionsCache(role.name);
      if (input.name && input.name !== oldRoleName) {
        clearRolePermissionsCache(oldRoleName);
      }

      // Cascade update: If role name changed, update all users with this role
      if (input.name && input.name !== oldRoleName) {
        const updateResult = await User.updateMany(
          { role: oldRoleName },
          { $set: { role: input.name } }
        );
        affectedUsersCount = updateResult.modifiedCount;
      }

      return { role, affectedUsersCount };
    } catch (error) {
      throw handleError(error, "RoleService.updateRole");
    }
  },

  /**
   * Delete a role and handle affected users
   * Users with the deleted role will be set to a default role or become inactive
   */
  deleteRole: async (
    id: string,
    fallbackRoleName?: string
  ): Promise<DeleteRoleResult> => {
    try {
      const role = await Role.findById(id);
      if (!role) {
        throw notFoundError("Role not found", "Role");
      }

      // Prevent deletion of system roles
      if (role.isSystem) {
        throw forbiddenError(
          `Cannot delete system role "${role.name}". System roles are protected.`
        );
      }

      // Count affected users
      const affectedUsersCount = await User.countDocuments({ role: role.name });

      // If there are affected users, handle them
      if (affectedUsersCount > 0) {
        if (fallbackRoleName) {
          // Check if fallback role exists
          const fallbackRole = await Role.findOne({ name: fallbackRoleName });
          if (!fallbackRole) {
            throw validationError(
              `Fallback role "${fallbackRoleName}" does not exist`
            );
          }
          // Update users to fallback role
          await User.updateMany(
            { role: role.name },
            { $set: { role: fallbackRoleName } }
          );
        } else {
          // Deactivate users with no fallback role
          await User.updateMany(
            { role: role.name },
            { $set: { isActive: false } }
          );
        }
      }

      // Delete the role
      await Role.findByIdAndDelete(id);

      // Clear the permissions cache for this role
      clearRolePermissionsCache(role.name);

      return { success: true, affectedUsersCount };
    } catch (error) {
      throw handleError(error, "RoleService.deleteRole");
    }
  },

  /**
   * Get permissions for a specific role by name
   */
  getRolePermissions: async (
    roleName: string
  ): Promise<IRolePermissions | null> => {
    try {
      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return null;
      }
      return role.permissions;
    } catch (error) {
      throw handleError(error, "RoleService.getRolePermissions");
    }
  },

  /**
   * Check if a role has a specific permission
   */
  hasPermission: async (
    roleName: string,
    permission: keyof IRolePermissions
  ): Promise<boolean> => {
    try {
      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return false;
      }
      return role.permissions[permission] === true;
    } catch (error) {
      throw handleError(error, "RoleService.hasPermission");
    }
  },

  /**
   * Initialize default system roles
   * Called during application startup
   */
  initializeDefaultRoles: async (): Promise<void> => {
    try {
      const defaultRoles = [
        {
          name: "Super Admin",
          displayName: "Super Admin",
          description: "Full access to all features and settings",
          permissions: {
            readAllContent: true,
            writeAllContent: true,
            deleteAllContent: true,
            categoryManagement: true,
            roleManagement: true,
            userManagement: true,
            generalSettings: true,
            notificationSettings: true,
            integrationSettings: true,
          },
          isSystem: true,
        },
        {
          name: "Admin",
          displayName: "Admin",
          description: "Can manage all content but not users or roles",
          permissions: {
            readAllContent: true,
            writeAllContent: true,
            deleteAllContent: true,
            categoryManagement: true,
            roleManagement: false,
            userManagement: false,
            generalSettings: true,
            notificationSettings: true,
            integrationSettings: true,
          },
          isSystem: false,
        },
        {
          name: "Copywriter",
          displayName: "Copywriter",
          description: "Can read and write content",
          permissions: {
            readAllContent: true,
            writeAllContent: true,
            deleteAllContent: false,
            categoryManagement: false,
            roleManagement: false,
            userManagement: false,
            generalSettings: false,
            notificationSettings: false,
            integrationSettings: false,
          },
          isSystem: false,
        },
      ];

      for (const roleData of defaultRoles) {
        const existingRole = await Role.findOne({ name: roleData.name });
        if (!existingRole) {
          await Role.create(roleData);
          console.log(`Created default role: ${roleData.name}`);
        }
      }
    } catch (error) {
      console.error("Error initializing default roles:", error);
      throw handleError(error, "RoleService.initializeDefaultRoles");
    }
  },

  /**
   * Get count of users for a specific role
   */
  getUserCountByRole: async (roleName: string): Promise<number> => {
    try {
      return await User.countDocuments({ role: roleName });
    } catch (error) {
      throw handleError(error, "RoleService.getUserCountByRole");
    }
  },
};

export default roleService;
