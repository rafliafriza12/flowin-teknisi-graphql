const baseTypeDefs = `#graphql
  # Custom Scalars
  scalar DateTime

  # Localized String Types for Multi-language support
  type LocalizedString {
    en: String
    id: String
  }

  input LocalizedStringInput {
    en: String
    id: String
  }

  # Pagination Types
  type PageInfo {
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  # Base Query and Mutation types
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;

export default baseTypeDefs;
