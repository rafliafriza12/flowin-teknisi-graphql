const roleTypeDefs = `#graphql
  # Permission structure for roles
  type RolePermissions {
    readAllContent: Boolean!
    writeAllContent: Boolean!
    deleteAllContent: Boolean!
    categoryManagement: Boolean!
    roleManagement: Boolean!
    userManagement: Boolean!
    generalSettings: Boolean!
    notificationSettings: Boolean!
    integrationSettings: Boolean!
  }

  # Role type
  type Role {
    id: ID!
    name: String!
    displayName: String!
    description: String
    permissions: RolePermissions!
    isSystem: Boolean!
    userCount: Int
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Input for role permissions
  input RolePermissionsInput {
    readAllContent: Boolean!
    writeAllContent: Boolean!
    deleteAllContent: Boolean!
    categoryManagement: Boolean!
    roleManagement: Boolean!
    userManagement: Boolean!
    generalSettings: Boolean!
    notificationSettings: Boolean!
    integrationSettings: Boolean!
  }

  # Input for creating a role
  input CreateRoleInput {
    name: String!
    displayName: String!
    description: String
    permissions: RolePermissionsInput!
  }

  # Input for updating a role
  input UpdateRoleInput {
    name: String
    displayName: String
    description: String
    permissions: RolePermissionsInput
  }

  # Response for update role mutation
  type UpdateRoleResponse {
    role: Role!
    affectedUsersCount: Int!
  }

  # Response for delete role mutation
  type DeleteRoleResponse {
    success: Boolean!
    affectedUsersCount: Int!
  }

  # Queries
  extend type Query {
    # Get all roles
    roles: [Role!]!

    # Get role by ID
    role(id: ID!): Role

    # Get role by name
    roleByName(name: String!): Role
  }

  # Mutations
  extend type Mutation {
    # Create a new role
    createRole(input: CreateRoleInput!): Role!

    # Update an existing role
    updateRole(id: ID!, input: UpdateRoleInput!): UpdateRoleResponse!

    # Delete a role (with optional fallback role for affected users)
    deleteRole(id: ID!, fallbackRoleName: String): DeleteRoleResponse!

    # Initialize default roles (admin only)
    initializeDefaultRoles: Boolean!
  }
`;

export default roleTypeDefs;
