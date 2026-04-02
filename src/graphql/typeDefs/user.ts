const userTypeDefs = `#graphql
    input CreateUserInput {
        profilePictureUrl: String!
        fullname: String!
        username: String!
        email: String!
        password: String!
    }

    input UpdateUserInput {
        profilePictureUrl: String
        fullname: String
        username: String
        email: String
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

    extend type Query {
        users: [User!]!
        user(id: ID!): User
    }

    extend type Mutation {
        createUser(input: CreateUserInput!): User!
        updateUser(id: ID!, input: UpdateUserInput!): User
        deleteUser(id: ID!): DeleteUserResponse!
        toggleUserStatus(id: ID!): ToggleUserStatusResponse!
    }
`;

export default userTypeDefs;
