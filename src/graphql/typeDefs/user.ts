const userTypeDefs = `#graphql
    # User sudah didefinisikan di auth.ts, extend saja

    input CreateUserInput {
        profilePictureUrl: String!
        fullname: String!
        username: String!
        email: String!
        password: String!
        role: String!
    }

    input UpdateUserInput {
        profilePictureUrl: String
        fullname: String
        username: String
        email: String
        role: String
        password: String
        isActive: Boolean
    }

    type ToggleUserStatusResponse {
        success: Boolean!
        message: String!
        user: User!
    }

    type DeleteUserResponse {
        success: Boolean!
        message: String!
    }

    type Query {
        users: [User!]!
        user(id: ID!): User
        usersByRole(role: String!): [User!]!
    }

    type Mutation {
        createUser(input: CreateUserInput!): User!
        updateUser(id: ID!, input: UpdateUserInput!): User
        deleteUser(id: ID!): DeleteUserResponse!
        toggleUserStatus(id: ID!): ToggleUserStatusResponse!
    }
`;

export default userTypeDefs;
