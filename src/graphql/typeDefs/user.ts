const userTypeDefs = `#graphql
     enum DivisiEnum {
        perencanaan_teknik
        teknik_cabang
        pengawasan_teknik
    }
    
    type User {
         id: ID!
        namaLengkap: String!
        nip: String!
        email: String!
        noHp: String!
        pekerjaanSekarang: ID
        divisi: DivisiEnum!
        isActive: Boolean!
        createdAt: String!
        updatedAt: String!
    }

    input UpdateUserInput {
       namaLengkap: String
        nip: String
        email: String
        noHp: String
        divisi: DivisiEnum
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
        users(search: String): [User!]!
        user(id: ID!): User
    }

    extend type Mutation {
        updateUser(id: ID!, input: UpdateUserInput!): User
        deleteUser(id: ID!): DeleteUserResponse!
        toggleUserStatus(id: ID!): ToggleUserStatusResponse!
    }
`;

export default userTypeDefs;
