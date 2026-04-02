import { GraphQLContext } from "../../types";
import roleService from "../../services/roleService";
import { IRolePermissions } from "../../models";

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
  permissions?: IRolePermissions;
}

const roleResolver = {
  Query: {
    roles: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const roles = await roleService.getRoles();
      // Add user count to each role
      const rolesWithCount = await Promise.all(
        roles.map(async (role) => {
          const userCount = await roleService.getUserCountByRole(role.name);
          return {
            ...role.toObject(),
            id: role._id.toString(),
            userCount,
          };
        })
      );
      return rolesWithCount;
    },

    role: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      const role = await roleService.getRoleById(args.id);
      const userCount = await roleService.getUserCountByRole(role.name);
      return {
        ...role.toObject(),
        id: role._id.toString(),
        userCount,
      };
    },

    roleByName: async (
      _: unknown,
      args: { name: string },
      context: GraphQLContext
    ) => {
      const role = await roleService.getRoleByName(args.name);
      if (!role) return null;
      const userCount = await roleService.getUserCountByRole(role.name);
      return {
        ...role.toObject(),
        id: role._id.toString(),
        userCount,
      };
    },
  },

  Mutation: {
    createRole: async (
      _: unknown,
      args: { input: CreateRoleInput },
      context: GraphQLContext
    ) => {
      const role = await roleService.createRole(args.input);
      return {
        ...role.toObject(),
        id: role._id.toString(),
        userCount: 0,
      };
    },

    updateRole: async (
      _: unknown,
      args: { id: string; input: UpdateRoleInput },
      context: GraphQLContext
    ) => {
      const result = await roleService.updateRole(args.id, args.input);
      const userCount = await roleService.getUserCountByRole(result.role.name);
      return {
        role: {
          ...result.role.toObject(),
          id: result.role._id.toString(),
          userCount,
        },
        affectedUsersCount: result.affectedUsersCount,
      };
    },

    deleteRole: async (
      _: unknown,
      args: { id: string; fallbackRoleName?: string },
      context: GraphQLContext
    ) => {
      const result = await roleService.deleteRole(args.id, args.fallbackRoleName);
      return result;
    },

    initializeDefaultRoles: async (
      _: unknown,
      __: unknown,
      context: GraphQLContext
    ) => {
      await roleService.initializeDefaultRoles();
      return true;
    },
  },
};

export default roleResolver;
