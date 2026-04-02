const authTypeDefs = `#graphql
    type User {
        id: ID!
        profilePictureUrl: String!
        fullname: String!
        username: String!
        email: String!
        role: String!
        isActive: Boolean!
        lastOnline: String
        createdAt: String!
        updatedAt: String!
    }

    type UserSettings {
        id: ID!
        roles: [String!]!
    }

    type TokenPair {
        accessToken: String!
        refreshToken: String!
    }

    type AuthResponse {
        user: User!
        tokens: TokenPair!
    }

    type RefreshTokenResponse {
        accessToken: String!
        refreshToken: String!
    }

    type LogoutResponse {
        success: Boolean!
        message: String!
    }

    type ChangePasswordResponse {
        success: Boolean!
        message: String!
    }

    input LoginInput {
        email: String!
        password: String!
    }

    input RegisterInput {
        profilePictureUrl: String!
        fullname: String!
        username: String!
        email: String!
        password: String!
        role: String!
    }

    input ChangePasswordInput {
        oldPassword: String!
        newPassword: String!
    }

    input ForgotPasswordInput {
        email: String!
    }

    input ResetPasswordInput {
        token: String!
        newPassword: String!
    }

    type ForgotPasswordResponse {
        success: Boolean!
        message: String!
    }

    type ResetPasswordResponse {
        success: Boolean!
        message: String!
    }

    type Query {
        me: User
        userSettings: UserSettings!
    }

    type Mutation {
        login(input: LoginInput!): AuthResponse!
        register(input: RegisterInput!): AuthResponse!
        refreshToken(refreshToken: String!): RefreshTokenResponse!
        logout: LogoutResponse!    
        changePassword(input: ChangePasswordInput!): ChangePasswordResponse!
        forgotPassword(input: ForgotPasswordInput!): ForgotPasswordResponse!
        resetPassword(input: ResetPasswordInput!): ResetPasswordResponse!
        addUserRole(role: String!): UserSettings!
        removeUserRole(role: String!): UserSettings!
    }
`;

export default authTypeDefs;
